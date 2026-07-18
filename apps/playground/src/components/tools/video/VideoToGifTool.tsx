/**
 * Video To GIF 工具页
 *
 * 导入视频 → 设置 fps / width / 可选时间范围(start/end)→ 调用 video.to-gif
 *
 * 输出为 GIF 图像,VideoToolResultPanel 会根据 MIME 自动切换 <img> 预览。
 * 浏览器版 plugin-video 为 stub,执行时会抛 "not implemented in stub" 错误。
 */
import { useCallback, useState } from 'react';
import { useVideoTool } from '@/components/toolkit/useVideoTool';
import { buildSingleStepVideoWorkflow } from '@/components/toolkit/video-workflow-builder';
import { VideoToolResultPanel } from '@/components/toolkit/VideoToolResultPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

export default function VideoToGifTool() {
  return (
    <ErrorBoundary>
      <VideoToGifToolContent />
    </ErrorBoundary>
  );
}

function VideoToGifToolContent() {
  const lang = useLang();
  const t = useTranslations(lang);
  const tool = useVideoTool();
  const [fps, setFps] = useState(15);
  const [width, setWidth] = useState(480);
  const [useRange, setUseRange] = useState(false);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);

  const maxDuration = tool.inputDuration ?? 0;
  const effectiveEnd = end === 0 && maxDuration > 0 ? maxDuration : end;

  const handleToGif = useCallback(async () => {
    const params: Record<string, unknown> = { fps, width };
    if (useRange && effectiveEnd > start) {
      params.start = start;
      params.end = effectiveEnd;
    }
    const wf = buildSingleStepVideoWorkflow(
      'video.to-gif',
      params,
      'VideoToGif',
      'image',
      'Convert video to animated GIF'
    );
    await tool.runWorkflow(wf);
  }, [tool, fps, width, useRange, start, effectiveEnd]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">{t('videoToGif.title')}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{t('videoToGif.subtitle')}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-12">
          <label className="flex flex-col gap-1 sm:col-span-4">
            <span className="flex items-center justify-between text-[10px] font-medium text-zinc-500">
              <span>{t('videoToGif.fps')}</span>
              <span className="font-mono text-zinc-300">{fps}</span>
            </span>
            <input
              type="range"
              min={5}
              max={30}
              value={fps}
              onChange={(e) => setFps(Number(e.target.value))}
              className="h-1.5 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-indigo-500"
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-4">
            <span className="text-[10px] font-medium text-zinc-500">{t('videoToGif.width')}</span>
            <input
              type="number"
              min={120}
              max={1280}
              step={40}
              value={width}
              onChange={(e) => setWidth(Math.max(120, Math.min(1280, Number(e.target.value))))}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-4">
            <span className="flex items-center gap-2 text-[10px] font-medium text-zinc-500">
              <input
                type="checkbox"
                checked={useRange}
                onChange={(e) => setUseRange(e.target.checked)}
                disabled={!tool.inputId || maxDuration === 0}
                className="h-3 w-3 accent-indigo-500"
              />
              {t('videoToGif.useRange')}
            </span>
            <span className="text-[10px] text-zinc-600">{t('videoToGif.useRangeHint')}</span>
          </label>
          {useRange && (
            <>
              <label className="flex flex-col gap-1 sm:col-span-6">
                <span className="flex items-center justify-between text-[10px] font-medium text-zinc-500">
                  <span>{t('videoToGif.start')}</span>
                  <span className="font-mono text-zinc-300">{start.toFixed(1)}s</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={maxDuration || 1}
                  step={0.1}
                  value={start}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setStart(v);
                    if (effectiveEnd <= v) setEnd(v);
                  }}
                  className="h-1.5 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-indigo-500"
                />
              </label>
              <label className="flex flex-col gap-1 sm:col-span-6">
                <span className="flex items-center justify-between text-[10px] font-medium text-zinc-500">
                  <span>{t('videoToGif.end')}</span>
                  <span className="font-mono text-zinc-300">{effectiveEnd.toFixed(1)}s</span>
                </span>
                <input
                  type="range"
                  min={start}
                  max={maxDuration || 1}
                  step={0.1}
                  value={effectiveEnd}
                  onChange={(e) => setEnd(Number(e.target.value))}
                  className="h-1.5 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-indigo-500"
                />
              </label>
            </>
          )}
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleToGif}
            disabled={!tool.ready || !tool.inputId || tool.busy}
            className="rounded-lg bg-indigo-600 px-24 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tool.busy ? t('videoToGif.busy') : t('videoToGif.btn')}
          </button>
        </div>

        <VideoToolResultPanel
          tool={tool}
          onFiles={tool.handleFiles}
          uploadHint={t('videoToGif.uploadHint')}
          reselectLabel={t('videoToGif.reselect')}
          downloadName={() => `converted-${Date.now()}.gif`}
          onReset={tool.reset}
        />
      </div>
    </div>
  );
}
