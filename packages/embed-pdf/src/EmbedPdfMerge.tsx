/**
 * EmbedPdfMerge — PDF 合并默认 UI(Layer 2)。
 *
 * 多文件上传,无预设切换器。
 * 内置 ErrorBoundary。
 */
import type { CSSProperties } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { useLang } from './i18n/useLang';
import { useTranslations } from './i18n/utils';
import type { Language } from './i18n/config';
import type { EmbedPdfTranslations } from './i18n/EmbedPdfI18nProvider';
import { themeToCssVars, useEmbedPdfMode, type EmbedPdfTheme, type EmbedPdfMode } from './theme';
import { PdfMerge } from './primitives/PdfMerge';
import type { UsePdfMergeOptions } from './hooks/usePdfMerge';

// ─── Props ────────────────────────────────────────────────

export interface EmbedPdfMergeProps extends UsePdfMergeOptions {
  className?: string;
  style?: CSSProperties;
  showDownloadButton?: boolean;
  showResetButton?: boolean;
  theme?: EmbedPdfTheme;
  mode?: EmbedPdfMode;
  locale?: Language;
  translations?: EmbedPdfTranslations;
}

// ─── 默认 UI 实现 ─────────────────────────────────────────

function EmbedPdfMergeDefault({
  className = '',
  style,
  showDownloadButton = true,
  showResetButton = true,
  theme,
  mode = 'system',
  locale,
  translations,
  ...hookOptions
}: EmbedPdfMergeProps) {
  const lang = useLang(locale);
  const t = useTranslations(lang, translations);
  const cssVars = themeToCssVars(theme);
  const resolvedMode = useEmbedPdfMode(mode);

  return (
    <div
      className={`lokvis-embed-pdf-merge flex flex-col gap-3 rounded-lg p-3 ${className}`}
      data-embed-mode={resolvedMode}
      style={{
        background: 'var(--lokvis-pdf-bg, transparent)',
        color: 'var(--lokvis-pdf-text, #18181b)',
        fontFamily: 'var(--lokvis-pdf-font-family, inherit)',
        ...cssVars,
        ...style,
      }}
    >
      <PdfMerge.Root {...hookOptions}>
        {/* header */}
        <header className="flex flex-col gap-2">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--lokvis-pdf-text, #18181b)' }}>
              {t('pdfMerge.title')}
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--lokvis-pdf-text-muted, #71717a)' }}>
              {t('pdfMerge.subtitle')}
            </p>
          </div>
          <PdfMerge.Upload>
            <span className="text-xs" style={{ color: 'var(--lokvis-pdf-text-muted, #71717a)' }}>
              {t('pdfMerge.dropHint')}
            </span>
          </PdfMerge.Upload>
        </header>

        {/* body: file count */}
        <PdfMerge.FileCount />

        {/* footer */}
        <footer className="flex flex-col gap-2">
          <div className="flex items-center justify-end gap-2">
            {showDownloadButton && (
              <PdfMerge.DownloadButton>
                <span className="rounded-md px-3 py-1.5 text-xs font-semibold" style={{ background: 'var(--lokvis-pdf-primary, #6366f1)', color: '#ffffff', borderRadius: 'var(--lokvis-pdf-radius, 0.5rem)' }}>
                  {t('pdfMerge.download')}
                </span>
              </PdfMerge.DownloadButton>
            )}
            {showResetButton && (
              <PdfMerge.ResetButton>
                <span className="rounded-md px-2.5 py-1 text-xs font-medium" style={{ color: 'var(--lokvis-pdf-text-muted, #71717a)' }}>
                  {t('pdfMerge.retry')}
                </span>
              </PdfMerge.ResetButton>
            )}
          </div>
          <PdfMerge.ErrorDisplay />
        </footer>
      </PdfMerge.Root>
    </div>
  );
}

/** 默认导出:用 ErrorBoundary 包裹 */
export default function EmbedPdfMerge(props: EmbedPdfMergeProps) {
  return (
    <ErrorBoundary locale={props.locale} translations={props.translations}>
      <EmbedPdfMergeDefault {...props} />
    </ErrorBoundary>
  );
}
