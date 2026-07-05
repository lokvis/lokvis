/**
 * Demo: 5-Step Workflow (W14.5)
 *
 * 展示 5 步链式 workflow 的完整执行 —— 一个 Asset 经过 5 个 capability
 * 节点串联处理，最终输出。这是 Lokvis 最核心的 demo。
 *
 * 管线：resize → watermark → rotate → filter → convert
 *
 * 每个节点的耗时通过订阅 `node:finished` 事件实时采集（WorkflowResult
 * 仅含整体 duration，无 per-node metrics）。
 */
import { useEffect, useState, useRef, Fragment } from 'react';
import { createLokvis } from '@lokvis/sdk';
import type { LokvisRuntime, Workflow, WorkflowResult, AssetId } from '@lokvis/sdk';
import { imageToolsPlugin } from '@lokvis/plugin-image';

type Stage = 'idle' | 'running' | 'done' | 'failed';
type FilterPreset = 'grayscale' | 'invert' | 'sepia' | 'blur';
type OutputFormat = 'png' | 'jpeg' | 'webp' | 'avif' | 'gif';

/** 管线节点定义（id 与 workflow.nodes 对齐，用于时间线渲染） */
const NODES: { id: string; capability: string; label: string }[] = [
  { id: 'n1', capability: 'image.resize', label: 'resize' },
  { id: 'n2', capability: 'image.watermark', label: 'watermark' },
  { id: 'n3', capability: 'image.rotate', label: 'rotate' },
  { id: 'n4', capability: 'image.filter', label: 'filter' },
  { id: 'n5', capability: 'image.convert', label: 'convert' },
];

export default function WorkflowDemo() {
  const [runtime, setRuntime] = useState<LokvisRuntime | null>(null);
  const [inputId, setInputId] = useState<AssetId | null>(null);
  const [inputUrl, setInputUrl] = useState<string | null>(null);
  const [inputSize, setInputSize] = useState<number>(0);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputSize, setOutputSize] = useState<number>(0);
  const [stage, setStage] = useState<Stage>('idle');
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nodeTimings, setNodeTimings] = useState<Record<string, number>>({});

  // 可调参数
  const [targetWidth, setTargetWidth] = useState(600);
  const [watermarkText, setWatermarkText] = useState('Lokvis');
  const [rotateAngle, setRotateAngle] = useState(90);
  const [filterPreset, setFilterPreset] = useState<FilterPreset>('grayscale');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('webp');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let rt: LokvisRuntime | undefined;
    let unsub: (() => void) | undefined;
    (async () => {
      rt = await createLokvis({ plugins: [imageToolsPlugin()] });
      setRuntime(rt);
      // 订阅 node:finished，采集每个节点的执行耗时
      unsub = rt.eventBus.on('node:finished', (e) => {
        setNodeTimings((prev) => ({ ...prev, [e.nodeId]: e.duration }));
      });
    })();
    return () => {
      unsub?.();
      void rt?.cancel('all');
    };
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!runtime || !e.target.files?.length) return;
    try {
      const file = e.target.files[0];
      const id = await runtime.importAsset({ kind: 'file', file });
      setInputId(id);
      setInputSize(file.size);
      if (inputUrl) URL.revokeObjectURL(inputUrl);
      setInputUrl(URL.createObjectURL(file));
      // 重置输出
      setOutputUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setOutputSize(0);
      setResult(null);
      setError(null);
      setStage('idle');
      setNodeTimings({});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStage('failed');
    }
  }

  async function handleRun() {
    if (!runtime || !inputId) return;
    setStage('running');
    setError(null);
    setNodeTimings({});
    setResult(null);
    setOutputUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setOutputSize(0);

    const workflow: Workflow = {
      id: `demo-5step-${Date.now()}`,
      version: '1.0',
      name: '5-Step Pipeline',
      description: 'resize → watermark → rotate → filter → convert',
      author: { id: 'playground', name: 'Playground' },
      category: 'image',
      tags: ['demo'],
      nodes: [
        { id: 'n1', type: 'transform', capability: 'image.resize', params: { width: targetWidth, height: 0, fit: 'inside' } },
        { id: 'n2', type: 'transform', capability: 'image.watermark', params: { text: watermarkText, position: 'bottom-right', opacity: 0.5, fontSize: 24, color: '#ffffff' } },
        { id: 'n3', type: 'transform', capability: 'image.rotate', params: { angle: rotateAngle, background: '#ffffff' } },
        { id: 'n4', type: 'transform', capability: 'image.filter', params: { preset: filterPreset } },
        { id: 'n5', type: 'transform', capability: 'image.convert', params: { format: outputFormat, quality: 90 } },
      ],
      edges: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n3' },
        { from: 'n3', to: 'n4' },
        { from: 'n4', to: 'n5' },
      ],
      inputs: { type: 'image', multiple: false },
      outputs: { type: 'image' },
    };

    try {
      const res = await runtime.run(workflow, [inputId]);
      setResult(res);
      if (res.status === 'completed' && res.outputs.length > 0) {
        const blob = await runtime.exportAsset(res.outputs[0]);
        setOutputSize(blob.size);
        setOutputUrl(URL.createObjectURL(blob));
        setStage('done');
      } else if (res.status === 'failed') {
        setError(res.error ?? 'Workflow failed');
        setStage('failed');
      } else {
        setStage('failed');
        setError(`Unexpected status: ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStage('failed');
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">5-Step Workflow</h1>
        <p className="mt-0.5 text-xs text-zinc-500">resize → watermark → rotate → filter → convert</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* 参数面板 */}
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-3 lg:grid-cols-5">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">Target width (px)</span>
            <input
              type="number"
              min={16}
              max={4000}
              value={targetWidth}
              onChange={(e) => setTargetWidth(Number(e.target.value) || 600)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">Watermark text</span>
            <input
              type="text"
              value={watermarkText}
              onChange={(e) => setWatermarkText(e.target.value)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">Rotate angle (°)</span>
            <input
              type="number"
              min={0}
              max={360}
              value={rotateAngle}
              onChange={(e) => setRotateAngle(Number(e.target.value) || 0)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">Filter preset</span>
            <select
              value={filterPreset}
              onChange={(e) => setFilterPreset(e.target.value as FilterPreset)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="grayscale">grayscale</option>
              <option value="invert">invert</option>
              <option value="sepia">sepia</option>
              <option value="blur">blur</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">Output format</span>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="webp">webp</option>
              <option value="jpeg">jpeg</option>
              <option value="png">png</option>
              <option value="avif">avif</option>
              <option value="gif">gif</option>
            </select>
          </label>
        </div>

        {/* Run 按钮 */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleRun}
            disabled={!runtime || !inputId || stage === 'running'}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {stage === 'running' ? 'Running…' : 'Run Workflow'}
          </button>
          {result && (
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                result.status === 'completed'
                  ? 'bg-emerald-950 text-emerald-400'
                  : 'bg-red-950 text-red-400'
              }`}
            >
              {result.status} · {result.duration}ms
            </span>
          )}
          {error && <span className="text-[10px] text-red-400">{error}</span>}
        </div>

        {/* 节点执行时间线 */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Node Timeline
          </div>
          <div className="flex items-start">
            {NODES.map((node, i) => {
              const done = nodeTimings[node.id] !== undefined;
              const nextDone = i < NODES.length - 1 && nodeTimings[NODES[i + 1].id] !== undefined;
              return (
                <Fragment key={node.id}>
                  <div className="flex w-20 flex-shrink-0 flex-col items-center">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                        done ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-500'
                      }`}
                    >
                      {i + 1}
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-indigo-400">{node.label}</div>
                    <div className="text-[10px] text-zinc-500">
                      {done ? `${nodeTimings[node.id]}ms` : '—'}
                    </div>
                  </div>
                  {i < NODES.length - 1 && (
                    <div
                      className={`mt-3.5 h-0.5 flex-1 ${nextDone ? 'bg-emerald-600' : 'bg-zinc-800'}`}
                    />
                  )}
                </Fragment>
              );
            })}
          </div>
        </div>

        {/* 输入 / 输出对比 */}
        <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
          {/* 输入 */}
          <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-800">
            <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-3 py-2">
              <span className="text-[11px] font-semibold text-zinc-400">
                Input {inputSize > 0 && `· ${(inputSize / 1024).toFixed(1)} KB`}
              </span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] text-indigo-400 hover:text-indigo-300"
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
            </header>
            <div className="flex flex-1 items-center justify-center bg-zinc-950 p-2">
              {inputUrl ? (
                <img src={inputUrl} alt="Input" className="max-h-64 max-w-full object-contain" />
              ) : (
                <p className="text-[11px] text-zinc-600">Select an image to start</p>
              )}
            </div>
          </div>

          {/* 输出 */}
          <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-800">
            <header className="border-b border-zinc-800 bg-zinc-900/50 px-3 py-2">
              <span className="text-[11px] font-semibold text-zinc-400">
                Output {result && `· ${result.status}`}
                {outputSize > 0 && ` · ${(outputSize / 1024).toFixed(1)} KB`}
              </span>
            </header>
            <div className="flex flex-1 items-center justify-center bg-zinc-950 p-2">
              {stage === 'running' && (
                <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-indigo-400" />
                  Processing…
                </div>
              )}
              {stage === 'failed' && (
                <div className="px-3 text-center text-[11px] text-red-400">{error}</div>
              )}
              {outputUrl && (
                <img src={outputUrl} alt="Output" className="max-h-64 max-w-full object-contain" />
              )}
              {stage === 'idle' && !outputUrl && (
                <p className="text-[11px] text-zinc-600">Output will appear here</p>
              )}
            </div>
          </div>
        </div>

        {/* 工作流结果 JSON */}
        {result && (
          <details className="rounded-lg border border-zinc-800 bg-zinc-900/30">
            <summary className="cursor-pointer px-3 py-2 text-[11px] font-medium text-zinc-400">
              Workflow Result JSON
            </summary>
            <pre className="overflow-auto p-3 font-mono text-[10px] text-zinc-300">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
