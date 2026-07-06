import { useEffect, useState, useCallback } from 'react';
import { createLokvis } from '@lokvis/sdk';
import type { LokvisRuntime } from '@lokvis/runtime';
import imageToolsPlugin from '@lokvis/plugin-image';
import devToolsPlugin from '@lokvis/plugin-dev';
import { CodeEditor } from './CodeEditor';
import { ErrorBoundary } from './ErrorBoundary';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

/**
 * Lokvis Playground
 *
 * A browser-based code playground for trying @lokvis/sdk API.
 * Left: code editor. Right: output console.
 */

const DEFAULT_CODE = `// Lokvis Playground
// Try the Lokvis SDK in your browser

const lokvis = await createLokvis({
  plugins: [imageToolsPlugin(), devToolsPlugin()],
});

// List all registered capabilities
const caps = await lokvis.capabilities();
console.log('Registered capabilities:', caps.length);

// List capability names
caps.forEach(c => console.log('  -', c.name));

// Import a sample image
// const blob = await fetch('/sample.png').then(r => r.blob());
// const id = await lokvis.importAsset({ kind: 'blob', blob, name: 'sample.png' });
// console.log('Asset ID:', id);
`;

interface LogEntry {
  id: number;
  text: string;
  type: 'log' | 'error' | 'event';
}

let logIdCounter = 0;

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
  const [code, setCode] = useState(DEFAULT_CODE);
  const [output, setOutput] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<'editor' | 'output'>('editor');

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addLog = useCallback((text: string, type: LogEntry['type'] = 'log') => {
    setOutput((prev) => [...prev, { id: ++logIdCounter, text, type }]);
  }, []);

  async function handleRun() {
    if (!runtime) return;
    setRunning(true);
    setOutput([]);

    const originalLog = console.log;
    const originalError = console.error;
    const logs: string[] = [];

    console.log = (...args) => {
      logs.push(args.map(String).join(' '));
      originalLog(...args);
    };
    console.error = (...args) => {
      logs.push(`[error] ${args.map(String).join(' ')}`);
      originalError(...args);
    };

    try {
      const fn = new Function(
        'createLokvis',
        'imageToolsPlugin',
        'devToolsPlugin',
        'lokvis',
        `"use strict";\nreturn (async () => {\n${code}\n})();`
      );
      await fn(createLokvis, imageToolsPlugin, devToolsPlugin, runtime);
    } catch (err) {
      logs.push(`[error] ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      console.log = originalLog;
      console.error = originalError;
      setOutput(logs.map((text, i) => ({ id: i, text, type: text.startsWith('[error]') ? 'error' : text.startsWith('[event]') ? 'event' : 'log' })));
      setRunning(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar（壳已提供品牌条，这里仅保留 Run/Clear 工具栏） */}
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950/50 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-zinc-400">{t('playground.editorJs')}</span>
          {runtime && (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-950 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-800">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              </span>
              {t('playground.runtimeReady')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOutput([])}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            {t('playground.clear')}
          </button>
          <button
            onClick={handleRun}
            disabled={running || !runtime}
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
            <CodeEditor
              value={code}
              onChange={setCode}
              placeholder={t('playground.placeholder')}
            />
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
