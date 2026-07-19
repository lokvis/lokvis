/**
 * Audio Transcode 工具页
 *
 * 导入音频 → 选择目标格式(mp3/wav/ogg/aac)+ bitrate → 调用 audio.transcode
 *
 * 浏览器版 plugin-audio 为 stub,执行时会抛 "not implemented in stub" 错误。
 */
import { useCallback, useState } from 'react';
import { useAudioTool } from '@/components/toolkit/useAudioTool';
import { buildSingleStepAudioWorkflow } from '@/components/toolkit/audio-workflow-builder';
import { AudioToolResultPanel } from '@/components/toolkit/AudioToolResultPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

type AudioFormat = 'mp3' | 'wav' | 'ogg' | 'aac';

export default function AudioTranscodeTool() {
  return (
    <ErrorBoundary>
      <AudioTranscodeToolContent />
    </ErrorBoundary>
  );
}

function AudioTranscodeToolContent() {
  const lang = useLang();
  const t = useTranslations(lang);
  const tool = useAudioTool();
  const [format, setFormat] = useState<AudioFormat>('mp3');
  const [bitrate, setBitrate] = useState(0);

  const handleTranscode = useCallback(async () => {
    const params: Record<string, unknown> = { format };
    // bitrate 为 0 时不传入 params(engine 用默认)
    if (bitrate > 0) params.bitrate = bitrate;
    const wf = buildSingleStepAudioWorkflow(
      'audio.transcode',
      params,
      'AudioTranscode',
      `Transcode audio to ${format}`
    );
    await tool.runWorkflow(wf);
  }, [tool, format, bitrate]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">{t('audioTranscode.title')}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{t('audioTranscode.subtitle')}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-12">
          <label className="flex flex-col gap-1 sm:col-span-4">
            <span className="text-[10px] font-medium text-zinc-500">{t('audioTranscode.format')}</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as AudioFormat)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="mp3">MP3</option>
              <option value="wav">WAV</option>
              <option value="ogg">OGG</option>
              <option value="aac">AAC</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 sm:col-span-8">
            <span className="flex items-center justify-between text-[10px] font-medium text-zinc-500">
              <span>{t('audioTranscode.bitrate')}</span>
              <span className="font-mono text-zinc-300">{bitrate > 0 ? `${(bitrate / 1000).toFixed(0)} kbps` : 'auto'}</span>
            </span>
            <input
              type="range"
              min={0}
              max={320000}
              step={1000}
              value={bitrate}
              onChange={(e) => setBitrate(Number(e.target.value))}
              className="h-1.5 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-indigo-500"
            />
            <span className="text-[10px] text-zinc-600">{t('audioTranscode.bitrateHint')}</span>
          </label>
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleTranscode}
            disabled={!tool.ready || !tool.inputId || tool.busy}
            className="rounded-lg bg-indigo-600 px-24 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tool.busy ? t('audioTranscode.busy') : t('audioTranscode.btn')}
          </button>
        </div>

        <AudioToolResultPanel
          tool={tool}
          onFiles={tool.handleFiles}
          uploadHint={t('audioTranscode.uploadHint')}
          reselectLabel={t('audioTranscode.reselect')}
          downloadName={() => `transcoded-${Date.now()}.${format}`}
          onReset={tool.reset}
        />
      </div>
    </div>
  );
}
