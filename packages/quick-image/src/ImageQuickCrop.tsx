/**
 * ImageQuickCrop — 一键裁剪默认 UI(Layer 2)。
 *
 * 基于 Layer 1 原语 + Tailwind 默认样式,支持三种定制方式:
 *   1. theme prop:主题对象(转 CSS 变量)
 *   2. components prop:替换子组件
 *   3. className/style:外层覆盖
 *
 * 默认布局与 ImageQuickResize 类似,但 preview 区可切换为 CropArea(显示裁剪框)。
 *
 * 内置 ErrorBoundary(符合 AGENTS.md 硬约束)。
 */
import type { ComponentType, CSSProperties, ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { useLang } from './i18n/useLang';
import { useTranslations } from './i18n/utils';
import type { Language } from './i18n/config';
import type { QuickTranslations } from './i18n/QuickI18nProvider';
import { themeToCssVars, type QuickTheme } from './theme';
import { QuickCrop } from './primitives/QuickCrop';
import {
  CROP_PRESETS,
  type CropPreset,
  type UseQuickActionOptions,
} from './hooks/useQuickCrop';

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

export interface CropAreaBoxProps {
  className?: string;
  style?: CSSProperties;
}

export interface DownloadButtonProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
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

export interface QuickCropComponents {
  UploadBox: ComponentType<UploadBoxProps>;
  PreviewBox: ComponentType<PreviewBoxProps>;
  PresetSwitcher: ComponentType<PresetSwitcherProps>;
  CropAreaBox: ComponentType<CropAreaBoxProps>;
  DownloadButton: ComponentType<DownloadButtonProps>;
  ErrorDisplay: ComponentType<ErrorDisplayProps>;
  ResetButton: ComponentType<ResetButtonProps>;
}

// ─── 默认子组件 ────────────────────────────────────────────

function DefaultUploadBox({ className = '', style }: UploadBoxProps) {
  return (
    <QuickCrop.Upload
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
    </QuickCrop.Upload>
  );
}

function DefaultPreviewBox({ type, className = '', style }: PreviewBoxProps) {
  return (
    <QuickCrop.Preview
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

function presetLabel(preset: CropPreset): string {
  return CROP_PRESETS[preset].label;
}

function DefaultPresetSwitcher({ className = '', style }: PresetSwitcherProps) {
  return (
    <QuickCrop.PresetSwitcher
      className={`flex flex-wrap gap-1 ${className}`}
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

function DefaultCropAreaBox({ className = '', style }: CropAreaBoxProps) {
  return (
    <QuickCrop.CropArea
      className={`relative flex flex-1 items-center justify-center overflow-hidden rounded-lg p-2 ${className}`}
      style={{
        background: 'var(--lokvis-surface)',
        border: '1px solid var(--lokvis-border)',
        borderRadius: 'var(--lokvis-radius)',
        minHeight: '200px',
        color: 'var(--lokvis-primary)',
        ...style,
      }}
      placeholder={<span style={{ color: 'var(--lokvis-text-muted)', fontSize: '0.75rem' }}>No image</span>}
    />
  );
}

function DefaultDownloadButton({ className = '', style, children }: DownloadButtonProps) {
  return (
    <QuickCrop.DownloadButton
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
    </QuickCrop.DownloadButton>
  );
}

function DefaultErrorDisplay({ className = '', style }: ErrorDisplayProps) {
  return (
    <QuickCrop.ErrorDisplay
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
    <QuickCrop.ResetButton
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
    </QuickCrop.ResetButton>
  );
}

// ─── ImageQuickCrop Props ─────────────────────────────────

export interface ImageQuickCropProps extends UseQuickActionOptions<CropPreset> {
  className?: string;
  style?: CSSProperties;
  showPresetSwitcher?: boolean;
  /** 是否显示 CropArea(裁剪区域叠加层);默认 true */
  showCropArea?: boolean;
  /** 是否显示 before/after 对比(默认 true;false 时只显示 output) */
  showBeforeAfter?: boolean;
  showDownloadButton?: boolean;
  showResetButton?: boolean;
  theme?: QuickTheme;
  components?: Partial<QuickCropComponents>;
  /** 显式 locale 覆盖(优先级高于 QuickI18nProvider 与 <html lang> 检测) */
  locale?: Language;
  /** 翻译覆盖(优先级高于 QuickI18nProvider.translations) */
  translations?: QuickTranslations;
}

// ─── 默认 UI 实现 ─────────────────────────────────────────

function ImageQuickCropDefault({
  className = '',
  style,
  showPresetSwitcher = true,
  showCropArea = true,
  showBeforeAfter = true,
  showDownloadButton = true,
  showResetButton = true,
  theme,
  components,
  locale,
  translations,
  ...hookOptions
}: ImageQuickCropProps) {
  const lang = useLang(locale);
  const t = useTranslations(lang, translations);
  const cssVars = themeToCssVars(theme);

  const {
    UploadBox = DefaultUploadBox,
    PreviewBox = DefaultPreviewBox,
    PresetSwitcher = DefaultPresetSwitcher,
    CropAreaBox = DefaultCropAreaBox,
    DownloadButton = DefaultDownloadButton,
    ErrorDisplay = DefaultErrorDisplay,
    ResetButton = DefaultResetButton,
  } = components ?? {};

  return (
    <div
      className={`lokvis-quick-crop flex flex-col gap-3 rounded-lg p-3 ${className}`}
      style={{
        background: 'var(--lokvis-bg)',
        color: 'var(--lokvis-text)',
        fontFamily: 'var(--lokvis-font-family)',
        ...cssVars,
        ...style,
      }}
    >
      <QuickCrop.Root {...hookOptions}>
        <header className="flex flex-col gap-2">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--lokvis-text)' }}>
              {t('quickCrop.title')}
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--lokvis-text-muted)' }}>
              {t('quickCrop.subtitle')}
            </p>
          </div>
          <UploadBox />
          {showPresetSwitcher && <PresetSwitcher />}
        </header>

        {showCropArea && (
          <div className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: 'var(--lokvis-text-muted)' }}>
              {t('quickCrop.cropArea')}
            </span>
            <CropAreaBox />
          </div>
        )}

        <div className={`grid grid-cols-1 gap-2 ${showBeforeAfter ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
          {showBeforeAfter && <PreviewBox type="input" />}
          <PreviewBox type="output" />
        </div>

        <footer className="flex flex-col gap-2">
          <div className="flex items-center justify-end gap-2">
            {showDownloadButton && <DownloadButton>{t('quickCrop.download')}</DownloadButton>}
            {showResetButton && <ResetButton>{t('quickCrop.retry')}</ResetButton>}
          </div>
          <ErrorDisplay />
        </footer>
      </QuickCrop.Root>
    </div>
  );
}

export default function ImageQuickCrop(props: ImageQuickCropProps) {
  return (
    <ErrorBoundary locale={props.locale} translations={props.translations}>
      <ImageQuickCropDefault {...props} />
    </ErrorBoundary>
  );
}
