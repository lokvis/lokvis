/**
 * W7.6 · Watermark Batch 工具页
 *
 * 拖拽多文件 → 配置水印参数 → runtime.batch 批量加水印 → 进度/状态显示 + 批量下载。
 * 每个文件 = importAsset + run(image.watermark) + exportAsset + 资产清理。
 * 文件状态机:pending → processing → done/error。
 *
 * FO-04:调度委托 runtime.batch(BatchProcessor),经 useBatchRunner 共享 hook
 * 复用(消除与 BatchQueue 的第二份手写并发池副本);并发随 plan 取值、
 * 资产生命周期清理、取消语义(被取消项回退 pending)均由 hook 统一提供。
 */
import { useCallback, useState } from 'react';
import type { Workflow } from '@lokvis/sdk';
import { UploadBox } from '@/components/toolkit/UploadBox';
import { useLokvisRuntime } from '@/components/toolkit/useLokvisRuntime';
import {
  useBatchRunner,
  type BatchRunnerItem,
  type BatchRunnerStatus,
} from '@/components/toolkit/useBatchRunner';
import { downloadBlob } from '@lokvis/embed-kit';
import { formatBytes } from '@lokvis/runtime';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';
import { sleep } from '@/utils/sleep';

type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'tile';

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

const STATUS_KEYS: Record<BatchRunnerStatus, string> = {
  pending: 'batch.statusPending',
  processing: 'batch.statusProcessing',
  done: 'batch.statusDone',
  error: 'batch.statusError',
};

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

  const [text, setText] = useState('Lokvis');
  const [position, setPosition] = useState<Position>('bottom-right');
  const [opacity, setOpacity] = useState(0.8);
  const [fontSize, setFontSize] = useState(24);
  const [color, setColor] = useState('#ffffff');
  const [error, setError] = useState<string | null>(null);
  const [batchDownloading, setBatchDownloading] = useState(false);
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);

  const buildWorkflow = useCallback(
    (item: BatchRunnerItem): Workflow => ({
      id: `wmark-batch-${item.id}`,
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

  const { queue, processing, addFiles, processAll, cancel, clear } = useBatchRunner({
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
      setError(t('watermark.batch.runtimeNotReady'));
      return;
    }
    if (!text) {
      setError(t('watermark.batch.textRequiredShort'));
      return;
    }
    setError(null);
    await processAll();
  }, [processAll, ready, text, t]);

  const handleCancel = useCallback(async () => {
    await cancel();
  }, [cancel]);

  const handleClear = useCallback(async () => {
    await clear();
    setExpandedErrorId(null);
  }, [clear]);

  const handleDownloadOne = useCallback((item: BatchRunnerItem) => {
    if (!item.outputBlob) return;
    const base = item.file.name.replace(/\.[^.]+$/, '') || 'image';
    downloadBlob(item.outputBlob, `${base}.${extOf(item.file)}`);
  }, []);

  const handleDownloadAll = useCallback(async () => {
    const done = queue.filter((i) => i.status === 'done' && i.outputBlob);
    if (done.length === 0) return;
    setBatchDownloading(true);
    try {
      for (const item of done) {
        const base = item.file.name.replace(/\.[^.]+$/, '') || 'image';
        downloadBlob(item.outputBlob!, `${base}.${extOf(item.file)}`);
        await sleep(150);
      }
    } finally {
      setBatchDownloading(false);
    }
  }, [queue]);

  const total = queue.length;
  const finished = queue.filter((i) => i.status === 'done' || i.status === 'error').length;
  const doneCount = queue.filter((i) => i.status === 'done').length;
  const hasPending = queue.some((i) => i.status === 'pending');
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

        {/* 操作按钮:居中处理 + 右侧清空(与其他工具页布局一致) */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => void handleProcessAll()}
            disabled={!ready || !hasPending || processing || textEmpty}
            className="mx-auto rounded-lg bg-indigo-600 px-24 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {processing ? t('watermark.batch.processing') : hasPending ? t('watermark.batch.processAll') : t('watermark.batch.completed')}
          </button>
          {processing && (
            <button
              onClick={() => void handleCancel()}
              className="rounded-lg border border-amber-700 px-4 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-950/40"
            >
              {t('common.cancel')}
            </button>
          )}
          <button
            onClick={() => void handleClear()}
            disabled={total === 0 || processing}
            title={processing ? t('watermark.batch.cancelFirst') : undefined}
            className="rounded-lg border border-zinc-700 px-4 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
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
                onClick={() => void handleDownloadAll()}
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
