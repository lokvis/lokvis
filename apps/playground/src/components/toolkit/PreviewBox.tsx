/**
 * PreviewBox — 图片预览容器,显示 Blob URL + 元信息(尺寸/大小/格式)。
 *
 * 用于工具页的 Input/Output 双栏对比。容器只展示 url,
 * url 的生命周期(createObjectURL / revokeObjectURL)由调用方管理,
 * 便于 Input/Output 复用同一 url 或在切换图片时统一 revoke。
 */
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

export interface PreviewBoxProps {
  /** Blob URL(由 URL.createObjectURL 生成),null 时显示占位 */
  url: string | null;
  title?: string;
  /** 元信息行(如 "800×600 · 120KB · JPEG"),不传则不显示 */
  meta?: string;
  /** 右上角操作槽(如下载按钮) */
  action?: React.ReactNode;
  className?: string;
}

export function PreviewBox({ url, title, meta, action, className = '' }: PreviewBoxProps) {
  const lang = useLang();
  const t = useTranslations(lang);
  return (
    <div className={`flex flex-col overflow-hidden rounded-lg border border-zinc-800 ${className}`}>
      {title && (
        <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-3 py-2">
          <span className="text-[11px] font-semibold text-zinc-400">{title}</span>
          {action}
        </header>
      )}
      <div className="flex flex-1 items-center justify-center bg-zinc-950 p-2">
        {url ? (
          <img src={url} alt={title ?? t('preview.alt')} className="max-h-full max-w-full object-contain" loading="lazy" decoding="async" />
        ) : (
          <p className="text-[11px] text-zinc-600">{t('preview.empty')}</p>
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
