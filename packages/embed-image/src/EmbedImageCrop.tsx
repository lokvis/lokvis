/**
 * EmbedImageCrop — 一键裁剪默认 UI(Layer 2)。
 *
 * 基于 Layer 1 原语 + Tailwind 默认样式,支持三种定制方式:
 *   1. theme prop:主题对象(转 CSS 变量)
 *   2. components prop:替换子组件
 *   3. className/style:外层覆盖
 *
 * 默认布局与 EmbedImageResize 类似,但 preview 区可切换为 CropArea(显示裁剪框)。
 *
 * 内置 ErrorBoundary(符合 AGENTS.md 硬约束)。
 */
import type { ComponentType, CSSProperties, ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { useLang } from './i18n/useLang';
import { useTranslations } from './i18n/utils';
import type { Language } from './i18n/config';
import type { EmbedTranslations } from './i18n/EmbedI18nProvider';
import { BusyOverlay, FileInfoBar } from './internal/shared-ui';
import { themeToCssVars, useEmbedMode, type EmbedTheme, type EmbedMode } from './theme';
import { ImageCrop, useImageCropContext } from './primitives/ImageCrop';
import {
  IMAGE_CROP_PRESETS,
  type CropPreset,
  type UseEmbedActionOptions,
} from './hooks/useImageCrop';

// ─── 子组件契约 ────────────────────────────────────────────

export interface UploadBoxProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  /** drop zone 的 aria-label(F4 a11y:键盘用户 + 屏幕阅读器) */
  ariaLabel?: string;
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

export interface ImageCropComponents {
  UploadBox: ComponentType<UploadBoxProps>;
  PreviewBox: ComponentType<PreviewBoxProps>;
  PresetSwitcher: ComponentType<PresetSwitcherProps>;
  CropAreaBox: ComponentType<CropAreaBoxProps>;
  DownloadButton: ComponentType<DownloadButtonProps>;
  ErrorDisplay: ComponentType<ErrorDisplayProps>;
  ResetButton: ComponentType<ResetButtonProps>;
}

// ─── 默认子组件 ────────────────────────────────────────────

function DefaultUploadBox({ className = '', style, ariaLabel }: UploadBoxProps) {
  return (
    <ImageCrop.Upload
      aria-label={ariaLabel}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors hover:bg-[var(--lokvis-surface-hover,#f4f4f5)] ${className}`}
      style={{
        borderColor: 'var(--lokvis-border, #e4e4e7)',
        background: 'var(--lokvis-surface, #ffffff)',
        ...style,
      }}
    >
      {({ isDragging }) => (
        <span
          className="text-xs"
          style={{
            color: isDragging ? 'var(--lokvis-primary, #6366f1)' : 'var(--lokvis-text-muted, #71717a)',
          }}
        >
          {isDragging ? '↓ Drop image' : 'Click or drop image'}
        </span>
      )}
    </ImageCrop.Upload>
  );
}

function DefaultPreviewBox({ type, className = '', style }: PreviewBoxProps) {
  return (
    <ImageCrop.Preview
      type={type}
      showInfo={false}
      className={`flex flex-1 flex-col items-center justify-center overflow-hidden rounded-lg p-2 ${className}`}
      style={{
        background: 'var(--lokvis-surface, #ffffff)',
        border: '1px solid var(--lokvis-border, #e4e4e7)',
        borderRadius: 'var(--lokvis-radius, 0.5rem)',
        minHeight: '160px',
        ...style,
      }}
      placeholder={<span style={{ color: 'var(--lokvis-text-muted, #71717a)', fontSize: '0.75rem' }}>No image</span>}
    />
  );
}

function presetLabel(preset: CropPreset): string {
  return IMAGE_CROP_PRESETS[preset].label;
}

/** output 预览区 + busy overlay(F2:处理中视觉反馈) */
function CropOutputPreview({ processingLabel, children }: { processingLabel: string; children: ReactNode }) {
  const { busy } = useImageCropContext();
  return (
    <BusyOverlay busy={busy} label={processingLabel}>
      {children}
    </BusyOverlay>
  );
}

/** 文件信息栏(F3:format badge · WxH · formatBytes) */
function CropFileInfoBar({ type }: { type: 'input' | 'output' }) {
  const { inputInfo, outputInfo } = useImageCropContext();
  const info = type === 'input' ? inputInfo : outputInfo;
  return <FileInfoBar info={info} />;
}

function DefaultPresetSwitcher({ className = '', style }: PresetSwitcherProps) {
  const { busy } = useImageCropContext();
  return (
    <ImageCrop.PresetSwitcher
      className={`flex flex-wrap gap-1 ${className}`}
      style={style}
      renderButton={(preset, isSelected, onClick) => (
        <button
          type="button"
          role="radio"
          aria-checked={isSelected}
          disabled={busy}
          onClick={onClick}
          className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
          style={{
            background: isSelected ? 'var(--lokvis-primary, #6366f1)' : 'var(--lokvis-surface, #ffffff)',
            color: isSelected ? '#ffffff' : 'var(--lokvis-text-muted, #71717a)',
            border: '1px solid var(--lokvis-border, #e4e4e7)',
            borderRadius: 'var(--lokvis-radius, 0.5rem)',
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.5 : 1,
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
    <ImageCrop.CropArea
      className={`relative flex flex-1 items-center justify-center overflow-hidden rounded-lg p-2 ${className}`}
      style={{
        background: 'var(--lokvis-surface, #ffffff)',
        border: '1px solid var(--lokvis-border, #e4e4e7)',
        borderRadius: 'var(--lokvis-radius, 0.5rem)',
        minHeight: '200px',
        color: 'var(--lokvis-primary, #6366f1)',
        ...style,
      }}
      placeholder={<span style={{ color: 'var(--lokvis-text-muted, #71717a)', fontSize: '0.75rem' }}>No image</span>}
    />
  );
}

function DefaultDownloadButton({ className = '', style, children }: DownloadButtonProps) {
  return (
    <ImageCrop.DownloadButton
      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${className}`}
      style={{
        background: 'var(--lokvis-primary, #6366f1)',
        color: '#ffffff',
        border: 'none',
        borderRadius: 'var(--lokvis-radius, 0.5rem)',
        cursor: 'pointer',
        ...style,
      }}
    >
      {children ?? 'Download'}
    </ImageCrop.DownloadButton>
  );
}

function DefaultErrorDisplay({ className = '', style }: ErrorDisplayProps) {
  return (
    <ImageCrop.ErrorDisplay
      className={`text-xs ${className}`}
      style={{
        color: 'var(--lokvis-error, #ef4444)',
        ...style,
      }}
    />
  );
}

function DefaultResetButton({ className = '', style, children }: ResetButtonProps) {
  return (
    <ImageCrop.ResetButton
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${className}`}
      style={{
        background: 'var(--lokvis-surface, #ffffff)',
        color: 'var(--lokvis-text-muted, #71717a)',
        border: '1px solid var(--lokvis-border, #e4e4e7)',
        borderRadius: 'var(--lokvis-radius, 0.5rem)',
        cursor: 'pointer',
        ...style,
      }}
    >
      {children ?? 'Try another'}
    </ImageCrop.ResetButton>
  );
}

// ─── EmbedImageCrop Props ─────────────────────────────────

export interface EmbedImageCropProps extends UseEmbedActionOptions<CropPreset> {
  className?: string;
  style?: CSSProperties;
  showPresetSwitcher?: boolean;
  /** 是否显示 CropArea(裁剪区域叠加层);默认 true */
  showCropArea?: boolean;
  /** 是否显示 before/after 对比(默认 true;false 时只显示 output) */
  showBeforeAfter?: boolean;
  showDownloadButton?: boolean;
  showResetButton?: boolean;
  theme?: EmbedTheme;
  /** 主题模式(F1):'light' | 'dark' | 'system',默认 'system' 跟随系统 */
  mode?: EmbedMode;
  components?: Partial<ImageCropComponents>;
  /** 显式 locale 覆盖(优先级高于 EmbedI18nProvider 与 <html lang> 检测) */
  locale?: Language;
  /** 翻译覆盖(优先级高于 EmbedI18nProvider.translations) */
  translations?: EmbedTranslations;
}

// ─── 默认 UI 实现 ─────────────────────────────────────────

function EmbedImageCropDefault({
  className = '',
  style,
  showPresetSwitcher = true,
  showCropArea = true,
  showBeforeAfter = true,
  showDownloadButton = true,
  showResetButton = true,
  theme,
  mode = 'system',
  components,
  locale,
  translations,
  ...hookOptions
}: EmbedImageCropProps) {
  const lang = useLang(locale);
  const t = useTranslations(lang, translations);
  const cssVars = themeToCssVars(theme);
  const resolvedMode = useEmbedMode(mode);

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
      data-quick-mode={resolvedMode}
      style={{
        background: 'var(--lokvis-bg, transparent)',
        color: 'var(--lokvis-text, #18181b)',
        fontFamily: 'var(--lokvis-font-family, inherit)',
        ...cssVars,
        ...style,
      }}
    >
      <ImageCrop.Root {...hookOptions}>
        <header className="flex flex-col gap-2">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--lokvis-text, #18181b)' }}>
              {t('quickCrop.title')}
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--lokvis-text-muted, #71717a)' }}>
              {t('quickCrop.subtitle')}
            </p>
          </div>
          <UploadBox ariaLabel={t('quickCrop.dropHint')} />
          {showPresetSwitcher && <PresetSwitcher />}
        </header>

        {showCropArea && (
          <div className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: 'var(--lokvis-text-muted, #71717a)' }}>
              {t('quickCrop.cropArea')}
            </span>
            <CropAreaBox />
          </div>
        )}

        <div className={`grid grid-cols-1 gap-2 ${showBeforeAfter ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
          {showBeforeAfter && (
            <div className="flex flex-col gap-1">
              <PreviewBox type="input" />
              <CropFileInfoBar type="input" />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <CropOutputPreview processingLabel={t('quickCrop.processing')}>
              <PreviewBox type="output" />
            </CropOutputPreview>
            <CropFileInfoBar type="output" />
          </div>
        </div>

        <footer className="flex flex-col gap-2">
          <div className="flex items-center justify-end gap-2">
            {showDownloadButton && <DownloadButton>{t('quickCrop.download')}</DownloadButton>}
            {showResetButton && <ResetButton>{t('quickCrop.retry')}</ResetButton>}
          </div>
          <ErrorDisplay />
        </footer>
      </ImageCrop.Root>
    </div>
  );
}

export default function EmbedImageCrop(props: EmbedImageCropProps) {
  return (
    <ErrorBoundary locale={props.locale} translations={props.translations}>
      <EmbedImageCropDefault {...props} />
    </ErrorBoundary>
  );
}
