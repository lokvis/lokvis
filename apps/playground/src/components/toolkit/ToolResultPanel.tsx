/**
 * ToolResultPanel — 单图工具页(Input/Output 对比 + 下载 + 错误/跳过提示 +
 * 重选按钮)的共享尾部 UI。
 *
 * Compress/Resize/Convert/Crop/Watermark 五个工具页尾部 JSX 几乎一致:
 *   - tool.initError / tool.error 红色提示
 *   - skipped > 0 黄色提示
 *   - 可选的 children(自定义 stats 行,如压缩率/尺寸变化)
 *   - Input/Output 双栏对比(未导入时显示 UploadBox)
 *   - "重选"按钮(导入后显示)
 *
 * 抽出此组件后,各工具页只需关注参数面板 + 调用 buildSingleStepImageWorkflow。
 */
import type { ReactNode } from 'react';
import { UploadBox } from './UploadBox';
import { PreviewBox } from './PreviewBox';
import { downloadBlob, imageInfoToMeta } from './download';
import type { UseImageToolResult } from './useImageTool';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

export interface ToolResultPanelProps {
  /** useImageTool() 返回的工具状态 */
  tool: UseImageToolResult;
  /** 文件上传回调(由工具页包装 setSkipped 等) */
  onFiles: (files: File[]) => Promise<void>;
  /** 上传提示文案 */
  uploadHint: string;
  /** 重选按钮文案 */
  reselectLabel: string;
  /**
   * 下载文件名构造器。接收 outputInfo(可能为 null)与 outputBlob(可能为 null),
   * 返回完整文件名(含扩展名)。各工具页的命名规则不同(resized-800x600.png /
   * compressed.webp / converted.webp / cropped.png / watermarked.png)。
   */
  downloadName: (outputInfo: ToolResultPanelProps['tool']['outputInfo']) => string;
  /** 自定义 stats 行(如压缩率/尺寸变化),插在错误提示与对比栏之间 */
  children?: ReactNode;
  /** 自定义重置逻辑(可选;不传则用 tool.reset) */
  onReset?: () => void;
}

export function ToolResultPanel({
  tool,
  onFiles,
  uploadHint,
  reselectLabel,
  downloadName,
  children,
  onReset,
}: ToolResultPanelProps) {
  const lang = useLang();
  const t = useTranslations(lang);

  return (
    <>
      {tool.initError && (
        <p className="text-xs text-red-400">
          {t('common.initFailedPrefix')}
          {tool.initError}
        </p>
      )}
      {tool.error && <p className="text-xs text-red-400">{tool.error}</p>}

      {children}

      {/* Input / Output 对比 */}
      <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        {!tool.inputId ? (
          <UploadBox onFiles={onFiles} hint={uploadHint} className="md:col-span-2" />
        ) : (
          <>
            <PreviewBox
              title={t('common.input')}
              url={tool.inputUrl}
              meta={imageInfoToMeta(tool.inputInfo)}
            />
            <PreviewBox
              title={t('common.output')}
              url={tool.outputUrl}
              meta={imageInfoToMeta(tool.outputInfo)}
              action={
                tool.outputBlob && (
                  <button
                    onClick={() => downloadBlob(tool.outputBlob!, downloadName(tool.outputInfo))}
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
