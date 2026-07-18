/**
 * Video Transcode 工具页
 *
 * 导入视频 → 选择目标格式(mp4/webm/gif)+ codec → 调用 video.transcode
 *
 * 浏览器版 plugin-video 为 stub,执行时会抛 "not implemented in stub" 错误。
 */
import { useCallback, useState } from 'react';
import { useVideoTool } from '@/components/toolkit/useVideoTool';
import { buildSingleStepVideoWorkflow } from '@/components/toolkit/video-workflow-builder';
import { VideoToolResultPanel } from '@/components/toolkit/VideoToolResultPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

type TranscodeFormat = 'mp4' | 'webm' | 'gif';

export default function VideoTranscodeTool() {
  return (
    <ErrorBoundary>
      <VideoTranscodeToolContent />
    </ErrorBoundary>
  );
}

function VideoTranscodeToolContent() {
  const lang = useLang();
  const t = useTranslations(lang);
  const tool = useVideoTool();
  const [format, setFormat] = useState<TranscodeFormat>('mp4');
  const [codec, setCodec] = useState('');

  const handleTranscode = useCallback(async () => {
    const params: Record<string, unknown> = { format };
    const trimmedCodec = codec.trim();
    if (trimmedCodec) params.codec = trimmedCodec;
    // gif 输出类型为 image,其余为 video
    const outputType = format === 'gif' ? 'image' : 'video';
    const wf = buildSingleStepVideoWorkflow(
      'video.transcode',
      params,
      'VideoTranscode',
      outputType,
      `Transcode video to ${format}`
    );
    await tool.runWorkflow(wf);
  }, [tool, format, codec]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">{t('videoTranscode.title')}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{t('videoTranscode.subtitle')}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-12">
          <label className="flex flex-col gap-1 sm:col-span-4">
            <span className="text-[10px] font-medium text-zinc-500">{t('videoTranscode.format')}</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as TranscodeFormat)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="mp4">MP4</option>
              <option value="webm">WebM</option>
              <option value="gif">GIF (animated)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 sm:col-span-8">
            <span className="text-[10px] font-medium text-zinc-500">{t('videoTranscode.codec')}</span>
            <input
              type="text"
              value={codec}
              onChange={(e) => setCodec(e.target.value)}
              placeholder={format === 'mp4' ? 'libx264' : format === 'webm' ? 'libvpx-vp9' : 'gif'}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
            <span className="text-[10px] text-zinc-600">{t('videoTranscode.codecHint')}</span>
          </label>
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleTranscode}
            disabled={!tool.ready || !tool.inputId || tool.busy}
            className="rounded-lg bg-indigo-600 px-24 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tool.busy ? t('videoTranscode.busy') : t('videoTranscode.btn')}
          </button>
        </div>

        <VideoToolResultPanel
          tool={tool}
          onFiles={tool.handleFiles}
          uploadHint={t('videoTranscode.uploadHint')}
          reselectLabel={t('videoTranscode.reselect')}
          downloadName={() => `transcoded-${Date.now()}.${format}`}
          onReset={tool.reset}
        />
      </div>
    </div>
  );
}
