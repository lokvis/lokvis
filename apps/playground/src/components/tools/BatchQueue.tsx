/**
 * W5.6 · Batch Queue 工具页
 *
 * 拖拽多文件 → 队列 UI → 并发 4 处理 → 进度/状态显示。
 * 每个文件 = importAsset + run(image.compress) + exportAsset。
 * 文件状态机:pending → processing → done/error。
 *
 * 并发池:维护一个 queueRef(源) + state(渲染),每次有 done/error 就补满到 4。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Workflow } from '@lokvis/sdk';
import { UploadBox } from '../toolkit/UploadBox';
import { useLokvisRuntime } from '../toolkit/useLokvisRuntime';
import { downloadBlob, formatBytes } from '../toolkit/download';

type Format = 'webp' | 'jpeg' | 'png';
type ItemStatus = 'pending' | 'processing' | 'done' | 'error';

interface QueueItem {
  id: string;
  file: File;
  inputSize: number;
  status: ItemStatus;
  outputBlob?: Blob;
  outputSize?: number;
  error?: string;
}

const CONCURRENCY = 4;

// 延迟工具,避免浏览器拦截多下载
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// 状态徽章
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
const nextId = () => `q-${Date.now()}-${(idSeq++).toString(36)}`;

export default function BatchQueue() {
  const { runtime, ready, error: initError } = useLokvisRuntime();
  const runtimeRef = useRef(runtime);
  useEffect(() => {
    runtimeRef.current = runtime;
  }, [runtime]);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const queueRef = useRef<QueueItem[]>([]);
  const [format, setFormat] = useState<Format>('webp');
  const [quality, setQuality] = useState(80);
  const [error, setError] = useState<string | null>(null);
  const [batchDownloading, setBatchDownloading] = useState(false);

  // 调度器引用(打破 processItem ↔ schedule 的循环依赖)
  const scheduleRef = useRef<() => void>(() => {});

  // ref 与 state 同步更新:ref 为源,触发 re-render
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

  // 构造 compress workflow(每次 run 唯一 id,便于 cancel/history)
  const buildWorkflow = useCallback(
    (item: QueueItem): Workflow => ({
      id: `batch-${item.id}-${Date.now()}`,
      version: '1.0',
      name: 'Batch Compress',
      description: 'Batch compress images',
      author: { id: 'playground', name: 'Playground' },
      category: 'image',
      tags: [],
      nodes: [
        { id: 'n1', type: 'transform', capability: 'image.compress', params: { format, quality } },
      ],
      edges: [],
      inputs: { type: 'image', multiple: true },
      outputs: { type: 'image' },
    }),
    [format, quality]
  );

  // 处理单个文件:import → run → export,完成后调度下一个
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

  // 并发池调度:补满到 CONCURRENCY,每个完成后递归调度下一个
  const schedule = useCallback(() => {
    const rt = runtimeRef.current;
    if (!rt) return;
    const items = queueRef.current;
    const running = items.filter((i) => i.status === 'processing').length;
    const slots = CONCURRENCY - running;
    if (slots <= 0) return;
    const pending = items.filter((i) => i.status === 'pending').slice(0, slots);
    for (const item of pending) {
      patchItem(item.id, { status: 'processing' });
      void processItem(item);
    }
  }, [patchItem, processItem]);

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
    setError(null);
    schedule();
  }, [ready, schedule]);

  const handleClear = useCallback(() => {
    commit([]);
  }, [commit]);

  // 单个下载:用选中格式作为扩展名
  const handleDownloadOne = useCallback(
    (item: QueueItem) => {
      if (!item.outputBlob) return;
      const base = item.file.name.replace(/\.[^.]+$/, '') || 'image';
      downloadBlob(item.outputBlob, `${base}.${format}`);
    },
    [format]
  );

  // 全部下载:逐个触发,间隔 150ms 避免浏览器拦截
  const handleDownloadAll = useCallback(async () => {
    const done = queueRef.current.filter((i) => i.status === 'done' && i.outputBlob);
    if (done.length === 0) return;
    setBatchDownloading(true);
    try {
      for (const item of done) {
        const base = item.file.name.replace(/\.[^.]+$/, '') || 'image';
        downloadBlob(item.outputBlob!, `${base}.${format}`);
        await sleep(150);
      }
    } finally {
      setBatchDownloading(false);
    }
  }, [format]);

  // 派生统计
  const total = queue.length;
  const finished = queue.filter((i) => i.status === 'done' || i.status === 'error').length;
  const doneCount = queue.filter((i) => i.status === 'done').length;
  const hasPending = queue.some((i) => i.status === 'pending');
  const processing = queue.some((i) => i.status === 'processing');
  const pct = total === 0 ? 0 : (finished / total) * 100;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">Batch Queue</h1>
        <p className="mt-0.5 text-xs text-zinc-500">image.compress · 批量并发处理(并发 4)</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* 参数面板 */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">输出格式</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as Format)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="webp">WebP(推荐)</option>
              <option value="jpeg">JPEG</option>
              <option value="png">PNG(无损)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">质量:{quality}</span>
            <input
              type="range"
              min={1}
              max={100}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="h-1.5 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-indigo-500"
            />
          </label>
          <div className="flex items-end">
            <button
              onClick={handleProcessAll}
              disabled={!ready || !hasPending}
              className="w-full rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processing && !hasPending ? '处理中…' : '全部处理'}
            </button>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleClear}
              disabled={total === 0}
              className="w-full rounded-lg border border-zinc-700 px-4 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              清空
            </button>
          </div>
        </div>

        {/* 上传区 */}
        <UploadBox multiple onFiles={handleFiles} hint="选择或拖入多张图片(批量入队)" />

        {initError && <p className="text-xs text-red-400">初始化失败:{initError}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* 队列列表 */}
        <div className="flex flex-col gap-2">
          {total === 0 ? (
            <p className="py-8 text-center text-xs text-zinc-600">队列为空,请上传文件</p>
          ) : (
            queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 py-2"
              >
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
                    <span className="text-[10px] text-red-400" title={item.error}>
                      查看错误
                    </span>
                  ) : null}
                </div>
              </div>
            ))
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
