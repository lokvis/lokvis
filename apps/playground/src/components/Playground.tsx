import { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react';
import { createLokvis } from '@lokvis/sdk';
import type { LokvisRuntime } from '@lokvis/runtime';
import { imageToolsPlugin } from '@lokvis/plugin-image';
import { devToolsPlugin } from '@lokvis/plugin-dev';
import { ErrorBoundary } from './ErrorBoundary';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';
import { SNIPPETS, DEFAULT_SNIPPET_ID, findSnippet } from './playground/snippets';
import { extractCodeFromHash, buildShareUrl } from './playground/share';

// W21.3: CodeEditor(含 CodeMirror ~335KB)懒加载,不进首页首屏 chunk
// W21.8: 配合 activateEditor state 进一步把 chunk 加载推迟到首次 focus,
//        首屏渲染零依赖 PlainCodeArea(textarea),不触发 <Suspense> fallback,
//        LCP 由 CodeMirror chunk 加载(~335KB / 6.9s)降到 textarea 首次绘制(<100ms)。
const CodeEditor = lazy(() =>
  import('./CodeEditor').then(m => ({ default: m.CodeEditor }))
);

/**
 * Lokvis Playground(W19.6 增强)
 *
 * Browser-based code playground for trying @lokvis/sdk API.
 * Left: code editor(CodeMirror 6). Right: output console.
 *
 * W19.6 增强点:
 *  - 示例代码片段选择器(5 个 snippet)
 *  - localStorage 持久化(代码 + snippetId)
 *  - URL hash 分享(#code=<base64>)
 *  - Cmd/Ctrl+Enter 运行快捷键
 *  - 运行耗时显示 + 重置/复制按钮
 */

const STORAGE_KEY_CODE = 'lokvis.playground.code';
const STORAGE_KEY_SNIPPET = 'lokvis.playground.snippetId';

interface LogEntry {
  id: number;
  text: string;
  type: 'log' | 'error' | 'event';
}

export function Playground() {
  return (
    <ErrorBoundary>
      <PlaygroundContent />
    </ErrorBoundary>
  );
}

function PlaygroundContent() {
  const lang = useLang();
  const t = useTranslations(lang);
  const [runtime, setRuntime] = useState<LokvisRuntime | null>(null);
  const [code, setCode] = useState<string>(() => loadInitialCode());
  const [snippetId, setSnippetId] = useState<string>(() => loadInitialSnippetId());
  const [output, setOutput] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<'editor' | 'output'>('editor');
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  // W21.8: 首次 focus 之前渲染 PlainCodeArea(零依赖 textarea),
  //         避免首屏 JSX 中 <Suspense> 立即触发 lazy chunk 请求。
  //         切换后 CodeEditor 才进入 Suspense fallback → 真 chunk 加载。
  const [activateEditor, setActivateEditor] = useState(false);
  const logIdRef = useRef(0);
  const codeRef = useRef(code);
  codeRef.current = code;
  const runningRef = useRef(running);
  runningRef.current = running;

  const addLog = useCallback((text: string, type: LogEntry['type'] = 'log') => {
    setOutput((prev) => [...prev, { id: logIdRef.current++, text, type }]);
  }, []);

  // Bootstrap runtime once
  useEffect(() => {
    (async () => {
      try {
        const rt = await createLokvis({
          plugins: [imageToolsPlugin(), devToolsPlugin()],
        });
        setRuntime(rt);
        rt.eventBus.onAny((e) => {
          addLog(`[event] ${e.type}`, 'event');
        });
      } catch (err) {
        addLog(`[error] ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    })();
    // 仅 mount 时初始化 runtime 一次;addLog/setRuntime 为稳定 setter,无需列入依赖
  }, []);

  // Persist code + snippetId to localStorage (debounced via microtask)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CODE, code);
    } catch {
      /* quota / disabled — ignore */
    }
  }, [code]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SNIPPET, snippetId);
    } catch {
      /* ignore */
    }
  }, [snippetId]);

  // Keyboard shortcut: Cmd/Ctrl+Enter to run
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        void handleRun();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // handleRun 经闭包读取 runtime;runtime 变化时重新挂载监听即可,无需把 handleRun 列入依赖
  }, [runtime]);

  async function handleRun() {
    // runningRef 防止并发重入:避免第二次 handleRun 在第一次 finally 前
    // 覆盖 console.log,导致 restore 错版本污染全局 console
    if (!runtime || runningRef.current) return;
    setRunning(true);
    setOutput([]);

    const originalLog = console.log;
    const originalError = console.error;
    const logs: string[] = [];

    console.log = (...args) => {
      logs.push(args.map(stringifyArg).join(' '));
      originalLog(...args);
    };
    console.error = (...args) => {
      logs.push(`[error] ${args.map(stringifyArg).join(' ')}`);
      originalError(...args);
    };

    const start = performance.now();
    try {
      const fn = new Function(
        'createLokvis',
        'imageToolsPlugin',
        'devToolsPlugin',
        'lokvis',
        `"use strict";\nreturn (async () => {\n${codeRef.current}\n})();`,
      );
      await fn(createLokvis, imageToolsPlugin, devToolsPlugin, runtime);
    } catch (err) {
      logs.push(`[error] ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      console.log = originalLog;
      console.error = originalError;
      const duration = Math.round(performance.now() - start);
      setLastDurationMs(duration);
      // 合并本地收集的 logs 与运行期间通过 addLog 收集的 event 条目
      const existingEvents = output.filter((e) => e.type === 'event');
      const merged = [
        ...existingEvents,
        ...logs.map((text) => ({
          id: logIdRef.current++,
          text,
          type: text.startsWith('[error]') ? ('error' as const) : text.startsWith('[event]') ? ('event' as const) : ('log' as const),
        })),
      ];
      setOutput(merged);
      setRunning(false);
    }
  }

  function handleSnippetChange(id: string) {
    const snip = findSnippet(id);
    setSnippetId(snip.id);
    setCode(snip.code);
    setOutput([]);
    setLastDurationMs(null);
  }

  function handleReset() {
    const snip = findSnippet(snippetId);
    setCode(snip.code);
    setOutput([]);
    setLastDurationMs(null);
  }

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(codeRef.current);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — silent */
    }
  }

  async function handleShare() {
    try {
      const url = buildShareUrl(codeRef.current);
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1500);
    } catch {
      /* clipboard unavailable — silent */
    }
  }

  const isModified = code !== findSnippet(snippetId).code;
  const currentSnippet = findSnippet(snippetId);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-950/50 px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Snippet selector */}
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <span>{t('playground.snippet')}</span>
            <select
              value={snippetId}
              onChange={(e) => handleSnippetChange(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] font-medium text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              {SNIPPETS.map((s) => (
                <option key={s.id} value={s.id}>
                  {lang === 'zh' ? s.labelZh : s.labelEn}
                </option>
              ))}
            </select>
          </label>

          {runtime && (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-950 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-800">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              </span>
              {t('playground.runtimeReady')}
            </span>
          )}

          {lastDurationMs !== null && (
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-mono text-zinc-500">
              {lastDurationMs}ms
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Copy code */}
          <button
            onClick={handleCopyCode}
            title={t('playground.copyCodeHint')}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            {copied ? '✓' : t('playground.copy')}
          </button>

          {/* Share URL */}
          <button
            onClick={handleShare}
            title={t('playground.shareHint')}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            {shareCopied ? '✓' : t('playground.share')}
          </button>

          {/* Reset */}
          <button
            onClick={handleReset}
            disabled={!isModified}
            title={t('playground.resetHint')}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('playground.reset')}
          </button>

          {/* Clear output */}
          <button
            onClick={() => setOutput([])}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            {t('playground.clear')}
          </button>

          {/* Run */}
          <button
            onClick={handleRun}
            disabled={running || !runtime}
            title={t('playground.runShortcutHint')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                {t('playground.running')}
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                {t('playground.run')}
              </>
            )}
          </button>
        </div>
      </header>

      {/* Snippet description (single line) */}
      <div className="border-b border-zinc-800/50 bg-zinc-950/30 px-4 py-1 text-[10px] text-zinc-600">
        {lang === 'zh' ? currentSnippet.descZh : currentSnippet.descEn}
        {isModified && (
          <span className="ml-2 rounded bg-amber-950 px-1.5 py-0.5 text-[9px] font-medium text-amber-400">
            {t('playground.modified')}
          </span>
        )}
      </div>

      {/* Tabs - mobile */}
      <div className="flex border-b border-zinc-800 bg-zinc-950/50 md:hidden">
        <button
          onClick={() => setTab('editor')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${tab === 'editor' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          {t('playground.editor')}
        </button>
        <button
          onClick={() => setTab('output')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${tab === 'output' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          {t('playground.output')} {output.length > 0 && `(${output.length})`}
        </button>
      </div>

      {/* Editor + Output */}
      <div className="flex flex-1 overflow-hidden">
        {/* Code Editor */}
        <div className={`flex flex-1 flex-col overflow-hidden border-r border-zinc-800 ${tab !== 'editor' ? 'hidden md:flex' : ''}`}>
          <div className="flex items-center justify-between border-b border-zinc-800/50 px-4 py-1.5">
            <span className="flex items-center gap-2 text-[11px] text-zinc-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              {t('playground.editorJs')}
            </span>
            <span className="text-[11px] text-zinc-600">{t('playground.javascript')}</span>
          </div>
          <div className="flex-1 overflow-auto bg-[#282c34]">
            {activateEditor ? (
              <Suspense fallback={
                <div className="flex h-full items-center justify-center text-[11px] text-zinc-600">
                  {t('playground.editorJs')}…
                </div>
              }>
                <CodeEditor
                  value={code}
                  onChange={setCode}
                  placeholder={t('playground.placeholder')}
                  // W21.9: 切换自 PlainCodeArea 时焦点已被 Suspense fallback
                  // 偷走,CodeEditor mount 后自动 view.focus() 把焦点收回。
                  autoFocus
                />
              </Suspense>
            ) : (
              <PlainCodeArea
                value={code}
                onChange={setCode}
                onActivate={() => setActivateEditor(true)}
                placeholder={t('playground.placeholder')}
              />
            )}
          </div>
        </div>

        {/* Output */}
        <div className={`flex flex-1 flex-col overflow-hidden ${tab !== 'output' ? 'hidden md:flex' : ''}`}>
          <div className="flex items-center justify-between border-b border-zinc-800/50 px-4 py-1.5">
            <span className="flex items-center gap-2 text-[11px] text-zinc-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>
              {t('playground.output')}
            </span>
            {output.length > 0 && (
              <span className="text-[11px] text-zinc-600">{output.length}{t('playground.linesSuffix')}</span>
            )}
          </div>
          <div className="flex-1 overflow-auto bg-zinc-950 p-4">
            {output.length === 0 ? (
              <div className="flex h-full items-center justify-center text-zinc-600">
                <div className="text-center">
                  <svg className="mx-auto mb-2 h-8 w-8 text-zinc-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"/></svg>
                  <p className="text-xs">{t('playground.outputWillAppear')}</p>
                  <p className="mt-1 text-[10px] text-zinc-700">{t('playground.runHint')}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-px">
                {output.map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex items-start gap-2 rounded px-2 py-0.5 text-xs font-mono ${
                      entry.type === 'error'
                        ? 'bg-red-950/30 text-red-400'
                        : entry.type === 'event'
                        ? 'bg-indigo-950/30 text-indigo-400'
                        : 'text-zinc-400'
                    }`}
                  >
                    <span className="flex-shrink-0 w-5 text-right text-zinc-600">{entry.id + 1}</span>
                    <span className="whitespace-pre-wrap break-all">{entry.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

/** 把任意值转成可读字符串(对象/数组做 JSON 缩进) */
function stringifyArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return arg.message;
  if (arg === undefined) return 'undefined';
  if (arg === null) return 'null';
  try {
    return JSON.stringify(arg, null, 0);
  } catch {
    return String(arg);
  }
}

/** 加载初始代码:优先 URL hash → localStorage → 默认 snippet */
function loadInitialCode(): string {
  // SSR guard — window undefined during Astro build
  if (typeof window === 'undefined') return findSnippet(DEFAULT_SNIPPET_ID).code;

  // 1. URL hash share link takes precedence
  const hash = window.location.hash;
  const fromHash = extractCodeFromHash(hash);
  if (fromHash) return fromHash;

  // 2. Restored from localStorage
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CODE);
    if (saved && saved.trim().length > 0) return saved;
  } catch {
    /* localStorage disabled — fall through */
  }

  // 3. Default snippet
  return findSnippet(DEFAULT_SNIPPET_ID).code;
}

/** 加载初始 snippetId:localStorage → 默认 */
function loadInitialSnippetId(): string {
  if (typeof window === 'undefined') return DEFAULT_SNIPPET_ID;
  try {
    return localStorage.getItem(STORAGE_KEY_SNIPPET) ?? DEFAULT_SNIPPET_ID;
  } catch {
    return DEFAULT_SNIPPET_ID;
  }
}

/**
 * W21.8: 首屏占位 textarea,在 CodeEditor lazy chunk 加载前渲染代码内容。
 *
 * 设计目标:
 *  - 零依赖(纯 React + 原生 textarea),不触发任何 chunk 请求
 *  - 视觉与 CodeEditor oneDark 主题对齐(背景 #282c34 + monospace 字体)
 *  - 用户首次 focus 时通过 onActivate 回调触发 CodeEditor 加载,
 *    切换瞬间 <Suspense> 渲染 fallback 再到 CodeEditor,state 保真
 *  - 接受与 CodeEditor 一致的 value/onChange/placeholder 接口,
 *    保证切换前后 state 一致
 */
interface PlainCodeAreaProps {
  value: string;
  onChange: (value: string) => void;
  onActivate: () => void;
  placeholder: string;
}

function PlainCodeArea({ value, onChange, onActivate, placeholder }: PlainCodeAreaProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onActivate}
      placeholder={placeholder}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      className="h-full w-full resize-none border-0 bg-[#282c34] p-3 font-mono text-xs leading-5 text-zinc-100 outline-none placeholder:text-zinc-600"
    />
  );
}
