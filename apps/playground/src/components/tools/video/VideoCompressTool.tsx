/**
 * Video Compress 工具页
 *
 * 导入视频 → 选择输出格式(mp4/webm)+ bitrate/crf/scale → 调用 video.compress
 *
 * 浏览器版 plugin-video 为 stub,执行时会抛 "not implemented in stub" 错误,
 * VideoToolResultPanel 显示 amber 色 stub 错误提示。
 */
import { useCallback, useState } from 'react';
import { useVideoTool } from '@/components/toolkit/useVideoTool';
import { buildSingleStepVideoWorkflow } from '@/components/toolkit/video-workflow-builder';
import { VideoToolResultPanel } from '@/components/toolkit/VideoToolResultPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

type VideoFormat = 'mp4' | 'webm';

export default function VideoCompressTool() {
  return (
    <ErrorBoundary>
      <VideoCompressToolContent />
    </ErrorBoundary>
  );
}

function VideoCompressToolContent() {
  const lang = useLang();
  const t = useTranslations(lang);
  const tool = useVideoTool();
  const [format, setFormat] = useState<VideoFormat>('mp4');
  const [crf, setCrf] = useState(23);
  const [scale, setScale] = useState(1);

  const handleCompress = useCallback(async () => {
    const params: Record<string, unknown> = { format, crf };
    if (scale < 1) params.scale = scale;
    const wf = buildSingleStepVideoWorkflow(
      'video.compress',
      params,
      'VideoCompress',
      'video',
      'Compress video with crf / scale'
    );
    await tool.runWorkflow(wf);
  }, [tool, format, crf, scale]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">{t('videoCompress.title')}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{t('videoCompress.subtitle')}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-12">
          <label className="flex flex-col gap-1 sm:col-span-3">
            <span className="text-[10px] font-medium text-zinc-500">{t('videoCompress.format')}</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as VideoFormat)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="mp4">MP4 (H.264)</option>
              <option value="webm">WebM (VP9)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 sm:col-span-5">
            <span className="flex items-center justify-between text-[10px] font-medium text-zinc-500">
              <span>{t('videoCompress.crf')}</span>
              <span className="font-mono text-zinc-300">{crf}</span>
            </span>
            <input
              type="range"
              min={0}
              max={51}
              value={crf}
              onChange={(e) => setCrf(Number(e.target.value))}
              className="h-1.5 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-indigo-500"
            />
            <span className="text-[10px] text-zinc-600">{t('videoCompress.crfHint')}</span>
          </label>
          <label className="flex flex-col gap-1 sm:col-span-4">
            <span className="flex items-center justify-between text-[10px] font-medium text-zinc-500">
              <span>{t('videoCompress.scale')}</span>
              <span className="font-mono text-zinc-300">{scale.toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={0.25}
              max={1}
              step={0.05}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="h-1.5 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-indigo-500"
            />
            <span className="text-[10px] text-zinc-600">{t('videoCompress.scaleHint')}</span>
          </label>
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleCompress}
            disabled={!tool.ready || !tool.inputId || tool.busy}
            className="rounded-lg bg-indigo-600 px-24 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tool.busy ? t('videoCompress.busy') : t('videoCompress.btn')}
          </button>
        </div>

        <VideoToolResultPanel
          tool={tool}
          onFiles={tool.handleFiles}
          uploadHint={t('videoCompress.uploadHint')}
          reselectLabel={t('videoCompress.reselect')}
          downloadName={() => `compressed-${Date.now()}.${format}`}
          onReset={tool.reset}
        />
      </div>
    </div>
  );
}
