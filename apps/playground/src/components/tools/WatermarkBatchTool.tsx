/**
 * W7.6 · Watermark Batch 工具页
 *
 * 拖拽多文件 → 配置水印参数 → 并发 4 批量加水印 → 进度/状态显示 + 批量下载。
 * 每个文件 = importAsset + run(image.watermark) + exportAsset。
 * 文件状态机:pending → processing → done/error。
 *
 * 复用 BatchQueue 的并发池调度模式(单次 schedule 合并 patch + scheduleLock 防重入)。
 * 与 BatchQueue 的区别:
 * - 参数为水印(text/position/opacity/fontSize/color)而非压缩(format/quality)
 * - 水印保留原图格式,下载扩展名取自输入文件
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Workflow } from '@lokvis/sdk';
import { UploadBox } from '../toolkit/UploadBox';
import { useLokvisRuntime } from '../toolkit/useLokvisRuntime';
import { downloadBlob, formatBytes } from '../toolkit/download';

type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'tile';
type ItemStatus = 'pending' | 'processing' | 'done' | 'error';

interface QueueItem {
  id: string;
  file: File;
  inputSize: number;
  status: ItemStatus;
  outputBlob?: Blob;
  outputSize?: number;
  /** 输出扩展名(取自输入文件,水印保留原格式) */
  ext: string;
  error?: string;
}

const CONCURRENCY = 4;

const POSITIONS: { value: Position; label: string }[] = [
  { value: 'top-left', label: '左上' },
  { value: 'top-right', label: '右上' },
  { value: 'center', label: '居中' },
  { value: 'bottom-left', label: '左下' },
  { value: 'bottom-right', label: '右下' },
  { value: 'tile', label: '平铺' },
];

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function StatusBadge({ status }: { status: ItemStatus }) {
  const map: Record<ItemStatus, { label: string; cls: string }> = {
    pending: { label: '待处理', cls: 'bg-zinc-800 text-zinc-400' },
    processing: { label: '处理中', cls: 'bg-indigo-600/20 text-indigo-300' },
    done: { label: '已完成', cls: 'bg-emerald-600/20 text-emerald-300' },
    error: { label: '失败', cls: 'bg-red-600/20 text-red-300' },
  };
  const s = map[status];
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

let idSeq = 0;
const nextId = () => `wb-${Date.now()}-${(idSeq++).toString(36)}`;

/** 从文件名提取扩展名(小写,无点);无扩展名时回退 png */
function extOf(file: File): string {
  const m = file.name.match(/\.([^.]+)$/);
  return m ? m[1]!.toLowerCase() : 'png';
}

export default function WatermarkBatchTool() {
  const { runtime, ready, error: initError } = useLokvisRuntime();
  const runtimeRef = useRef(runtime);
  useEffect(() => {
    runtimeRef.current = runtime;
  }, [runtime]);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const queueRef = useRef<QueueItem[]>([]);
  const [text, setText] = useState('Lokvis');
  const [position, setPosition] = useState<Position>('bottom-right');
  const [opacity, setOpacity] = useState(0.8);
  const [fontSize, setFontSize] = useState(24);
  const [color, setColor] = useState('#ffffff');
  const [error, setError] = useState<string | null>(null);
  const [batchDownloading, setBatchDownloading] = useState(false);
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);

  const scheduleRef = useRef<() => void>(() => {});

  const commit = useCallback((next: QueueItem[]) => {
    queueRef.current = next;
    setQueue(next);
  }, []);

  const patchItem = useCallback(
    (id: string, patch: Partial<QueueItem>) => {
      commit(queueRef.current.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    },
    [commit]
  );

  // 构造 watermark workflow(每次 run 唯一 id,便于 cancel/history)
  const buildWorkflow = useCallback(
    (item: QueueItem): Workflow => ({
      id: `wmark-batch-${item.id}-${Date.now()}`,
      version: '1.0',
      name: 'Watermark Batch',
      description: 'Batch apply text watermark',
      author: { id: 'playground', name: 'Playground' },
      category: 'image',
      tags: [],
      nodes: [
        {
          id: 'n1',
          type: 'transform',
          capability: 'image.watermark',
          params: { text, position, opacity, fontSize, color },
        },
      ],
      edges: [],
      inputs: { type: 'image', multiple: true },
      outputs: { type: 'image' },
    }),
    [text, position, opacity, fontSize, color]
  );

  const processItem = useCallback(
    async (item: QueueItem) => {
      const rt = runtimeRef.current;
      if (!rt) return;
      try {
        const assetId = await rt.importAsset({ kind: 'file', file: item.file });
        const result = await rt.run(buildWorkflow(item), [assetId]);
        if (result.status === 'completed' && result.outputs[0]) {
          const blob = await rt.exportAsset(result.outputs[0]);
          patchItem(item.id, { status: 'done', outputBlob: blob, outputSize: blob.size });
        } else {
          patchItem(item.id, { status: 'error', error: result.error ?? '处理失败' });
        }
      } catch (err) {
        patchItem(item.id, {
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        scheduleRef.current();
      }
    },
    [buildWorkflow, patchItem]
  );

  // 并发池调度:单次 schedule 合并 patch + scheduleLock 防重入(同 BatchQueue)
  const scheduleLock = useRef(false);
  const schedule = useCallback(() => {
    if (scheduleLock.current) return;
    const rt = runtimeRef.current;
    if (!rt) return;
    scheduleLock.current = true;
    try {
      const items = queueRef.current;
      const running = items.filter((i) => i.status === 'processing').length;
      const slots = CONCURRENCY - running;
      if (slots <= 0) return;
      const toStart = items.filter((i) => i.status === 'pending').slice(0, slots);
      if (toStart.length === 0) return;
      const startIds = new Set(toStart.map((i) => i.id));
      const next = items.map((it) =>
        startIds.has(it.id) ? { ...it, status: 'processing' as ItemStatus } : it
      );
      commit(next);
      for (const item of toStart) {
        void processItem(item);
      }
    } finally {
      scheduleLock.current = false;
    }
  }, [commit, processItem]);

  useEffect(() => {
    scheduleRef.current = schedule;
  }, [schedule]);

  const handleFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const newItems: QueueItem[] = files.map((file) => ({
        id: nextId(),
        file,
        inputSize: file.size,
        status: 'pending',
        ext: extOf(file),
      }));
      commit([...queueRef.current, ...newItems]);
      setError(null);
    },
    [commit]
  );

  const handleProcessAll = useCallback(() => {
    if (!ready) {
      setError('Runtime 未就绪');
      return;
    }
    if (!text) {
      setError('请输入水印文字');
      return;
    }
    setError(null);
    schedule();
  }, [ready, text, schedule]);

  const handleClear = useCallback(() => {
    commit([]);
  }, [commit]);

  const handleDownloadOne = useCallback((item: QueueItem) => {
    if (!item.outputBlob) return;
    const base = item.file.name.replace(/\.[^.]+$/, '') || 'image';
    downloadBlob(item.outputBlob, `${base}.${item.ext}`);
  }, []);

  const handleDownloadAll = useCallback(async () => {
    const done = queueRef.current.filter((i) => i.status === 'done' && i.outputBlob);
    if (done.length === 0) return;
    setBatchDownloading(true);
    try {
      for (const item of done) {
        const base = item.file.name.replace(/\.[^.]+$/, '') || 'image';
        downloadBlob(item.outputBlob!, `${base}.${item.ext}`);
        await sleep(150);
      }
    } finally {
      setBatchDownloading(false);
    }
  }, []);

  const total = queue.length;
  const finished = queue.filter((i) => i.status === 'done' || i.status === 'error').length;
  const doneCount = queue.filter((i) => i.status === 'done').length;
  const hasPending = queue.some((i) => i.status === 'pending');
  const processing = queue.some((i) => i.status === 'processing');
  const pct = total === 0 ? 0 : (finished / total) * 100;
  const textEmpty = !text;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">Watermark Batch</h1>
        <p className="mt-0.5 text-xs text-zinc-500">image.watermark · 批量加水印(并发 4)</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* 参数面板 */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[10px] font-medium text-zinc-500">水印文字</span>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">位置</span>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value as Position)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              {POSITIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">透明度:{opacity.toFixed(2)}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="h-1.5 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-indigo-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">字号(px)</span>
            <input
              type="number"
              min={1}
              value={fontSize}
              onChange={(e) => setFontSize(Math.max(1, Number(e.target.value)))}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">颜色</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-[26px] w-full cursor-pointer rounded border border-zinc-700 bg-zinc-950 p-0.5"
            />
          </label>
        </div>

        {/* 操作栏 */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleProcessAll}
            disabled={!ready || !hasPending || processing || textEmpty}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {processing ? '处理中…' : hasPending ? '全部加水印' : '已完成'}
          </button>
          <button
            onClick={handleClear}
            disabled={total === 0}
            className="rounded-lg border border-zinc-700 px-4 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            清空
          </button>
        </div>

        {/* 上传区 */}
        <UploadBox multiple onFiles={handleFiles} hint="选择或拖入多张图片(批量入队)" />

        {initError && <p className="text-xs text-red-400">初始化失败:{initError}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
        {textEmpty && total > 0 && (
          <p className="text-xs text-amber-400">请输入水印文字后再处理</p>
        )}

        {/* 队列列表 */}
        <div className="flex flex-col gap-2">
          {total === 0 ? (
            <p className="py-8 text-center text-xs text-zinc-600">队列为空,请上传文件</p>
          ) : (
            queue.map((item) => {
              const isExpanded = expandedErrorId === item.id;
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-zinc-200">{item.file.name}</p>
                      <p className="text-[10px] text-zinc-500">{formatBytes(item.inputSize)}</p>
                    </div>
                    <StatusBadge status={item.status} />
                    <div className="w-20 text-right text-[10px] text-zinc-400">
                      {item.outputSize != null
                        ? formatBytes(item.outputSize)
                        : item.status === 'error'
                          ? '—'
                          : ''}
                    </div>
                    <div className="w-16 text-right">
                      {item.status === 'done' && item.outputBlob ? (
                        <button
                          onClick={() => handleDownloadOne(item)}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300"
                        >
                          下载
                        </button>
                      ) : item.status === 'error' ? (
                        <button
                          onClick={() => setExpandedErrorId(isExpanded ? null : item.id)}
                          className="text-[10px] text-red-400 hover:text-red-300"
                        >
                          {isExpanded ? '收起' : '错误'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {isExpanded && item.error && (
                    <div className="mt-1 rounded bg-red-950/40 px-2 py-1.5 text-[10px] text-red-300">
                      {item.error}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 全部下载 + 进度条 */}
        {total > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500">
                已完成 {finished} / {total}({doneCount} 成功)
              </span>
              <button
                onClick={handleDownloadAll}
                disabled={doneCount === 0 || batchDownloading}
                className="rounded-lg border border-zinc-700 px-4 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {batchDownloading ? '下载中…' : '全部下载'}
              </button>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-indigo-600 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
