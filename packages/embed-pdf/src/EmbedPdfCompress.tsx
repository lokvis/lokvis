/**
 * EmbedPdfCompress — PDF 压缩默认 UI(Layer 2)。
 *
 * 基于 Layer 1 原语 + Tailwind 默认样式,支持:
 *   1. theme prop:主题对象(转 CSS 变量)
 *   2. className/style:外层覆盖
 *   3. locale/translations:i18n 覆盖
 *
 * 内置 ErrorBoundary。
 */
import type { CSSProperties } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { useLang } from './i18n/useLang';
import { useTranslations } from './i18n/utils';
import type { Language } from './i18n/config';
import type { EmbedPdfTranslations } from './i18n/EmbedPdfI18nProvider';
import { themeToCssVars, useEmbedPdfMode, type EmbedPdfTheme, type EmbedPdfMode } from './theme';
import { PdfCompress } from './primitives/PdfCompress';
import type { PdfCompressPreset, UsePdfActionOptions } from './hooks/usePdfCompress';

// ─── Props ────────────────────────────────────────────────

export interface EmbedPdfCompressProps extends UsePdfActionOptions<PdfCompressPreset> {
  className?: string;
  style?: CSSProperties;
  showPresetSwitcher?: boolean;
  showDownloadButton?: boolean;
  showResetButton?: boolean;
  theme?: EmbedPdfTheme;
  mode?: EmbedPdfMode;
  locale?: Language;
  translations?: EmbedPdfTranslations;
}

// ─── 默认 UI 实现 ─────────────────────────────────────────

function EmbedPdfCompressDefault({
  className = '',
  style,
  showPresetSwitcher = true,
  showDownloadButton = true,
  showResetButton = true,
  theme,
  mode = 'system',
  locale,
  translations,
  ...hookOptions
}: EmbedPdfCompressProps) {
  const lang = useLang(locale);
  const t = useTranslations(lang, translations);
  const cssVars = themeToCssVars(theme);
  const resolvedMode = useEmbedPdfMode(mode);

  return (
    <div
      className={`lokvis-embed-pdf-compress flex flex-col gap-3 rounded-lg p-3 ${className}`}
      data-embed-mode={resolvedMode}
      style={{
        background: 'var(--lokvis-pdf-bg, transparent)',
        color: 'var(--lokvis-pdf-text, #18181b)',
        fontFamily: 'var(--lokvis-pdf-font-family, inherit)',
        ...cssVars,
        ...style,
      }}
    >
      <PdfCompress.Root {...hookOptions}>
        {/* header */}
        <header className="flex flex-col gap-2">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--lokvis-pdf-text, #18181b)' }}>
              {t('pdfCompress.title')}
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--lokvis-pdf-text-muted, #71717a)' }}>
              {t('pdfCompress.subtitle')}
            </p>
          </div>
          <PdfCompress.Upload>
            <span className="text-xs" style={{ color: 'var(--lokvis-pdf-text-muted, #71717a)' }}>
              {t('pdfCompress.dropHint')}
            </span>
          </PdfCompress.Upload>
          {showPresetSwitcher && (
            <PdfCompress.PresetSwitcher
              renderButton={(preset, active) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                  style={{
                    background: active ? 'var(--lokvis-pdf-primary, #6366f1)' : 'var(--lokvis-pdf-surface, #ffffff)',
                    color: active ? '#ffffff' : 'var(--lokvis-pdf-text-muted, #71717a)',
                    border: '1px solid var(--lokvis-pdf-border, #e4e4e7)',
                    borderRadius: 'var(--lokvis-pdf-radius, 0.5rem)',
                  }}
                >
                  {t(`pdfCompress.preset${preset.charAt(0).toUpperCase()}${preset.slice(1)}`)}
                </button>
              )}
            />
          )}
        </header>

        {/* body: file info */}
        <PdfCompress.Preview type="output" />

        {/* footer */}
        <footer className="flex flex-col gap-2">
          <PdfCompress.RatioBadge
            format={(ratio) => `${ratio > 0 ? '-' : '+'}${Math.abs(ratio).toFixed(1)}%`}
          />
          <div className="flex items-center justify-end gap-2">
            {showDownloadButton && (
              <PdfCompress.DownloadButton>
                <span className="rounded-md px-3 py-1.5 text-xs font-semibold" style={{ background: 'var(--lokvis-pdf-primary, #6366f1)', color: '#ffffff', borderRadius: 'var(--lokvis-pdf-radius, 0.5rem)' }}>
                  {t('pdfCompress.download')}
                </span>
              </PdfCompress.DownloadButton>
            )}
            {showResetButton && (
              <PdfCompress.ResetButton>
                <span className="rounded-md px-2.5 py-1 text-xs font-medium" style={{ color: 'var(--lokvis-pdf-text-muted, #71717a)' }}>
                  {t('pdfCompress.retry')}
                </span>
              </PdfCompress.ResetButton>
            )}
          </div>
          <PdfCompress.ErrorDisplay />
        </footer>
      </PdfCompress.Root>
    </div>
  );
}

/** 默认导出:用 ErrorBoundary 包裹 */
export default function EmbedPdfCompress(props: EmbedPdfCompressProps) {
  return (
    <ErrorBoundary locale={props.locale} translations={props.translations}>
      <EmbedPdfCompressDefault {...props} />
    </ErrorBoundary>
  );
}
