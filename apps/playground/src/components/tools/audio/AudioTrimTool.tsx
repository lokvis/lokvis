/**
 * Audio Trim 工具页
 *
 * 导入音频 → 选择起止时间(start/end) → 调用 audio.trim
 *
 * 浏览器版 plugin-audio 为 stub,执行时会抛 "not implemented in stub" 错误。
 * trim 的 end 受限于 inputDuration(<audio> metadata 读取),inputDuration
 * 为 null 时禁用 trim 按钮(需先加载音频)。
 */
import { useCallback, useState } from 'react';
import { useAudioTool } from '@/components/toolkit/useAudioTool';
import { buildSingleStepAudioWorkflow } from '@/components/toolkit/audio-workflow-builder';
import { AudioToolResultPanel } from '@/components/toolkit/AudioToolResultPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

export default function AudioTrimTool() {
  return (
    <ErrorBoundary>
      <AudioTrimToolContent />
    </ErrorBoundary>
  );
}

function AudioTrimToolContent() {
  const lang = useLang();
  const t = useTranslations(lang);
  const tool = useAudioTool();
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);

  const maxDuration = tool.inputDuration ?? 0;
  // end 为 0 时(未初始化)默认取 maxDuration
  const effectiveEnd = end === 0 && maxDuration > 0 ? maxDuration : end;
  const canTrim = tool.inputId !== null && maxDuration > 0 && effectiveEnd > start;

  const handleTrim = useCallback(async () => {
    if (!canTrim) return;
    const wf = buildSingleStepAudioWorkflow(
      'audio.trim',
      { start, end: effectiveEnd },
      'AudioTrim',
      `Trim audio from ${start}s to ${effectiveEnd}s`
    );
    await tool.runWorkflow(wf);
  }, [tool, start, effectiveEnd, canTrim]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">{t('audioTrim.title')}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{t('audioTrim.subtitle')}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-12">
          <label className="flex flex-col gap-1 sm:col-span-6">
            <span className="flex items-center justify-between text-[10px] font-medium text-zinc-500">
              <span>{t('audioTrim.start')}</span>
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
              disabled={!tool.inputId || maxDuration === 0}
              className="h-1.5 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-6">
            <span className="flex items-center justify-between text-[10px] font-medium text-zinc-500">
              <span>{t('audioTrim.end')}</span>
              <span className="font-mono text-zinc-300">{effectiveEnd.toFixed(1)}s</span>
            </span>
            <input
              type="range"
              min={start}
              max={maxDuration || 1}
              step={0.1}
              value={effectiveEnd}
              onChange={(e) => setEnd(Number(e.target.value))}
              disabled={!tool.inputId || maxDuration === 0}
              className="h-1.5 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
          <div className="sm:col-span-12">
            <p className="text-[10px] text-zinc-600">
              {maxDuration > 0
                ? `${t('audioTrim.durationLabel')} ${maxDuration.toFixed(1)}s · ${t('audioTrim.clipLength')} ${(effectiveEnd - start).toFixed(1)}s`
                : t('audioTrim.loadFirst')}
            </p>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleTrim}
            disabled={!tool.ready || !canTrim || tool.busy}
            className="rounded-lg bg-indigo-600 px-24 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tool.busy ? t('audioTrim.busy') : t('audioTrim.btn')}
          </button>
        </div>

        <AudioToolResultPanel
          tool={tool}
          onFiles={tool.handleFiles}
          uploadHint={t('audioTrim.uploadHint')}
          reselectLabel={t('audioTrim.reselect')}
          downloadName={() => `trimmed-${Date.now()}.mp3`}
          onReset={tool.reset}
        />
      </div>
    </div>
  );
}
