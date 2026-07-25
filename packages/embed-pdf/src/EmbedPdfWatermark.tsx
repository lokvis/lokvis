/**
 * EmbedPdfWatermark — PDF 水印默认 UI(Layer 2)。
 *
 * 预设:confidential / draft / custom + 文本输入
 * 内置 ErrorBoundary。
 */
import type { CSSProperties } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { useLang } from './i18n/useLang';
import { useTranslations } from './i18n/utils';
import type { Language } from './i18n/config';
import type { EmbedPdfTranslations } from './i18n/EmbedPdfI18nProvider';
import { themeToCssVars, useEmbedPdfMode, type EmbedPdfTheme, type EmbedPdfMode } from './theme';
import { PdfWatermark } from './primitives/PdfWatermark';
import type { PdfWatermarkPreset, UsePdfWatermarkOptions } from './hooks/usePdfWatermark';

// ─── Props ────────────────────────────────────────────────

export interface EmbedPdfWatermarkProps extends UsePdfWatermarkOptions {
  className?: string;
  style?: CSSProperties;
  showPresetSwitcher?: boolean;
  showTextInput?: boolean;
  showDownloadButton?: boolean;
  showResetButton?: boolean;
  theme?: EmbedPdfTheme;
  mode?: EmbedPdfMode;
  locale?: Language;
  translations?: EmbedPdfTranslations;
}

// ─── preset → i18n key 映射 ──────────────────────────────

const WATERMARK_PRESET_KEY: Record<PdfWatermarkPreset, string> = {
  confidential: 'pdfWatermark.presetConfidential',
  draft: 'pdfWatermark.presetDraft',
  custom: 'pdfWatermark.presetCustom',
};

// ─── 默认 UI 实现 ─────────────────────────────────────────

function EmbedPdfWatermarkDefault({
  className = '',
  style,
  showPresetSwitcher = true,
  showTextInput = true,
  showDownloadButton = true,
  showResetButton = true,
  theme,
  mode = 'system',
  locale,
  translations,
  ...hookOptions
}: EmbedPdfWatermarkProps) {
  const lang = useLang(locale);
  const t = useTranslations(lang, translations);
  const cssVars = themeToCssVars(theme);
  const resolvedMode = useEmbedPdfMode(mode);

  return (
    <div
      className={`lokvis-embed-pdf-watermark flex flex-col gap-3 rounded-lg p-3 ${className}`}
      data-embed-mode={resolvedMode}
      style={{
        background: 'var(--lokvis-pdf-bg, transparent)',
        color: 'var(--lokvis-pdf-text, #18181b)',
        fontFamily: 'var(--lokvis-pdf-font-family, inherit)',
        ...cssVars,
        ...style,
      }}
    >
      <PdfWatermark.Root {...hookOptions}>
        {/* header */}
        <header className="flex flex-col gap-2">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--lokvis-pdf-text, #18181b)' }}>
              {t('pdfWatermark.title')}
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--lokvis-pdf-text-muted, #71717a)' }}>
              {t('pdfWatermark.subtitle')}
            </p>
          </div>
          <PdfWatermark.Upload>
            <span className="text-xs" style={{ color: 'var(--lokvis-pdf-text-muted, #71717a)' }}>
              {t('pdfWatermark.dropHint')}
            </span>
          </PdfWatermark.Upload>
          {showPresetSwitcher && (
            <PdfWatermark.PresetSwitcher
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
                  {t(WATERMARK_PRESET_KEY[preset])}
                </button>
              )}
            />
          )}
          {showTextInput && (
            <PdfWatermark.TextInput placeholder={t('pdfWatermark.textPlaceholder')} />
          )}
        </header>

        {/* footer */}
        <footer className="flex flex-col gap-2">
          <div className="flex items-center justify-end gap-2">
            {showDownloadButton && (
              <PdfWatermark.DownloadButton>
                <span className="rounded-md px-3 py-1.5 text-xs font-semibold" style={{ background: 'var(--lokvis-pdf-primary, #6366f1)', color: '#ffffff', borderRadius: 'var(--lokvis-pdf-radius, 0.5rem)' }}>
                  {t('pdfWatermark.download')}
                </span>
              </PdfWatermark.DownloadButton>
            )}
            {showResetButton && (
              <PdfWatermark.ResetButton>
                <span className="rounded-md px-2.5 py-1 text-xs font-medium" style={{ color: 'var(--lokvis-pdf-text-muted, #71717a)' }}>
                  {t('pdfWatermark.retry')}
                </span>
              </PdfWatermark.ResetButton>
            )}
          </div>
          <PdfWatermark.ErrorDisplay />
        </footer>
      </PdfWatermark.Root>
    </div>
  );
}

/** 默认导出:用 ErrorBoundary 包裹 */
export default function EmbedPdfWatermark(props: EmbedPdfWatermarkProps) {
  return (
    <ErrorBoundary locale={props.locale} translations={props.translations}>
      <EmbedPdfWatermarkDefault {...props} />
    </ErrorBoundary>
  );
}
