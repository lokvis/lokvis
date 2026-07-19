/**
 * Audio Merge 工具页
 *
 * 导入多个音频 → 调用 audio.merge capability(N→1)→ 输出合并后的音频
 *
 * 浏览器版 plugin-audio 为 stub,执行时会抛 "not implemented in stub" 错误。
 * 注:当前 playground UI 只支持单输入预览(useAudioTool 单 inputId),
 *    merge 需要多文件上传,Phase 3 后期将集成 BatchQueue。
 *    本工具页先实装为"占位"模式:展示概念但提示需 Node 端运行。
 */
import { useAudioTool } from '@/components/toolkit/useAudioTool';
import { AudioToolResultPanel } from '@/components/toolkit/AudioToolResultPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

export default function AudioMergeTool() {
  return (
    <ErrorBoundary>
      <AudioMergeToolContent />
    </ErrorBoundary>
  );
}

function AudioMergeToolContent() {
  const lang = useLang();
  const t = useTranslations(lang);
  const tool = useAudioTool();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">{t('audioMerge.title')}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{t('audioMerge.subtitle')}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        <div className="rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-[11px] text-amber-300">
          {t('audioMerge.placeholder')}
        </div>

        <AudioToolResultPanel
          tool={tool}
          onFiles={tool.handleFiles}
          uploadHint={t('audioMerge.uploadHint')}
          reselectLabel={t('audioMerge.reselect')}
          downloadName={() => `merged-${Date.now()}.mp3`}
          onReset={tool.reset}
        />
      </div>
    </div>
  );
}
