/**
 * ImageQuickResize — 一键缩放默认 UI(Layer 2)。
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
import { QuickResize } from './primitives/QuickResize';
import { RESIZE_PRESETS, type ResizePreset, type UseQuickActionOptions } from './useQuickResize';

// ─── 子组件契约(供 components prop 替换) ─────────────────

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

export interface DimensionBadgeProps {
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

export interface QuickResizeComponents {
  UploadBox: ComponentType<UploadBoxProps>;
  PreviewBox: ComponentType<PreviewBoxProps>;
  PresetSwitcher: ComponentType<PresetSwitcherProps>;
  DownloadButton: ComponentType<DownloadButtonProps>;
  DimensionBadge: ComponentType<DimensionBadgeProps>;
  ErrorDisplay: ComponentType<ErrorDisplayProps>;
  ResetButton: ComponentType<ResetButtonProps>;
}

// ─── 默认子组件 ────────────────────────────────────────────

function DefaultUploadBox({ className = '', style }: UploadBoxProps) {
  return (
    <QuickResize.Upload
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
    </QuickResize.Upload>
  );
}

function DefaultPreviewBox({ type, className = '', style }: PreviewBoxProps) {
  return (
    <QuickResize.Preview
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

function presetLabel(preset: ResizePreset): string {
  const config = RESIZE_PRESETS[preset];
  if (config.scale !== undefined) {
    return `${Math.round(config.scale * 100)}%`;
  }
  return `${config.width}×${config.height}`;
}

function DefaultPresetSwitcher({ className = '', style }: PresetSwitcherProps) {
  return (
    <QuickResize.PresetSwitcher
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
    <QuickResize.DownloadButton
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
    </QuickResize.DownloadButton>
  );
}

function DefaultDimensionBadge({ className = '', style }: DimensionBadgeProps) {
  return (
    <QuickResize.DimensionBadge
      className={`text-xs font-medium ${className}`}
      style={style}
      format={(input, output) => `${input.width}×${input.height} → ${output.width}×${output.height}`}
    />
  );
}

function DefaultErrorDisplay({ className = '', style }: ErrorDisplayProps) {
  return (
    <QuickResize.ErrorDisplay
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
    <QuickResize.ResetButton
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
    </QuickResize.ResetButton>
  );
}

// ─── ImageQuickResize Props ────────────────────────────────

export interface ImageQuickResizeProps extends UseQuickActionOptions<ResizePreset> {
  className?: string;
  style?: CSSProperties;
  showPresetSwitcher?: boolean;
  showBeforeAfter?: boolean;
  showDimension?: boolean;
  showDownloadButton?: boolean;
  showResetButton?: boolean;
  theme?: QuickTheme;
  components?: Partial<QuickResizeComponents>;
}

// ─── 默认 UI 实现 ─────────────────────────────────────────

function ImageQuickResizeDefault({
  className = '',
  style,
  showPresetSwitcher = true,
  showBeforeAfter = true,
  showDimension = true,
  showDownloadButton = true,
  showResetButton = true,
  theme,
  components,
  ...hookOptions
}: ImageQuickResizeProps) {
  const lang = useLang();
  const t = useTranslations(lang);
  const cssVars = themeToCssVars(theme);

  const {
    UploadBox = DefaultUploadBox,
    PreviewBox = DefaultPreviewBox,
    PresetSwitcher = DefaultPresetSwitcher,
    DownloadButton = DefaultDownloadButton,
    DimensionBadge = DefaultDimensionBadge,
    ErrorDisplay = DefaultErrorDisplay,
    ResetButton = DefaultResetButton,
  } = components ?? {};

  return (
    <div
      className={`lokvis-quick-resize flex flex-col gap-3 rounded-lg p-3 ${className}`}
      style={{
        background: 'var(--lokvis-bg)',
        color: 'var(--lokvis-text)',
        fontFamily: 'var(--lokvis-font-family)',
        ...cssVars,
        ...style,
      }}
    >
      <QuickResize.Root {...hookOptions}>
        <header className="flex flex-col gap-2">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--lokvis-text)' }}>
              {t('quickResize.title')}
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--lokvis-text-muted)' }}>
              {t('quickResize.subtitle')}
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
          {showDimension && <DimensionBadge />}
          <div className="flex items-center justify-end gap-2">
            {showDownloadButton && <DownloadButton>{t('quickResize.download')}</DownloadButton>}
            {showResetButton && <ResetButton>{t('quickResize.retry')}</ResetButton>}
          </div>
          <ErrorDisplay />
        </footer>
      </QuickResize.Root>
    </div>
  );
}

export default function ImageQuickResize(props: ImageQuickResizeProps) {
  return (
    <ErrorBoundary>
      <ImageQuickResizeDefault {...props} />
    </ErrorBoundary>
  );
}
