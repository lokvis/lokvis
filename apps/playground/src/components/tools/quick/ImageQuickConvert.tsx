/**
 * ImageQuickConvert — 一键格式转换默认 UI(Layer 2)。
 *
 * 基于 Layer 1 原语 + Tailwind 默认样式,支持三种定制方式:
 *   1. theme prop:主题对象(转 CSS 变量)
 *   2. components prop:替换子组件
 *   3. className/style:外层覆盖
 *
 * 内置 ErrorBoundary(符合 AGENTS.md 硬约束)。
 */
import type { ComponentType, CSSProperties, ReactNode } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';
import { themeToCssVars, type QuickTheme } from './theme';
import { QuickConvert } from './primitives/QuickConvert';
import { CONVERT_PRESETS, type ConvertPreset, type UseQuickActionOptions } from './useQuickConvert';

// ─── 子组件契约 ────────────────────────────────────────────

export interface UploadBoxProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export interface PreviewBoxProps {
  type: 'input' | 'output';
  className?: string;
  style?: CSSProperties;
}

export interface PresetSwitcherProps {
  className?: string;
  style?: CSSProperties;
}

export interface DownloadButtonProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export interface FormatBadgeProps {
  className?: string;
  style?: CSSProperties;
}

export interface ErrorDisplayProps {
  className?: string;
  style?: CSSProperties;
}

export interface ResetButtonProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export interface QuickConvertComponents {
  UploadBox: ComponentType<UploadBoxProps>;
  PreviewBox: ComponentType<PreviewBoxProps>;
  PresetSwitcher: ComponentType<PresetSwitcherProps>;
  DownloadButton: ComponentType<DownloadButtonProps>;
  FormatBadge: ComponentType<FormatBadgeProps>;
  ErrorDisplay: ComponentType<ErrorDisplayProps>;
  ResetButton: ComponentType<ResetButtonProps>;
}

// ─── 默认子组件 ────────────────────────────────────────────

function DefaultUploadBox({ className = '', style }: UploadBoxProps) {
  return (
    <QuickConvert.Upload
      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors hover:bg-[var(--lokvis-surface-hover)] ${className}`}
      style={{
        borderColor: 'var(--lokvis-border)',
        background: 'var(--lokvis-surface)',
        ...style,
      }}
    >
      {({ isDragging }) => (
        <span
          className="text-xs"
          style={{
            color: isDragging ? 'var(--lokvis-primary)' : 'var(--lokvis-text-muted)',
          }}
        >
          {isDragging ? '↓ Drop image' : 'Click or drop image'}
        </span>
      )}
    </QuickConvert.Upload>
  );
}

function DefaultPreviewBox({ type, className = '', style }: PreviewBoxProps) {
  return (
    <QuickConvert.Preview
      type={type}
      className={`flex flex-1 flex-col items-center justify-center overflow-hidden rounded-lg p-2 ${className}`}
      style={{
        background: 'var(--lokvis-surface)',
        border: '1px solid var(--lokvis-border)',
        borderRadius: 'var(--lokvis-radius)',
        minHeight: '160px',
        ...style,
      }}
      placeholder={<span style={{ color: 'var(--lokvis-text-muted)', fontSize: '0.75rem' }}>No image</span>}
    />
  );
}

function presetLabel(preset: ConvertPreset): string {
  return CONVERT_PRESETS[preset].label;
}

function DefaultPresetSwitcher({ className = '', style }: PresetSwitcherProps) {
  return (
    <QuickConvert.PresetSwitcher
      className={`flex gap-1 ${className}`}
      style={style}
      renderButton={(preset, isSelected, onClick) => (
        <button
          type="button"
          role="radio"
          aria-checked={isSelected}
          onClick={onClick}
          className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
          style={{
            background: isSelected ? 'var(--lokvis-primary)' : 'var(--lokvis-surface)',
            color: isSelected ? '#ffffff' : 'var(--lokvis-text-muted)',
            border: '1px solid var(--lokvis-border)',
            borderRadius: 'var(--lokvis-radius)',
            cursor: 'pointer',
          }}
        >
          {presetLabel(preset)}
        </button>
      )}
    />
  );
}

function DefaultDownloadButton({ className = '', style, children }: DownloadButtonProps) {
  return (
    <QuickConvert.DownloadButton
      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${className}`}
      style={{
        background: 'var(--lokvis-primary)',
        color: '#ffffff',
        border: 'none',
        borderRadius: 'var(--lokvis-radius)',
        cursor: 'pointer',
        ...style,
      }}
    >
      {children ?? 'Download'}
    </QuickConvert.DownloadButton>
  );
}

function DefaultFormatBadge({ className = '', style }: FormatBadgeProps) {
  return (
    <QuickConvert.FormatBadge
      className={`text-xs font-medium ${className}`}
      style={style}
      format={(input, output) => `${input} → ${output}`}
    />
  );
}

function DefaultErrorDisplay({ className = '', style }: ErrorDisplayProps) {
  return (
    <QuickConvert.ErrorDisplay
      className={`text-xs ${className}`}
      style={{
        color: 'var(--lokvis-error)',
        ...style,
      }}
    />
  );
}

function DefaultResetButton({ className = '', style, children }: ResetButtonProps) {
  return (
    <QuickConvert.ResetButton
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${className}`}
      style={{
        background: 'var(--lokvis-surface)',
        color: 'var(--lokvis-text-muted)',
        border: '1px solid var(--lokvis-border)',
        borderRadius: 'var(--lokvis-radius)',
        cursor: 'pointer',
        ...style,
      }}
    >
      {children ?? 'Try another'}
    </QuickConvert.ResetButton>
  );
}

// ─── ImageQuickConvert Props ───────────────────────────────

export interface ImageQuickConvertProps extends UseQuickActionOptions<ConvertPreset> {
  className?: string;
  style?: CSSProperties;
  showPresetSwitcher?: boolean;
  showBeforeAfter?: boolean;
  showFormat?: boolean;
  showDownloadButton?: boolean;
  showResetButton?: boolean;
  theme?: QuickTheme;
  components?: Partial<QuickConvertComponents>;
}

// ─── 默认 UI 实现 ─────────────────────────────────────────

function ImageQuickConvertDefault({
  className = '',
  style,
  showPresetSwitcher = true,
  showBeforeAfter = true,
  showFormat = true,
  showDownloadButton = true,
  showResetButton = true,
  theme,
  components,
  ...hookOptions
}: ImageQuickConvertProps) {
  const lang = useLang();
  const t = useTranslations(lang);
  const cssVars = themeToCssVars(theme);

  const {
    UploadBox = DefaultUploadBox,
    PreviewBox = DefaultPreviewBox,
    PresetSwitcher = DefaultPresetSwitcher,
    DownloadButton = DefaultDownloadButton,
    FormatBadge = DefaultFormatBadge,
    ErrorDisplay = DefaultErrorDisplay,
    ResetButton = DefaultResetButton,
  } = components ?? {};

  return (
    <div
      className={`lokvis-quick-convert flex flex-col gap-3 rounded-lg p-3 ${className}`}
      style={{
        background: 'var(--lokvis-bg)',
        color: 'var(--lokvis-text)',
        fontFamily: 'var(--lokvis-font-family)',
        ...cssVars,
        ...style,
      }}
    >
      <QuickConvert.Root {...hookOptions}>
        <header className="flex flex-col gap-2">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--lokvis-text)' }}>
              {t('quickConvert.title')}
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--lokvis-text-muted)' }}>
              {t('quickConvert.subtitle')}
            </p>
          </div>
          <UploadBox />
          {showPresetSwitcher && <PresetSwitcher />}
        </header>

        <div className={`grid grid-cols-1 gap-2 ${showBeforeAfter ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
          {showBeforeAfter && <PreviewBox type="input" />}
          <PreviewBox type="output" />
        </div>

        <footer className="flex flex-col gap-2">
          {showFormat && <FormatBadge />}
          <div className="flex items-center justify-end gap-2">
            {showDownloadButton && <DownloadButton>{t('quickConvert.download')}</DownloadButton>}
            {showResetButton && <ResetButton>{t('quickConvert.retry')}</ResetButton>}
          </div>
          <ErrorDisplay />
        </footer>
      </QuickConvert.Root>
    </div>
  );
}

export default function ImageQuickConvert(props: ImageQuickConvertProps) {
  return (
    <ErrorBoundary>
      <ImageQuickConvertDefault {...props} />
    </ErrorBoundary>
  );
}
