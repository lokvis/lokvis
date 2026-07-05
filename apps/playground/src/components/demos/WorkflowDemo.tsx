/**
 * Demo: 5-Step Workflow (W14.5)
 *
 * 展示 @lokvis/sdk 的完整工作流执行能力：
 *   1. importAsset({ kind: 'file', file }) 上传图片
 *   2. run(workflow, [assetId]) 执行 5 步线性工作流
 *      resize → compress → rotate → watermark → convert
 *   3. exportAsset(outputId) 导出结果为可下载 Blob（WebP）
 *
 * 关键演示点：
 *   - Workflow 数据结构（5 个 transform 节点 + 4 条线性边）
 *   - eventBus.onAny() 订阅 workflow:* 与 node:* 事件
 *   - 节点完成度进度条（done / total）
 *   - cancel(workflowId) 中途取消
 *
 * 与 ImageWorkflowDemo 的区别：5 步完整管线 + 实时事件日志 + 进度可视化 + 取消。
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { createLokvis } from '@lokvis/sdk';
import type { LokvisRuntime, Asset } from '@lokvis/sdk';
import type { Workflow, WorkflowNode, WorkflowEdge, AssetType } from '@lokvis/schema';
import { imageToolsPlugin } from '@lokvis/plugin-image';
import { devToolsPlugin } from '@lokvis/plugin-dev';

/** 日志条目 */
interface LogEntry {
  id: number;
  text: string;
  type: 'log' | 'event' | 'error';
}

/** 单步管线定义 */
interface PipelineStep {
  nodeId: string;
  capability: string;
  label: string;
  params: Record<string, unknown>;
}

/**
 * 5 步管线：resize → compress → rotate → watermark → convert
 * 节点 ID 使用可预测的 node-1 .. node-5。
 */
const PIPELINE: PipelineStep[] = [
  {
    nodeId: 'node-1',
    capability: 'image.resize',
    label: 'Resize',
    params: { width: 800, height: 600, fit: 'cover' },
  },
  {
    nodeId: 'node-2',
    capability: 'image.compress',
    label: 'Compress',
    params: { quality: 80 },
  },
  {
    nodeId: 'node-3',
    capability: 'image.rotate',
    label: 'Rotate',
    params: { angle: 90 },
  },
  {
    nodeId: 'node-4',
    capability: 'image.watermark',
    label: 'Watermark',
    params: {
      text: 'Lokvis',
      position: 'bottom-right',
      fontSize: 24,
      color: '#ffffff',
      opacity: 0.8,
    },
  },
  {
    nodeId: 'node-5',
    capability: 'image.convert',
    label: 'Convert',
    params: { format: 'image/webp' },
  },
];

const TOTAL_NODES = PIPELINE.length;

/** 日志计数器（模块级，保证 id 唯一） */
let logCounter = 0;
/** 工作流计数器（用于生成可读的 workflow id） */
let workflowCounter = 0;

/** 构造 5 步线性 Workflow */
function buildWorkflow(): Workflow {
  const nodes: WorkflowNode[] = PIPELINE.map((step) => ({
    id: step.nodeId,
    type: 'transform',
    capability: step.capability,
    params: step.params,
    label: step.label,
  }));
  const edges: WorkflowEdge[] = PIPELINE.slice(1).map((step, i) => ({
    from: PIPELINE[i].nodeId,
    to: step.nodeId,
  }));
  return {
    id: `playground-workflow-${++workflowCounter}-${Date.now()}`,
    version: '1.0',
    name: 'Playground 5-Step Image Pipeline',
    description: 'resize → compress → rotate → watermark → convert',
    author: { id: 'playground', name: 'Playground' },
    category: 'image',
    tags: ['demo', 'image', 'pipeline'],
    nodes,
    edges,
    inputs: { type: 'image' as AssetType, multiple: false },
    outputs: { type: 'image' as AssetType, format: 'webp' },
  };
}

/** 根据节点在管线中的位置推断可视化状态 */
function stepState(
  idx: number,
  done: number,
  running: boolean
): 'done' | 'running' | 'pending' {
  if (idx < done) return 'done';
  if (running && idx === done) return 'running';
  return 'pending';
}

const STATE_COLOR: Record<'done' | 'running' | 'pending', string> = {
  done: 'border-emerald-800/60 bg-emerald-950/20',
  running: 'border-amber-700/60 bg-amber-950/20',
  pending: 'border-zinc-800 bg-zinc-900/40',
};

export default function WorkflowDemo() {
  const runtimeRef = useRef<LokvisRuntime | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logBoxRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const currentWorkflowIdRef = useRef<string | null>(null);

  const [ready, setReady] = useState(false);
  const [uploadedAsset, setUploadedAsset] = useState<Asset | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: TOTAL_NODES,
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  /** 200 条环形缓冲：保留最近 199 条 + 新增 1 条 */
  const addLog = useCallback(
    (text: string, type: LogEntry['type'] = 'log') => {
      setLogs((prev) => [...prev.slice(-199), { id: ++logCounter, text, type }]);
    },
    []
  );

  /** 撤销上一个 object URL 并重置结果 */
  const clearResult = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setResultUrl(null);
  }, []);

  // 初始化 runtime + 订阅事件总线
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let rt: LokvisRuntime | undefined;
    (async () => {
      try {
        rt = await createLokvis({
          plugins: [imageToolsPlugin(), devToolsPlugin()],
        });
        runtimeRef.current = rt;
        setReady(true);
        unsub = rt.eventBus.onAny((e) => {
          switch (e.type) {
            case 'workflow:started':
              addLog(`[workflow:started] ${e.workflowId}`, 'event');
              setProgress({ done: 0, total: TOTAL_NODES });
              break;
            case 'node:started':
              addLog(`[node:started] ${e.nodeId}`, 'event');
              break;
            case 'node:finished':
              addLog(
                `[node:finished] ${e.nodeId} · ${e.capability} · ${e.duration}ms`,
                'event'
              );
              setProgress((p) => ({
                ...p,
                done: Math.min(p.done + 1, TOTAL_NODES),
              }));
              break;
            case 'node:failed':
              addLog(
                `[node:failed] ${e.nodeId} · ${
                  e.error?.message ?? 'unknown error'
                }`,
                'error'
              );
              break;
            case 'workflow:completed':
              addLog(
                `[workflow:completed] ${e.workflowId} · ${e.result.status} · ${e.result.duration}ms`,
                'event'
              );
              setRunning(false);
              break;
            case 'workflow:cancelled':
              addLog(`[workflow:cancelled] ${e.workflowId}`, 'event');
              setRunning(false);
              break;
            default:
              addLog(`[${e.type}]`, 'event');
          }
        });
        addLog('Runtime ready · plugins: imageTools + devTools', 'log');
      } catch (err) {
        addLog(
          `Failed to init runtime: ${
            err instanceof Error ? err.message : String(err)
          }`,
          'error'
        );
      }
    })();
    return () => {
      unsub?.();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      void rt?.cancel('all').catch(() => undefined);
      runtimeRef.current = null;
    };
  }, [addLog]);

  // 日志自动滚动到底部
  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logs]);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const rt = runtimeRef.current;
      if (!rt || !e.target.files?.length) return;
      const file = e.target.files[0];
      try {
        const id = await rt.importAsset({ kind: 'file', file });
        const asset = await rt.getAsset(id);
        setUploadedAsset(asset);
        setProgress({ done: 0, total: TOTAL_NODES });
        clearResult();
        addLog(
          `Imported ${file.name} → ${id} · (${(
            asset.metadata.size / 1024
          ).toFixed(1)} KB)`,
          'log'
        );
      } catch (err) {
        addLog(
          `Import failed: ${err instanceof Error ? err.message : String(err)}`,
          'error'
        );
      } finally {
        e.target.value = '';
      }
    },
    [addLog, clearResult]
  );

  const handleRun = useCallback(async () => {
    const rt = runtimeRef.current;
    const asset = uploadedAsset;
    if (!rt || !asset) {
      addLog('Upload an image before running', 'error');
      return;
    }
    setRunning(true);
    setProgress({ done: 0, total: TOTAL_NODES });
    clearResult();

    const workflow = buildWorkflow();
    currentWorkflowIdRef.current = workflow.id;
    addLog(`Running workflow ${workflow.id} on asset ${asset.id}`, 'log');

    try {
      const result = await rt.run(workflow, [asset.id]);
      if (result.status === 'completed' && result.outputs.length > 0) {
        addLog(
          `Workflow completed · ${result.outputs.length} output(s) · ${result.duration}ms`,
          'log'
        );
        try {
          const blob = await rt.exportAsset(result.outputs[0]);
          const url = URL.createObjectURL(blob);
          objectUrlRef.current = url;
          setResultUrl(url);
          addLog(`Exported output → ${result.outputs[0]}`, 'log');
        } catch (err) {
          addLog(
            `Export failed: ${err instanceof Error ? err.message : String(err)}`,
            'error'
          );
        }
      } else if (result.status === 'cancelled') {
        addLog('Workflow cancelled', 'log');
      } else {
        addLog(
          `Workflow ${result.status}: ${result.error ?? 'unknown error'}`,
          'error'
        );
      }
    } catch (err) {
      addLog(
        `Run failed: ${err instanceof Error ? err.message : String(err)}`,
        'error'
      );
    } finally {
      setRunning(false);
      currentWorkflowIdRef.current = null;
    }
  }, [addLog, clearResult, uploadedAsset]);

  const handleCancel = useCallback(async () => {
    const rt = runtimeRef.current;
    const wfId = currentWorkflowIdRef.current;
    if (!rt || !wfId) return;
    try {
      await rt.cancel(wfId);
      addLog(`Cancel requested for ${wfId}`, 'log');
    } catch (err) {
      addLog(
        `Cancel failed: ${err instanceof Error ? err.message : String(err)}`,
        'error'
      );
    }
  }, [addLog]);

  const pct = progress.total
    ? Math.min(100, (progress.done / progress.total) * 100)
    : 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">5-Step Workflow</h1>
        <p className="mt-0.5 text-xs text-zinc-500">
          resize → compress → rotate → watermark → convert
        </p>
      </div>

      {/* Info bar */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950/50 px-4 py-2">
        <p className="text-[11px] text-zinc-500">
          importAsset → run(workflow, [assetId]) → exportAsset. All local, no
          upload.
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            ready
              ? 'bg-emerald-950 text-emerald-400'
              : 'bg-zinc-900 text-zinc-500'
          }`}
        >
          {ready ? 'runtime ready' : 'initializing…'}
        </span>
      </div>

      {/* 2-column layout */}
      <div className="grid flex-1 grid-cols-1 gap-px overflow-hidden bg-zinc-800 lg:grid-cols-2">
        {/* Left: pipeline + controls + progress */}
        <section className="flex flex-col overflow-hidden bg-zinc-950">
          <header className="border-b border-zinc-800/50 px-4 py-2 text-xs font-semibold text-zinc-400">
            Pipeline ({PIPELINE.length} steps)
          </header>
          <div className="flex-1 overflow-auto p-3">
            {/* 步骤可视化 */}
            <ol className="space-y-0">
              {PIPELINE.map((step, idx) => {
                const st = stepState(idx, progress.done, running);
                return (
                  <li key={step.nodeId}>
                    <div
                      className={`rounded-lg border p-2.5 ${STATE_COLOR[st]}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 font-mono text-[11px]">
                          <span className="text-zinc-600">{step.nodeId}</span>
                          <span className="mx-1.5 text-zinc-700">·</span>
                          <span className="text-indigo-400">
                            {step.capability}
                          </span>
                        </div>
                        <span className="shrink-0 text-[10px] text-zinc-500">
                          {step.label}
                        </span>
                      </div>
                      <pre className="mt-1 overflow-auto font-mono text-[10px] text-zinc-500">
                        {JSON.stringify(step.params)}
                      </pre>
                    </div>
                    {idx < PIPELINE.length - 1 && (
                      <div className="py-0.5 text-center text-[10px] text-zinc-700">
                        ↓
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>

            {/* 控制按钮 */}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!ready}
                className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {uploadedAsset ? 'Replace file' : 'Upload image'}
              </button>
              <button
                onClick={handleRun}
                disabled={!ready || !uploadedAsset || running}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {running ? 'Running…' : '▶ Run Workflow'}
              </button>
              <button
                onClick={handleCancel}
                disabled={!running}
                className="rounded-lg bg-red-950 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancel
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUpload}
              />
            </div>

            {/* 上传资产信息 */}
            {uploadedAsset && (
              <div className="mt-2 rounded border border-zinc-800 bg-zinc-900/50 px-2 py-1.5 text-[10px] text-zinc-400">
                <span className="text-zinc-500">input:</span>{' '}
                <span className="font-mono text-zinc-300">
                  {uploadedAsset.blob.path.split('/').pop() ?? uploadedAsset.id}
                </span>
                <span className="mx-1.5 text-zinc-700">·</span>
                {(uploadedAsset.metadata.size / 1024).toFixed(1)} KB
                <span className="mx-1.5 text-zinc-700">·</span>
                {uploadedAsset.metadata.format}
              </div>
            )}

            {/* 进度条 */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-[10px] text-zinc-500">
                <span>Progress</span>
                <span className="font-mono text-zinc-400">
                  {progress.done}/{progress.total}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Right: event log + results */}
        <section className="flex flex-col overflow-hidden bg-zinc-950">
          {/* Event Log */}
          <div className="flex min-h-0 flex-1 flex-col border-b border-zinc-800/50">
            <header className="flex items-center justify-between border-b border-zinc-800/50 px-4 py-2">
              <span className="text-xs font-semibold text-zinc-400">
                Event Log
              </span>
              <button
                onClick={() => setLogs([])}
                className="text-[10px] text-zinc-500 hover:text-zinc-300"
              >
                Clear
              </button>
            </header>
            <div
              ref={logBoxRef}
              className="flex-1 overflow-auto p-2 font-mono text-[10px]"
            >
              {logs.length === 0 ? (
                <p className="p-4 text-center text-zinc-600">
                  workflow:* and node:* events will appear here…
                </p>
              ) : (
                logs.map((l) => (
                  <div
                    key={l.id}
                    className={`px-1 py-0.5 ${
                      l.type === 'error'
                        ? 'text-red-400'
                        : l.type === 'event'
                        ? 'text-indigo-400'
                        : 'text-zinc-400'
                    }`}
                  >
                    {l.text}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Results */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <header className="border-b border-zinc-800/50 px-4 py-2 text-xs font-semibold text-zinc-400">
              Results
            </header>
            <div className="flex-1 overflow-auto p-3">
              {resultUrl ? (
                <div className="space-y-2">
                  <a
                    href={resultUrl}
                    download="lokvis-output.webp"
                    className="inline-block rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    ↓ Download output (webp)
                  </a>
                  <img
                    src={resultUrl}
                    alt="Workflow output"
                    className="max-w-full rounded border border-zinc-800"
                  />
                </div>
              ) : (
                <p className="text-[11px] text-zinc-600">
                  Run the workflow to produce a downloadable output.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-800 bg-zinc-950/50 px-4 py-2 text-[10px] text-zinc-500">
        <span className="text-zinc-400">Tip:</span> The pipeline runs 5 image
        capabilities linearly. Watch the Event Log for node:started /
        node:finished progress.
      </div>
    </div>
  );
}
