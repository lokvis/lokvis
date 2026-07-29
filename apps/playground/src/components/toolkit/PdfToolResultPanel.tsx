/**
 * PdfToolResultPanel — 单 PDF 工具页尾部 UI(Input/Output 对比 + 下载 + 错误提示)。
 *
 * 与 ToolResultPanel 对齐,但:
 * - 用 <iframe> 嵌入浏览器内置 PDF viewer 预览(而非 <img>)
 * - 显示文件名 + 大小(而非 dimensions)
 * - stub 错误时显示提示"PDF 处理在 Node 端运行"
 *
 * 抽出此组件后,各 PDF 工具页只需关注参数面板。
 */
import type { ReactNode } from 'react';
import { UploadBox } from './UploadBox';
import { downloadBlob } from '@lokvis/embed-kit';
import { formatBytes } from '@lokvis/runtime';
import type { UsePdfToolResult } from './usePdfTool';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

export interface PdfToolResultPanelProps {
  tool: UsePdfToolResult;
  onFiles: (files: File[]) => Promise<unknown> | void;
  uploadHint: string;
  reselectLabel: string;
  /** 下载文件名(工具页传入) */
  downloadName: () => string;
  children?: ReactNode;
  onReset?: () => void;
}

export function PdfToolResultPanel({
  tool,
  onFiles,
  uploadHint,
  reselectLabel,
  downloadName,
  children,
  onReset,
}: PdfToolResultPanelProps) {
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
              {t('pdf.stubHint')}
            </p>
          )}
        </div>
      )}

      {children}

      {/* Input / Output 对比 */}
      <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        {!tool.inputId ? (
          <UploadBox onFiles={onFiles} hint={uploadHint} accept="application/pdf" className="md:col-span-2" />
        ) : (
          <>
            <PdfPreviewBox
              title={t('common.input')}
              url={tool.inputUrl}
              meta={tool.inputName && tool.inputSize != null ? `${tool.inputName} · ${formatBytes(tool.inputSize)}` : ''}
            />
            <PdfPreviewBox
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

/** PDF 预览容器(iframe 嵌入浏览器 PDF viewer) */
function PdfPreviewBox({
  url,
  title,
  meta,
  action,
}: {
  url: string | null;
  title: string;
  meta?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-800">
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-3 py-2">
        <span className="text-[11px] font-semibold text-zinc-400">{title}</span>
        {action}
      </header>
      <div className="h-64 bg-zinc-950">
        {url ? (
          <iframe src={url} title={title} className="h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-[11px] text-zinc-600">—</p>
          </div>
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
