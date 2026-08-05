/**
 * W5.6 · Batch Queue 工具页
 *
 * 拖拽多文件 → 队列 UI → runtime.batch 调度处理 → 进度/状态显示。
 * 每个文件 = importAsset + run(image.compress) + exportAsset。
 * 文件状态机:pending → processing → done/error。
 *
 * FO-04:调度委托 runtime.batch(BatchProcessor)——并发随 plan 取值
 * (free=FREE_CONCURRENCY / pro=PRO_CONCURRENCY)、免费批量上限由 enqueue
 * 抛 BatchLimitExceededError 强制,不再组件自查;逐文件状态经
 * useBatchRunner 的 batch:* 事件订阅驱动。
 */
import { useCallback, useState } from 'react';
import type { Workflow, Plan } from '@lokvis/sdk';
import { formatBytes } from '@lokvis/runtime';
import { downloadBlob } from '@lokvis/embed-kit';
import { UploadBox } from '@/components/toolkit/UploadBox';
import { useLokvisRuntime } from '@/components/toolkit/useLokvisRuntime';
import {
  useBatchRunner,
  type BatchRunnerItem,
  type BatchRunnerStatus,
} from '@/components/toolkit/useBatchRunner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PlanToggle } from '@/components/PlanToggle';
import { UpgradeDialog, type UpgradeReason } from '@/components/UpgradeDialog';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';
import { sleep } from '@/utils/sleep';

type Format = 'webp' | 'jpeg' | 'png';

const STATUS_KEYS: Record<BatchRunnerStatus, string> = {
  pending: 'batch.statusPending',
  processing: 'batch.statusProcessing',
  done: 'batch.statusDone',
  error: 'batch.statusError',
};

// 状态徽章
function StatusBadge({ status }: { status: BatchRunnerStatus }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const clsMap: Record<BatchRunnerStatus, string> = {
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
  // G1:plan 模拟(默认 free)。切换时 useLokvisRuntime 重建 runtime,触发四环门控。
  const [plan, setPlan] = useState<Plan>('free');
  const { runtime, ready, error: initError } = useLokvisRuntime({ plan });

  const [format, setFormat] = useState<Format>('webp');
  const [quality, setQuality] = useState(80);
  const [error, setError] = useState<string | null>(null);
  const [batchDownloading, setBatchDownloading] = useState(false);
  // 错误详情可见性:记录当前展开查看错误的 item id
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  // G1:升级提示状态(null=不显示,UpgradeReason=显示对应文案)
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(null);

  const buildWorkflow = useCallback(
    (item: BatchRunnerItem): Workflow => ({
      id: `batch-${item.id}`,
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

  const { queue, processing, addFiles, processAll, clear } = useBatchRunner({
    runtime,
    buildWorkflow,
  });

  const handleFiles = useCallback(
    (files: File[]) => {
      addFiles(files);
      setError(null);
    },
    [addFiles]
  );

  const handleProcessAll = useCallback(async () => {
    if (!ready) {
      setError(t('batch.runtimeNotReady'));
      return;
    }
    setError(null);
    const result = await processAll();
    // G1:免费批量上限由 runtime.batch.enqueue 抛错强制,UI 据此弹升级提示
    if (result === 'limit') setUpgradeReason('batchLimit');
  }, [processAll, ready, t]);

  const handleClear = useCallback(async () => {
    await clear();
  }, [clear]);

  // 单个下载:用选中格式作为扩展名
  const handleDownloadOne = useCallback(
    (item: BatchRunnerItem) => {
      if (!item.outputBlob) return;
      const base = item.file.name.replace(/\.[^.]+$/, '') || 'image';
      downloadBlob(item.outputBlob, `${base}.${format}`);
    },
    [format]
  );

  // 全部下载:逐个触发,间隔 150ms 避免浏览器拦截
  const handleDownloadAll = useCallback(async () => {
    const done = queue.filter((i) => i.status === 'done' && i.outputBlob);
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
  }, [format, queue]);

  // 派生统计
  const total = queue.length;
  const finished = queue.filter((i) => i.status === 'done' || i.status === 'error').length;
  const doneCount = queue.filter((i) => i.status === 'done').length;
  const hasPending = queue.some((i) => i.status === 'pending');
  const pct = total === 0 ? 0 : (finished / total) * 100;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-semibold text-zinc-100">{t('batch.title')}</h1>
            <p className="mt-0.5 text-xs text-zinc-500">{t('batch.subtitle')}</p>
          </div>
          {/* G1:Plan 模拟切换器(测试四环门控) */}
          <PlanToggle plan={plan} onChange={setPlan} />
        </div>
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
            onClick={() => void handleProcessAll()}
            disabled={!ready || !hasPending || processing}
            className="mx-auto rounded-lg bg-indigo-600 px-24 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {processing ? t('batch.processing') : hasPending ? t('batch.processAll') : t('batch.completed')}
          </button>
          <button
            onClick={() => void handleClear()}
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
                onClick={() => void handleDownloadAll()}
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

      {/* G1:升级提示对话框(Free 用户触达 batch 上限时弹出) */}
      <UpgradeDialog
        reason={upgradeReason}
        onClose={() => setUpgradeReason(null)}
      />
    </div>
  );
}
