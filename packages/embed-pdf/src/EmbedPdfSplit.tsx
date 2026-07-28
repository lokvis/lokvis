/**
 * EmbedPdfSplit — PDF 拆分默认 UI(Layer 2)。
 *
 * 预设:every-page / 2-pages / 5-pages
 * 内置 ErrorBoundary。
 */
import type { CSSProperties } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { useLang } from './i18n/useLang';
import { useTranslations } from './i18n/utils';
import type { Language } from './i18n/config';
import type { EmbedPdfTranslations } from './i18n/EmbedPdfI18nProvider';
import { themeToCssVars, useEmbedPdfMode, type EmbedPdfTheme, type EmbedPdfMode } from './theme';
import { PdfSplit } from './primitives/PdfSplit';
import type { PdfSplitPreset, UsePdfSplitOptions } from './hooks/usePdfSplit';

// ─── Props ────────────────────────────────────────────────

export interface EmbedPdfSplitProps extends UsePdfSplitOptions {
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

// ─── preset → i18n key 映射 ──────────────────────────────

const SPLIT_PRESET_KEY: Record<PdfSplitPreset, string> = {
  'every-page': 'pdfSplit.presetEveryPage',
  '2-pages': 'pdfSplit.preset2Pages',
  '5-pages': 'pdfSplit.preset5Pages',
  custom: 'pdfSplit.presetCustom',
};

// ─── 默认 UI 实现 ─────────────────────────────────────────

function EmbedPdfSplitDefault({
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
}: EmbedPdfSplitProps) {
  const lang = useLang(locale);
  const t = useTranslations(lang, translations);
  const cssVars = themeToCssVars(theme);
  const resolvedMode = useEmbedPdfMode(mode);

  return (
    <div
      className={`lokvis-embed-pdf-split flex flex-col gap-3 rounded-lg p-3 ${className}`}
      data-embed-mode={resolvedMode}
      style={{
        background: 'var(--lokvis-pdf-bg, transparent)',
        color: 'var(--lokvis-pdf-text, #18181b)',
        fontFamily: 'var(--lokvis-pdf-font-family, inherit)',
        ...cssVars,
        ...style,
      }}
    >
      <PdfSplit.Root {...hookOptions}>
        {/* header */}
        <header className="flex flex-col gap-2">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--lokvis-pdf-text, #18181b)' }}>
              {t('pdfSplit.title')}
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--lokvis-pdf-text-muted, #71717a)' }}>
              {t('pdfSplit.subtitle')}
            </p>
          </div>
          <PdfSplit.Upload>
            <span className="text-xs" style={{ color: 'var(--lokvis-pdf-text-muted, #71717a)' }}>
              {t('pdfSplit.dropHint')}
            </span>
          </PdfSplit.Upload>
          {showPresetSwitcher && (
            <PdfSplit.PresetSwitcher
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
                  {t(SPLIT_PRESET_KEY[preset])}
                </button>
              )}
            />
          )}
        </header>

        {/* body: output count */}
        <PdfSplit.OutputCount />

        {/* footer */}
        <footer className="flex flex-col gap-2">
          <div className="flex items-center justify-end gap-2">
            {showDownloadButton && (
              <PdfSplit.DownloadAllButton>
                <span className="rounded-md px-3 py-1.5 text-xs font-semibold" style={{ background: 'var(--lokvis-pdf-primary, #6366f1)', color: '#ffffff', borderRadius: 'var(--lokvis-pdf-radius, 0.5rem)' }}>
                  {t('pdfSplit.download')}
                </span>
              </PdfSplit.DownloadAllButton>
            )}
            {showResetButton && (
              <PdfSplit.ResetButton>
                <span className="rounded-md px-2.5 py-1 text-xs font-medium" style={{ color: 'var(--lokvis-pdf-text-muted, #71717a)' }}>
                  {t('pdfSplit.retry')}
                </span>
              </PdfSplit.ResetButton>
            )}
          </div>
          <PdfSplit.ErrorDisplay />
        </footer>
      </PdfSplit.Root>
    </div>
  );
}

/** 默认导出:用 ErrorBoundary 包裹 */
export default function EmbedPdfSplit(props: EmbedPdfSplitProps) {
  return (
    <ErrorBoundary locale={props.locale} translations={props.translations}>
      <EmbedPdfSplitDefault {...props} />
    </ErrorBoundary>
  );
}
