/**
 * Audio Normalize 工具页
 *
 * 导入音频 → 选择目标响度(level, dB) → 调用 audio.normalize
 *
 * 浏览器版 plugin-audio 为 stub,执行时会抛 "not implemented in stub" 错误,
 * AudioToolResultPanel 显示 amber 色 stub 错误提示。
 */
import { useCallback, useState } from 'react';
import { useAudioTool } from '@/components/toolkit/useAudioTool';
import { buildSingleStepAudioWorkflow } from '@/components/toolkit/audio-workflow-builder';
import { AudioToolResultPanel } from '@/components/toolkit/AudioToolResultPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

export default function AudioNormalizeTool() {
  return (
    <ErrorBoundary>
      <AudioNormalizeToolContent />
    </ErrorBoundary>
  );
}

function AudioNormalizeToolContent() {
  const lang = useLang();
  const t = useTranslations(lang);
  const tool = useAudioTool();
  const [level, setLevel] = useState(-16);

  const handleNormalize = useCallback(async () => {
    const wf = buildSingleStepAudioWorkflow(
      'audio.normalize',
      { level },
      'AudioNormalize',
      `Normalize audio loudness to ${level} dB`
    );
    await tool.runWorkflow(wf);
  }, [tool, level]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">{t('audioNormalize.title')}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{t('audioNormalize.subtitle')}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-12">
          <label className="flex flex-col gap-1 sm:col-span-12">
            <span className="flex items-center justify-between text-[10px] font-medium text-zinc-500">
              <span>{t('audioNormalize.level')}</span>
              <span className="font-mono text-zinc-300">{level} dB</span>
            </span>
            <input
              type="range"
              min={-30}
              max={0}
              step={1}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="h-1.5 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-indigo-500"
            />
            <span className="text-[10px] text-zinc-600">{t('audioNormalize.levelHint')}</span>
          </label>
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleNormalize}
            disabled={!tool.ready || !tool.inputId || tool.busy}
            className="rounded-lg bg-indigo-600 px-24 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tool.busy ? t('audioNormalize.busy') : t('audioNormalize.btn')}
          </button>
        </div>

        <AudioToolResultPanel
          tool={tool}
          onFiles={tool.handleFiles}
          uploadHint={t('audioNormalize.uploadHint')}
          reselectLabel={t('audioNormalize.reselect')}
          downloadName={() => `normalized-${Date.now()}.mp3`}
          onReset={tool.reset}
        />
      </div>
    </div>
  );
}
