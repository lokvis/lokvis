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
import { UploadBox } from '@/components/toolkit/UploadBox';
import { useLokvisRuntime } from '@/components/toolkit/useLokvisRuntime';
import { downloadBlob, formatBytes } from '@/components/toolkit/download';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

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

const STATUS_KEYS: Record<ItemStatus, string> = {
  pending: 'batch.statusPending',
  processing: 'batch.statusProcessing',
  done: 'batch.statusDone',
  error: 'batch.statusError',
};

// 延迟工具,避免浏览器拦截多下载
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// 状态徽章
function StatusBadge({ status }: { status: ItemStatus }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const clsMap: Record<ItemStatus, string> = {
    pending: 'bg-zinc-800 text-zinc-400',
    processing: 'bg-indigo-600/20 text-indigo-300',
    done: 'bg-emerald-600/20 text-emerald-300',
    error: 'bg-red-600/20 text-red-300',
  };
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${clsMap[status]}`}>
      {t(STATUS_KEYS[status])}
    </span>
  );
}

let idSeq = 0;
const nextId = () => `q-${Date.now()}-${(idSeq++).toString(36)}`;

export default function BatchQueue() {
  return (
    <ErrorBoundary>
      <BatchQueueContent />
    </ErrorBoundary>
  );
}

function BatchQueueContent() {
  const lang = useLang();
  const t = useTranslations(lang);
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
  // 错误详情可见性:记录当前展开查看错误的 item id
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);

  // 调度器引用(打破 processItem ↔ schedule 的循环依赖)
  const scheduleRef = useRef<() => void>(() => {});

  // W21.6: 跟踪进行中的 workflow id + 组件挂载状态,unmount 时 cancel 避免后台泄漏
  const processingWfIdsRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);

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

  // 构造 compress workflow(id 由调用方传入,便于 processItem 提前登记到 cancel 跟踪)
  const buildWorkflow = useCallback(
    (workflowId: string): Workflow => ({
      id: workflowId,
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
      // W21.6: workflowId 提前生成并登记,unmount 时可统一 cancel
      const workflowId = `batch-${item.id}-${Date.now()}`;
      processingWfIdsRef.current.add(workflowId);
      try {
        const assetId = await rt.importAsset({ kind: 'file', file: item.file });
        // 已 unmount:不再 patch state,也不再调度后续(避免泄漏 + 无效更新)
        if (!mountedRef.current) return;
        const result = await rt.run(buildWorkflow(workflowId), [assetId]);
        if (!mountedRef.current) return;
        if (result.status === 'completed' && result.outputs[0]) {
          const blob = await rt.exportAsset(result.outputs[0]);
          if (!mountedRef.current) return;
          patchItem(item.id, { status: 'done', outputBlob: blob, outputSize: blob.size });
        } else {
          patchItem(item.id, { status: 'error', error: result.error ?? t('batch.processFailed') });
        }
      } catch (err) {
        if (!mountedRef.current) return;
        patchItem(item.id, {
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        processingWfIdsRef.current.delete(workflowId);
        if (mountedRef.current) scheduleRef.current();
      }
    },
    [buildWorkflow, patchItem, t]
  );

  // 并发池调度:补满到 CONCURRENCY,用原子化补满避免竞态。
  // 竞态修复(#2):原版 schedule 读 running 计数后循环 patchItem,
  // 若两个 processItem 几乎同时完成并都调 schedule,会读到相同的 running 快照,
  // 双方都补满 slots 导致实际并发超过 CONCURRENCY。
  // 修复:单次 schedule 内一次性把所有 pending→processing 的 patch 合并提交,
  // 不依赖多次 patchItem 间的中间状态;并加 scheduleLock 防止重入。
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
      // 一次性合并 patch:把所有 toStart 的状态改为 processing
      const startIds = new Set(toStart.map((i) => i.id));
      const next = items.map((it) =>
        startIds.has(it.id) ? { ...it, status: 'processing' as ItemStatus } : it
      );
      commit(next);
      // 启动处理(异步,不阻塞 schedule)
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

  // W21.6: unmount 时 cancel 所有进行中 workflow,防止 fire-and-forget 的
  // processItem 在后台继续执行(rt.run 持有 Worker + 内存,泄漏风险 P0)
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const rt = runtimeRef.current;
      if (!rt) return;
      for (const wfId of processingWfIdsRef.current) {
        // cancel 是 idempotent 的:不存在的 workflowId 安全无副作用
        void rt.cancel(wfId).catch(() => {});
      }
      processingWfIdsRef.current.clear();
    };
  }, []);

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
      setError(t('batch.runtimeNotReady'));
      return;
    }
    setError(null);
    schedule();
  }, [ready, schedule, t]);

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
        <h1 className="text-sm font-semibold text-zinc-100">{t('batch.title')}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{t('batch.subtitle')}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* 参数面板 */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">{t('batch.format')}</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as Format)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="webp">{t('batch.formatWebp')}</option>
              <option value="jpeg">{t('batch.formatJpeg')}</option>
              <option value="png">{t('batch.formatPng')}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">{t('batch.qualityPrefix')}{quality}</span>
            <input
              type="range"
              min={1}
              max={100}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="h-1.5 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-indigo-500"
            />
          </label>
        </div>

        {/* 操作按钮:居中处理 + 右侧清空(与其他工具页布局一致) */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleProcessAll}
            disabled={!ready || !hasPending || processing}
            className="mx-auto rounded-lg bg-indigo-600 px-24 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {processing ? t('batch.processing') : hasPending ? t('batch.processAll') : t('batch.completed')}
          </button>
          <button
            onClick={handleClear}
            disabled={total === 0}
            className="rounded-lg border border-zinc-700 px-4 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('batch.clear')}
          </button>
        </div>

        {/* 上传区 */}
        <UploadBox multiple onFiles={handleFiles} hint={t('batch.uploadHint')} />

        {initError && <p className="text-xs text-red-400">{t('common.initFailedPrefix')}{initError}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* 队列列表 */}
        <div className="flex flex-col gap-2">
          {total === 0 ? (
            <p className="py-8 text-center text-xs text-zinc-600">{t('batch.queueEmpty')}</p>
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
                          {t('common.download')}
                        </button>
                      ) : item.status === 'error' ? (
                        <button
                          onClick={() => setExpandedErrorId(isExpanded ? null : item.id)}
                          className="text-[10px] text-red-400 hover:text-red-300"
                        >
                          {isExpanded ? t('batch.collapse') : t('batch.error')}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {/* 错误详情展开区(#10) */}
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
                {t('batch.progressPrefix')}{finished}{t('batch.progressMiddle')}{total}{t('batch.progressSuffix')}{doneCount}{t('batch.progressEnd')}
              </span>
              <button
                onClick={handleDownloadAll}
                disabled={doneCount === 0 || batchDownloading}
                className="rounded-lg border border-zinc-700 px-4 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {batchDownloading ? t('batch.downloading') : t('batch.downloadAll')}
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
