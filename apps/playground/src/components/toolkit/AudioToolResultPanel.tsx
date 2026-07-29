/**
 * AudioToolResultPanel — 单音频工具页尾部 UI(Input/Output 对比 + 下载 + 错误提示)。
 *
 * 与 VideoToolResultPanel 对齐,但简化:audio 输出永远是 audio,
 * 不需要根据 MIME 切换 <video> / <audio> / <img>(移除 outputKindFromBlob 函数与
 * VideoPreviewBox 的 video/image 分支,只保留 <audio> 预览)。
 *
 * - Input 用 <audio> 预览(浏览器内置 HTML5 audio)
 * - Output 也用 <audio>(无论 transcode 到何种格式,blob 都能由 <audio> 播放)
 * - 显示文件名 + 大小
 * - stub 错误时显示 amber 色提示"音频处理在 Node 端运行"
 *
 * 抽出此组件后,各 Audio 工具页只需关注参数面板。
 */
import type { ReactNode } from 'react';
import { UploadBox } from './UploadBox';
import { downloadBlob } from '@lokvis/embed-kit';
import { formatBytes } from '@lokvis/runtime';
import type { UseAudioToolResult } from './useAudioTool';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

export interface AudioToolResultPanelProps {
  tool: UseAudioToolResult;
  onFiles: (files: File[]) => Promise<unknown> | void;
  uploadHint: string;
  reselectLabel: string;
  /** 下载文件名(工具页传入) */
  downloadName: () => string;
  children?: ReactNode;
  onReset?: () => void;
}

export function AudioToolResultPanel({
  tool,
  onFiles,
  uploadHint,
  reselectLabel,
  downloadName,
  children,
  onReset,
}: AudioToolResultPanelProps) {
  const lang = useLang();
  const t = useTranslations(lang);

  const isStubError = tool.error?.includes('not implemented in stub');

  return (
    <>
      {tool.initError && (
        <p className="text-xs text-red-400">
          {t('common.initFailedPrefix')}
          {tool.initError}
        </p>
      )}
      {tool.error && (
        <div className={`rounded border p-2 text-xs ${isStubError ? 'border-amber-700 bg-amber-950/30 text-amber-300' : 'border-red-800 bg-red-950/30 text-red-400'}`}>
          {tool.error}
          {isStubError && (
            <p className="mt-1 text-[10px] text-amber-400/80">
              {t('audio.stubHint')}
            </p>
          )}
        </div>
      )}

      {children}

      {/* Input / Output 对比 */}
      <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        {!tool.inputId ? (
          <UploadBox onFiles={onFiles} hint={uploadHint} accept="audio/*" className="md:col-span-2" />
        ) : (
          <>
            <AudioPreviewBox
              title={t('common.input')}
              url={tool.inputUrl}
              meta={tool.inputName && tool.inputSize != null ? `${tool.inputName} · ${formatBytes(tool.inputSize)}` : ''}
              onLoadedMetadata={tool.setInputDuration}
            />
            <AudioPreviewBox
              title={t('common.output')}
              url={tool.outputUrl}
              meta={tool.outputName && tool.outputBlob ? `${tool.outputName} · ${formatBytes(tool.outputBlob.size)}` : ''}
              action={
                tool.outputBlob && (
                  <button
                    onClick={() => downloadBlob(tool.outputBlob!, downloadName())}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300"
                  >
                    {t('common.download')}
                  </button>
                )
              }
            />
          </>
        )}
      </div>

      {tool.inputId && (
        <button
          onClick={onReset ?? tool.reset}
          className="self-start text-[10px] text-zinc-500 hover:text-zinc-300"
        >
          {reselectLabel}
        </button>
      )}
    </>
  );
}

/** 音频预览容器(永远渲染 <audio>) */
function AudioPreviewBox({
  url,
  title,
  meta,
  action,
  onLoadedMetadata,
}: {
  url: string | null;
  title: string;
  meta?: string;
  action?: React.ReactNode;
  onLoadedMetadata?: (duration: number) => void;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-800">
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-3 py-2">
        <span className="text-[11px] font-semibold text-zinc-400">{title}</span>
        {action}
      </header>
      <div className="flex h-32 items-center justify-center bg-zinc-950 p-4">
        {!url ? (
          <p className="text-[11px] text-zinc-600">—</p>
        ) : (
          <audio
            src={url}
            controls
            className="w-full"
            onLoadedMetadata={(e) => {
              const dur = e.currentTarget.duration;
              if (Number.isFinite(dur) && onLoadedMetadata) {
                onLoadedMetadata(dur);
              }
            }}
          />
        )}
      </div>
      {meta && (
        <footer className="border-t border-zinc-800 bg-zinc-900/30 px-3 py-1 text-[10px] text-zinc-500">
          {meta}
        </footer>
      )}
    </div>
  );
}
