/**
 * VideoToolResultPanel — 单视频工具页尾部 UI(Input/Output 对比 + 下载 + 错误提示)。
 *
 * 与 PdfToolResultPanel 对齐,但:
 * - Input 用 <video> 预览(浏览器内置 HTML5 video)
 * - Output 根据 MIME 类型自动切换 <video> / <audio> / <img>:
 *   - video/* → <video controls>
 *   - audio/* → <audio controls>
 *   - image/* → <img>(to-gif / screenshot 输出)
 * - 显示文件名 + 大小 + 时长(若有)
 * - stub 错误时显示 amber 色提示"视频处理在 Node 端运行"
 *
 * 抽出此组件后,各 Video 工具页只需关注参数面板。
 */
import type { ReactNode } from 'react';
import { UploadBox } from './UploadBox';
import { downloadBlob, formatBytes } from './download';
import type { UseVideoToolResult } from './useVideoTool';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

export interface VideoToolResultPanelProps {
  tool: UseVideoToolResult;
  onFiles: (files: File[]) => Promise<unknown> | void;
  uploadHint: string;
  reselectLabel: string;
  /** 下载文件名(工具页传入) */
  downloadName: () => string;
  children?: ReactNode;
  onReset?: () => void;
}

export function VideoToolResultPanel({
  tool,
  onFiles,
  uploadHint,
  reselectLabel,
  downloadName,
  children,
  onReset,
}: VideoToolResultPanelProps) {
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
              {t('video.stubHint')}
            </p>
          )}
        </div>
      )}

      {children}

      {/* Input / Output 对比 */}
      <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        {!tool.inputId ? (
          <UploadBox onFiles={onFiles} hint={uploadHint} accept="video/*" className="md:col-span-2" />
        ) : (
          <>
            <VideoPreviewBox
              title={t('common.input')}
              url={tool.inputUrl}
              kind="video"
              meta={tool.inputName && tool.inputSize != null ? `${tool.inputName} · ${formatBytes(tool.inputSize)}` : ''}
              onLoadedMetadata={tool.setInputDuration}
            />
            <VideoPreviewBox
              title={t('common.output')}
              url={tool.outputUrl}
              kind={outputKindFromBlob(tool.outputBlob)}
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

/** 根据 Blob MIME 推断预览组件类型 */
function outputKindFromBlob(blob: Blob | null): 'video' | 'audio' | 'image' | 'empty' {
  if (!blob) return 'empty';
  const mime = blob.type.toLowerCase();
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('image/')) return 'image';
  // 未知类型默认 video 占位
  return 'video';
}

/** 视频预览容器(根据 kind 渲染 <video> / <audio> / <img>) */
function VideoPreviewBox({
  url,
  title,
  meta,
  action,
  kind,
  onLoadedMetadata,
}: {
  url: string | null;
  title: string;
  meta?: string;
  action?: React.ReactNode;
  kind: 'video' | 'audio' | 'image' | 'empty';
  onLoadedMetadata?: (duration: number) => void;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-800">
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-3 py-2">
        <span className="text-[11px] font-semibold text-zinc-400">{title}</span>
        {action}
      </header>
      <div className="flex h-64 items-center justify-center bg-zinc-950 p-2">
        {!url ? (
          <p className="text-[11px] text-zinc-600">—</p>
        ) : kind === 'video' ? (
          <video
            src={url}
            controls
            className="max-h-full max-w-full"
            onLoadedMetadata={(e) => {
              const dur = e.currentTarget.duration;
              if (Number.isFinite(dur) && onLoadedMetadata) {
                onLoadedMetadata(dur);
              }
            }}
          />
        ) : kind === 'audio' ? (
          <audio src={url} controls className="w-full" />
        ) : kind === 'image' ? (
          <img src={url} alt={title} className="max-h-full max-w-full object-contain" />
        ) : (
          <p className="text-[11px] text-zinc-600">—</p>
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
