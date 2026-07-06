/**
 * Demo 3: Undo / Redo
 *
 * 演示 Runtime 内置的 HistoryStack：
 *   - 每次 node:finished 自动入栈
 *   - undo(workflowId) 回退到上一步
 *   - redo(workflowId) 前进
 *   - history(workflowId) 读取栈快照
 *
 * 通过对一个图像连续执行多次 filter 操作（grayscale / invert / blur）来
 * 制造可撤销的历史栈。
 */
import { useEffect, useState, useRef } from 'react';
import { createLokvis } from '@lokvis/sdk';
import type { LokvisRuntime, Workflow, AssetId } from '@lokvis/sdk';
import type { HistoryEntry } from '@lokvis/schema';
import { imageToolsPlugin } from '@lokvis/plugin-image';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

const WORKFLOW_ID = 'demo-history';

const FILTERS = [
  { label: 'Grayscale', capability: 'image.filter', params: { preset: 'grayscale' } },
  { label: 'Invert', capability: 'image.filter', params: { preset: 'invert' } },
  { label: 'Sepia', capability: 'image.filter', params: { preset: 'sepia' } },
  { label: 'Blur', capability: 'image.filter', params: { preset: 'blur', radius: 4 } },
] as const;

/** 将 HistoryEntry 渲染为可读标签:如 "Filter · Grayscale"、"Filter · Blur (r=4)" */
function describeHistoryEntry(h: HistoryEntry): string {
  const short = h.capability.replace(/^[a-z]+\./, '');
  const cap = short.charAt(0).toUpperCase() + short.slice(1);
  if (h.capability === 'image.filter') {
    const preset = typeof h.params.preset === 'string' ? h.params.preset : '';
    const label = preset ? preset.charAt(0).toUpperCase() + preset.slice(1) : 'Unknown';
    const radius =
      preset === 'blur' && typeof h.params.radius === 'number' ? ` · r=${h.params.radius}` : '';
    return `${cap} · ${label}${radius}`;
  }
  const paramKeys = Object.keys(h.params);
  if (paramKeys.length === 0) return cap;
  const summary = paramKeys
    .slice(0, 2)
    .map((k) => `${k}=${JSON.stringify(h.params[k])}`)
    .join(', ');
  return `${cap} (${summary})`;
}

export default function HistoryDemo() {
  return (
    <ErrorBoundary>
      <HistoryDemoContent />
    </ErrorBoundary>
  );
}

function HistoryDemoContent() {
  const lang = useLang();
  const t = useTranslations(lang);
  const [runtime, setRuntime] = useState<LokvisRuntime | null>(null);
  const [inputId, setInputId] = useState<AssetId | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyCursor, setHistoryCursor] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let rt: LokvisRuntime | undefined;
    (async () => {
      rt = await createLokvis({ plugins: [imageToolsPlugin()] });
      setRuntime(rt);
      rt.eventBus.on('history:changed', (e) => {
        if (e.workflowId === WORKFLOW_ID) {
          setHistory(e.entries);
          setHistoryCursor(e.currentIndex);
        }
      });
    })();
    return () => void rt?.cancel(WORKFLOW_ID);
  }, []);

  async function refreshCurrent(rt: LokvisRuntime) {
    const outs = await rt.getCurrentOutputs(WORKFLOW_ID);
    if (outs.length === 0) return;
    try {
      const blob = await rt.exportAsset(outs[0]);
      setCurrentUrl(URL.createObjectURL(blob));
    } catch {
      /* ignore */
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!runtime || !e.target.files?.length) return;
    try {
      const file = e.target.files[0];
      const id = await runtime.importAsset({ kind: 'file', file });
      setInputId(id);
      setError(null);
      // 显示原始图像作为当前状态
      const blob = await runtime.exportAsset(id);
      setCurrentUrl(URL.createObjectURL(blob));
      setHistory([]);
      setHistoryCursor(-1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function applyFilter(filterIdx: number) {
    if (!runtime || !inputId) return;
    setBusy(true);
    setError(null);
    const filter = FILTERS[filterIdx];

    const outs = await runtime.getCurrentOutputs(WORKFLOW_ID);
    const sourceId = outs.length > 0 ? outs[0] : inputId;

    const workflow: Workflow = {
      id: WORKFLOW_ID,
      version: '1.0',
      name: 'Playground History Demo',
      description: 'apply filter',
      author: { id: 'playground', name: 'Playground' },
      category: 'image',
      tags: ['demo'],
      nodes: [
        { id: 'n0', type: 'transform', capability: filter.capability, params: filter.params },
      ],
      edges: [],
      inputs: { type: 'image', multiple: false },
      outputs: { type: 'image' },
    };

    try {
      const res = await runtime.run(workflow, [sourceId], { appendHistory: true });
      if (res.status === 'completed' && res.outputs.length > 0) {
        await refreshCurrent(runtime);
      } else if (res.status === 'failed') {
        setError(res.error ?? 'Workflow failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleUndo() {
    if (!runtime) return;
    await runtime.undo(WORKFLOW_ID);
    await refreshCurrent(runtime);
  }

  async function handleRedo() {
    if (!runtime) return;
    await runtime.redo(WORKFLOW_ID);
    await refreshCurrent(runtime);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">{t('history.title')}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{t('history.subtitle')}</p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 主区：预览 + 工具栏 */}
        <div className="flex flex-1 flex-col">
          {/* 工具栏 */}
          <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-950/50 px-3 py-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded bg-zinc-800 px-2 py-1 text-[10px] font-medium text-zinc-300 hover:bg-zinc-700"
            >
              {t('common.upload')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
            <div className="mx-2 h-4 w-px bg-zinc-800" />
            {FILTERS.map((f, i) => (
              <button
                key={f.label}
                onClick={() => applyFilter(i)}
                disabled={!inputId || busy}
                className="rounded px-2 py-1 text-[10px] font-medium text-indigo-400 hover:bg-indigo-600/10 disabled:opacity-40"
              >
                + {f.label}
              </button>
            ))}
            <div className="mx-2 h-4 w-px bg-zinc-800" />
            <button
              onClick={handleUndo}
              disabled={historyCursor < 0 || busy}
              className="rounded px-2 py-1 text-[10px] font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
              {t('history.undoArrow')}
            </button>
            <button
              onClick={handleRedo}
              disabled={historyCursor >= history.length - 1 || busy}
              className="rounded px-2 py-1 text-[10px] font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
              {t('history.redoArrow')}
            </button>
          </div>

          {/* 预览 */}
          <div className="flex flex-1 items-center justify-center bg-zinc-950 p-4">
            {currentUrl ? (
              <img src={currentUrl} alt="Current state" className="max-h-full max-w-full object-contain" />
            ) : (
              <p className="text-[11px] text-zinc-600">{t('history.uploadHint')}</p>
            )}
          </div>

          {error && (
            <div className="border-t border-red-900/50 bg-red-950/30 px-3 py-2 text-[11px] text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* 历史栈侧栏 */}
        <aside className="hidden w-64 flex-shrink-0 flex-col border-l border-zinc-800 bg-zinc-950/50 md:flex">
          <header className="flex items-center justify-between border-b border-zinc-800/50 px-3 py-2 text-[11px] font-semibold text-zinc-400">
            <span>{t('history.headerPrefix')}{historyCursor + 1}{t('history.headerSuffix')}</span>
            {history.length > historyCursor + 1 && (
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-normal text-zinc-500">
                {t('history.redoCountPrefix')}{history.length - historyCursor - 1}{t('history.redoCountSuffix')}
              </span>
            )}
          </header>
          <div className="flex-1 overflow-auto p-2">
            {history.length === 0 ? (
              <p className="p-3 text-center text-[10px] text-zinc-600">
                {t('history.applyFilterHint')}
              </p>
            ) : (
              <ol className="space-y-1">
                {history.map((h, i) => {
                  const isRedo = i > historyCursor;
                  return (
                    <li
                      key={h.id}
                      className={`rounded px-2 py-1.5 ${
                        isRedo ? 'bg-zinc-900/20 opacity-50' : 'bg-zinc-900/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-indigo-400">
                          #{i + 1}
                          {isRedo && (
                            <span className="ml-1 text-[8px] font-normal uppercase tracking-wider text-zinc-500">
                              {t('history.redoLabel')}
                            </span>
                          )}
                        </span>
                        <span className="text-[9px] text-zinc-600">
                          {new Date(h.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[10px] text-zinc-300">
                        {describeHistoryEntry(h)}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
