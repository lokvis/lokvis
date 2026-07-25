/**
 * EmbedPdfRotate — PDF 旋转默认 UI(Layer 2)。
 *
 * 预设:90° / 180° / 270°
 * 内置 ErrorBoundary。
 */
import type { CSSProperties } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { useLang } from './i18n/useLang';
import { useTranslations } from './i18n/utils';
import type { Language } from './i18n/config';
import type { EmbedPdfTranslations } from './i18n/EmbedPdfI18nProvider';
import { themeToCssVars, useEmbedPdfMode, type EmbedPdfTheme, type EmbedPdfMode } from './theme';
import { PdfRotate } from './primitives/PdfRotate';
import type { PdfRotatePreset, UsePdfRotateOptions } from './hooks/usePdfRotate';

// ─── Props ────────────────────────────────────────────────

export interface EmbedPdfRotateProps extends UsePdfRotateOptions {
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

const ROTATE_PRESET_KEY: Record<PdfRotatePreset, string> = {
  '90': 'pdfRotate.preset90',
  '180': 'pdfRotate.preset180',
  '270': 'pdfRotate.preset270',
};

// ─── 默认 UI 实现 ─────────────────────────────────────────

function EmbedPdfRotateDefault({
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
}: EmbedPdfRotateProps) {
  const lang = useLang(locale);
  const t = useTranslations(lang, translations);
  const cssVars = themeToCssVars(theme);
  const resolvedMode = useEmbedPdfMode(mode);

  return (
    <div
      className={`lokvis-embed-pdf-rotate flex flex-col gap-3 rounded-lg p-3 ${className}`}
      data-embed-mode={resolvedMode}
      style={{
        background: 'var(--lokvis-pdf-bg, transparent)',
        color: 'var(--lokvis-pdf-text, #18181b)',
        fontFamily: 'var(--lokvis-pdf-font-family, inherit)',
        ...cssVars,
        ...style,
      }}
    >
      <PdfRotate.Root {...hookOptions}>
        {/* header */}
        <header className="flex flex-col gap-2">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--lokvis-pdf-text, #18181b)' }}>
              {t('pdfRotate.title')}
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--lokvis-pdf-text-muted, #71717a)' }}>
              {t('pdfRotate.subtitle')}
            </p>
          </div>
          <PdfRotate.Upload>
            <span className="text-xs" style={{ color: 'var(--lokvis-pdf-text-muted, #71717a)' }}>
              {t('pdfRotate.dropHint')}
            </span>
          </PdfRotate.Upload>
          {showPresetSwitcher && (
            <PdfRotate.PresetSwitcher
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
                  {t(ROTATE_PRESET_KEY[preset])}
                </button>
              )}
            />
          )}
        </header>

        {/* footer */}
        <footer className="flex flex-col gap-2">
          <div className="flex items-center justify-end gap-2">
            {showDownloadButton && (
              <PdfRotate.DownloadButton>
                <span className="rounded-md px-3 py-1.5 text-xs font-semibold" style={{ background: 'var(--lokvis-pdf-primary, #6366f1)', color: '#ffffff', borderRadius: 'var(--lokvis-pdf-radius, 0.5rem)' }}>
                  {t('pdfRotate.download')}
                </span>
              </PdfRotate.DownloadButton>
            )}
            {showResetButton && (
              <PdfRotate.ResetButton>
                <span className="rounded-md px-2.5 py-1 text-xs font-medium" style={{ color: 'var(--lokvis-pdf-text-muted, #71717a)' }}>
                  {t('pdfRotate.retry')}
                </span>
              </PdfRotate.ResetButton>
            )}
          </div>
          <PdfRotate.ErrorDisplay />
        </footer>
      </PdfRotate.Root>
    </div>
  );
}

/** 默认导出:用 ErrorBoundary 包裹 */
export default function EmbedPdfRotate(props: EmbedPdfRotateProps) {
  return (
    <ErrorBoundary locale={props.locale} translations={props.translations}>
      <EmbedPdfRotateDefault {...props} />
    </ErrorBoundary>
  );
}
