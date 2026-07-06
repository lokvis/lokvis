/**
 * W7.6 · Watermark Batch 工具页
 *
 * 拖拽多文件 → 配置水印参数 → 并发 4 批量加水印 → 进度/状态显示 + 批量下载。
 * 每个文件 = importAsset + run(image.watermark) + exportAsset + removeAsset(清理)。
 * 文件状态机:pending → processing → done/error。
 *
 * 资产生命周期(review 修复):每个 item 的输入 / 输出 asset 在 export 后立即
 * removeAsset,避免长批量任务累积 OPFS/IDB 占用;outputBlob 已在内存中持有,
 * 下载用内存 blob 即可,无需保留 asset。
 *
 * 取消与清空竞态(review 修复):
 * - processing 中禁用清空,先点取消停止所有运行中任务
 * - 取消:对 processing 的 item 调 runtime.cancel(workflowId) + 标记 cancelled,
 *   pending 的回退为 pending(下一轮 schedule 可重新拉起)
 *
 * 复用 BatchQueue 的并发池调度模式(单次 schedule 合并 patch + scheduleLock 防重入)。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Workflow } from '@lokvis/sdk';
import { UploadBox } from '@/components/toolkit/UploadBox';
import { useLokvisRuntime } from '@/components/toolkit/useLokvisRuntime';
import { downloadBlob, formatBytes } from '@/components/toolkit/download';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

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
  /**
   * 运行时 workflow id(buildWorkflow 生成),供 runtime.cancel 使用。
   * 仅在 processItem 启动后设置;pending 时为 undefined。
   */
  workflowId?: string;
  /** 用户已下载过(用于决定是否还需要保留 outputBlob / 触发 removeAsset) */
  downloaded?: boolean;
}

const CONCURRENCY = 4;

const POSITION_KEYS: Record<Position, string> = {
  'top-left': 'watermark.positionTopLeft',
  'top-right': 'watermark.positionTopRight',
  'center': 'watermark.positionCenter',
  'bottom-left': 'watermark.positionBottomLeft',
  'bottom-right': 'watermark.positionBottomRight',
  'tile': 'watermark.positionTile',
};

const POSITIONS: Position[] = [
  'top-left',
  'top-right',
  'center',
  'bottom-left',
  'bottom-right',
  'tile',
];

const STATUS_KEYS: Record<ItemStatus, string> = {
  pending: 'batch.statusPending',
  processing: 'batch.statusProcessing',
  done: 'batch.statusDone',
  error: 'batch.statusError',
};

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

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
const nextId = () => `wb-${Date.now()}-${(idSeq++).toString(36)}`;

/** 从文件名提取扩展名(小写,无点);无扩展名时回退 png */
function extOf(file: File): string {
  const m = file.name.match(/\.([^.]+)$/);
  return m ? m[1]!.toLowerCase() : 'png';
}

export default function WatermarkBatchTool() {
  return (
    <ErrorBoundary>
      <WatermarkBatchToolContent />
    </ErrorBoundary>
  );
}

function WatermarkBatchToolContent() {
  const lang = useLang();
  const t = useTranslations(lang);
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
  /** 取消标志:为 true 时所有 in-flight processItem 应停止后续步骤 */
  const cancelledRef = useRef(false);

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

  /**
   * 清理 item 在 runtime 中创建的 input/output asset。
   *
   * 调用时机:
   * - processItem 成功 export 后(下载用内存 blob,asset 不再需要)
   * - processItem 失败 / 取消(避免孤儿 input asset)
   * - handleClear / handleCancel(批量清理所有已创建的 asset)
   *
   * 静默失败:asset 可能已被 remove 或 import 失败,忽略 not-found 错误。
   */
  const cleanupItemAssets = useCallback(async (item: QueueItem) => {
    const rt = runtimeRef.current;
    if (!rt) return;
    // inputAssetId 未在 QueueItem 中存储 —— importAsset 返回值在 processItem 闭包内
    // 这里通过 outputAssetId 间接清理;input asset 由 output 的 history 链不强引用,
    // 但为彻底防泄漏,processItem 内部已记录并清理(见下方逻辑)
    // 注:item.workflowId 可用于 disposeWorkflow(同时回收 outputs + history)
    if (item.workflowId) {
      try {
        await rt.disposeWorkflow(item.workflowId);
      } catch {
        /* 静默 */
      }
    }
  }, []);

  const processItem = useCallback(
    async (item: QueueItem) => {
      const rt = runtimeRef.current;
      if (!rt) return;
      // 取消检查:cancelledRef 在 handleCancel / handleClear 中置 true
      if (cancelledRef.current) {
        patchItem(item.id, { status: 'pending' });
        return;
      }
      const workflow = buildWorkflow(item);
      patchItem(item.id, { workflowId: workflow.id });
      let inputAssetId: string | undefined;
      try {
        inputAssetId = await rt.importAsset({ kind: 'file', file: item.file });
        if (cancelledRef.current) {
          // 取消:清理已导入的 input asset,回退状态
          if (inputAssetId) await rt.removeAsset(inputAssetId).catch(() => {});
          // disposeWorkflow:确保即使部分 run 启动也清理 stack(此处通常未启动)
          await rt.disposeWorkflow(workflow.id).catch(() => {});
          patchItem(item.id, { status: 'pending', workflowId: undefined });
          return;
        }
        const result = await rt.run(workflow, [inputAssetId]);
        if (cancelledRef.current) {
          // 取消:disposeWorkflow 会 cancel 运行中的 workflow + reset stack
          // (stack.reset 触发 onEvict 回收 history entries 中的 output assets),
          // 再单独 removeAsset input(不在 history 链中)
          await rt.disposeWorkflow(workflow.id).catch(() => {});
          await rt.removeAsset(inputAssetId).catch(() => {});
          patchItem(item.id, { status: 'pending', workflowId: undefined });
          return;
        }
        if (result.status === 'completed' && result.outputs[0]) {
          const blob = await rt.exportAsset(result.outputs[0]);
          patchItem(item.id, {
            status: 'done',
            outputBlob: blob,
            outputSize: blob.size,
          });
          // 资产清理:outputBlob 已在内存中,移除 input + output asset
          // 同时 disposeWorkflow 回收 history(避免 historyStacks Map 泄漏)
          await rt.removeAsset(inputAssetId).catch(() => {});
          await rt.removeAsset(result.outputs[0]).catch(() => {});
          await rt.disposeWorkflow(workflow.id).catch(() => {});
        } else {
          patchItem(item.id, { status: 'error', error: result.error ?? t('watermark.batch.processFailed') });
          // 失败也清理 input + history
          await rt.removeAsset(inputAssetId).catch(() => {});
          await rt.disposeWorkflow(workflow.id).catch(() => {});
        }
      } catch (err) {
        patchItem(item.id, {
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
        // 异常路径同样清理已创建的资产
        if (inputAssetId) await rt.removeAsset(inputAssetId).catch(() => {});
        await rt.disposeWorkflow(workflow.id).catch(() => {});
      } finally {
        scheduleRef.current();
      }
    },
    [buildWorkflow, patchItem, t]
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
      setError(t('watermark.batch.runtimeNotReady'));
      return;
    }
    if (!text) {
      setError(t('watermark.batch.textRequiredShort'));
      return;
    }
    setError(null);
    // 重置取消标志(新一轮处理)
    cancelledRef.current = false;
    schedule();
  }, [ready, text, schedule, t]);

  /**
   * 取消:对所有 processing 的 item 调 runtime.cancel(workflowId),
   * 并置 cancelledRef 让 in-flight processItem 在下一个 await 点退出。
   * pending 的 item 保持 pending(用户可再次点"全部加水印"重启)。
   */
  const handleCancel = useCallback(async () => {
    const rt = runtimeRef.current;
    if (!rt) return;
    cancelledRef.current = true;
    const processing = queueRef.current.filter((i) => i.status === 'processing' && i.workflowId);
    await Promise.allSettled(processing.map((i) => rt.cancel(i.workflowId!)));
  }, []);

  /**
   * 清空:processing 中禁用(避免与 in-flight patchItem 竞态)。
   * 已完成 / 失败 / pending 的 item 直接清空,并清理已创建的资产。
   */
  const handleClear = useCallback(async () => {
    // 防御:有 processing 时不允许清空(按钮也 disabled,双保险)
    if (queueRef.current.some((i) => i.status === 'processing')) return;
    // 清理所有仍有 workflowId 的 item(已 import 但未完成清理的)
    const toCleanup = queueRef.current.filter((i) => i.workflowId);
    await Promise.allSettled(toCleanup.map((i) => cleanupItemAssets(i)));
    commit([]);
    setExpandedErrorId(null);
  }, [commit, cleanupItemAssets]);

  const handleDownloadOne = useCallback(
    (item: QueueItem) => {
      if (!item.outputBlob) return;
      const base = item.file.name.replace(/\.[^.]+$/, '') || 'image';
      downloadBlob(item.outputBlob, `${base}.${item.ext}`);
      patchItem(item.id, { downloaded: true });
    },
    [patchItem]
  );

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
      // 批量下载完成后,标记所有 done item 为 downloaded
      commit(
        queueRef.current.map((it) =>
          it.status === 'done' ? { ...it, downloaded: true } : it
        )
      );
    } finally {
      setBatchDownloading(false);
    }
  }, [commit]);

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
        <h1 className="text-sm font-semibold text-zinc-100">{t('watermark.batch.title')}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{t('watermark.batch.subtitle')}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* 参数面板 */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[10px] font-medium text-zinc-500">{t('watermark.textLabel')}</span>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">{t('watermark.positionLabel')}</span>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value as Position)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p}>{t(POSITION_KEYS[p])}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">{t('watermark.opacityLabel')}:{opacity.toFixed(2)}</span>
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
            <span className="text-[10px] font-medium text-zinc-500">{t('watermark.fontSizeLabel')}</span>
            <input
              type="number"
              min={1}
              value={fontSize}
              onChange={(e) => setFontSize(Math.max(1, Number(e.target.value)))}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">{t('watermark.colorLabel')}</span>
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
            {processing ? t('watermark.batch.processing') : hasPending ? t('watermark.batch.processAll') : t('watermark.batch.completed')}
          </button>
          {processing && (
            <button
              onClick={handleCancel}
              className="rounded-lg border border-amber-700 px-4 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-950/40"
            >
              {t('common.cancel')}
            </button>
          )}
          <button
            onClick={handleClear}
            disabled={total === 0 || processing}
            title={processing ? t('watermark.batch.cancelFirst') : undefined}
            className="rounded-lg border border-zinc-700 px-4 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('common.clear')}
          </button>
        </div>

        {/* 上传区 */}
        <UploadBox multiple onFiles={handleFiles} hint={t('watermark.batch.uploadHint')} />

        {initError && <p className="text-xs text-red-400">{t('common.initFailedPrefix')}{initError}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
        {textEmpty && total > 0 && (
          <p className="text-xs text-amber-400">{t('watermark.batch.textRequiredAfter')}</p>
        )}

        {/* 队列列表 */}
        <div className="flex flex-col gap-2">
          {total === 0 ? (
            <p className="py-8 text-center text-xs text-zinc-600">{t('watermark.batch.queueEmpty')}</p>
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
                          {isExpanded ? t('watermark.batch.collapse') : t('watermark.batch.error')}
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
                {t('watermark.batch.progressPrefix')}{finished}{t('watermark.batch.progressMiddle')}{total}{t('watermark.batch.progressSuffix')}{doneCount}{t('watermark.batch.progressEnd')}
              </span>
              <button
                onClick={handleDownloadAll}
                disabled={doneCount === 0 || batchDownloading}
                className="rounded-lg border border-zinc-700 px-4 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {batchDownloading ? t('watermark.batch.downloading') : t('watermark.batch.downloadAll')}
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
