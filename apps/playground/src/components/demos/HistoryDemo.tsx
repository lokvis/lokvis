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

const WORKFLOW_ID = 'demo-history';

const FILTERS = [
  { label: 'Grayscale', capability: 'image.filter', params: { preset: 'grayscale' } },
  { label: 'Invert', capability: 'image.filter', params: { preset: 'invert' } },
  { label: 'Sepia', capability: 'image.filter', params: { preset: 'sepia' } },
  { label: 'Blur', capability: 'image.filter', params: { params: { radius: 4 } } },
] as const;

export default function HistoryDemo() {
  const [runtime, setRuntime] = useState<LokvisRuntime | null>(null);
  const [inputId, setInputId] = useState<AssetId | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
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
          void rt?.history(WORKFLOW_ID).then(setHistory);
        }
      });
    })();
    return () => void rt?.cancel(WORKFLOW_ID);
  }, []);

  async function refreshCurrent(rt: LokvisRuntime) {
    const outs = (rt as unknown as { _getCurrentOutputs(id: string): AssetId[] })._getCurrentOutputs(WORKFLOW_ID);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function applyFilter(filterIdx: number) {
    if (!runtime || !inputId) return;
    setBusy(true);
    setError(null);
    const filter = FILTERS[filterIdx];

    const outs = (runtime as unknown as { _getCurrentOutputs(id: string): AssetId[] })._getCurrentOutputs(WORKFLOW_ID);
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
      edges: [{ from: '__input__', to: 'n0' }],
      inputs: { type: 'image', multiple: false },
      outputs: { type: 'image' },
    };

    try {
      const res = await runtime.run(workflow, [sourceId]);
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
        <h1 className="text-sm font-semibold text-zinc-100">Undo / Redo</h1>
        <p className="mt-0.5 text-xs text-zinc-500">history stack · time travel</p>
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
              + Upload
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
              disabled={history.length === 0 || busy}
              className="rounded px-2 py-1 text-[10px] font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
              ← Undo
            </button>
            <button
              onClick={handleRedo}
              disabled={busy}
              className="rounded px-2 py-1 text-[10px] font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
              Redo →
            </button>
          </div>

          {/* 预览 */}
          <div className="flex flex-1 items-center justify-center bg-zinc-950 p-4">
            {currentUrl ? (
              <img src={currentUrl} alt="Current state" className="max-h-full max-w-full object-contain" />
            ) : (
              <p className="text-[11px] text-zinc-600">Upload an image to begin</p>
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
          <header className="border-b border-zinc-800/50 px-3 py-2 text-[11px] font-semibold text-zinc-400">
            History ({history.length})
          </header>
          <div className="flex-1 overflow-auto p-2">
            {history.length === 0 ? (
              <p className="p-3 text-center text-[10px] text-zinc-600">
                Apply a filter to build history
              </p>
            ) : (
              <ol className="space-y-1">
                {history.map((h, i) => (
                  <li
                    key={h.id}
                    className="rounded bg-zinc-900/50 px-2 py-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-indigo-400">#{i + 1}</span>
                      <span className="text-[9px] text-zinc-600">{new Date(h.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-zinc-300">{h.capability}</div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
