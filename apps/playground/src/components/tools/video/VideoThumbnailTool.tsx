/**
 * Video Thumbnail (screenshot) 工具页
 *
 * 导入视频 → 选择截图时间戳 + 输出格式(png/jpeg/webp)→ 调用 video.screenshot
 *
 * 输出为图像,VideoToolResultPanel 会根据 MIME 自动切换 <img> 预览。
 * 浏览器版 plugin-video 为 stub,执行时会抛 "not implemented in stub" 错误。
 */
import { useCallback, useState } from 'react';
import { useVideoTool } from '@/components/toolkit/useVideoTool';
import { buildSingleStepVideoWorkflow } from '@/components/toolkit/video-workflow-builder';
import { VideoToolResultPanel } from '@/components/toolkit/VideoToolResultPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

type ThumbFormat = 'png' | 'jpeg' | 'webp';

export default function VideoThumbnailTool() {
  return (
    <ErrorBoundary>
      <VideoThumbnailToolContent />
    </ErrorBoundary>
  );
}

function VideoThumbnailToolContent() {
  const lang = useLang();
  const t = useTranslations(lang);
  const tool = useVideoTool();
  const [time, setTime] = useState(0);
  const [format, setFormat] = useState<ThumbFormat>('png');

  const maxDuration = tool.inputDuration ?? 0;
  // 默认取视频中段作为缩略图
  const effectiveTime = time === 0 && maxDuration > 0 ? maxDuration / 2 : time;

  const handleScreenshot = useCallback(async () => {
    const wf = buildSingleStepVideoWorkflow(
      'video.screenshot',
      { time: effectiveTime, format },
      'VideoThumbnail',
      'image',
      `Capture frame at ${effectiveTime.toFixed(1)}s as ${format}`
    );
    await tool.runWorkflow(wf);
  }, [tool, effectiveTime, format]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">{t('videoThumbnail.title')}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{t('videoThumbnail.subtitle')}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-12">
          <label className="flex flex-col gap-1 sm:col-span-8">
            <span className="flex items-center justify-between text-[10px] font-medium text-zinc-500">
              <span>{t('videoThumbnail.time')}</span>
              <span className="font-mono text-zinc-300">{effectiveTime.toFixed(1)}s</span>
            </span>
            <input
              type="range"
              min={0}
              max={maxDuration || 1}
              step={0.1}
              value={effectiveTime}
              onChange={(e) => setTime(Number(e.target.value))}
              disabled={!tool.inputId || maxDuration === 0}
              className="h-1.5 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <span className="text-[10px] text-zinc-600">
              {maxDuration > 0 ? `${t('videoThumbnail.durationLabel')} ${maxDuration.toFixed(1)}s` : t('videoThumbnail.loadFirst')}
            </span>
          </label>
          <label className="flex flex-col gap-1 sm:col-span-4">
            <span className="text-[10px] font-medium text-zinc-500">{t('videoThumbnail.format')}</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as ThumbFormat)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="png">PNG (lossless)</option>
              <option value="jpeg">JPEG</option>
              <option value="webp">WebP</option>
            </select>
          </label>
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleScreenshot}
            disabled={!tool.ready || !tool.inputId || tool.busy || maxDuration === 0}
            className="rounded-lg bg-indigo-600 px-24 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tool.busy ? t('videoThumbnail.busy') : t('videoThumbnail.btn')}
          </button>
        </div>

        <VideoToolResultPanel
          tool={tool}
          onFiles={tool.handleFiles}
          uploadHint={t('videoThumbnail.uploadHint')}
          reselectLabel={t('videoThumbnail.reselect')}
          downloadName={() => `thumbnail-${Date.now()}.${format}`}
          onReset={tool.reset}
        />
      </div>
    </div>
  );
}
