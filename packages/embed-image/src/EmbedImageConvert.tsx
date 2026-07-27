/**
 * EmbedImageConvert — 一键格式转换默认 UI(Layer 2)。
 *
 * 基于 Layer 1 原语 + Tailwind 默认样式,支持三种定制方式:
 *   1. theme prop:主题对象(转 CSS 变量)
 *   2. components prop:替换子组件
 *   3. className/style:外层覆盖
 *
 * 内置 ErrorBoundary(符合 AGENTS.md 硬约束)。
 */
import type { ComponentType, CSSProperties, ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { useLang } from './i18n/useLang';
import { useTranslations } from './i18n/utils';
import type { Language } from './i18n/config';
import type { EmbedTranslations } from './i18n/EmbedI18nProvider';
import {
  BusyOverlay as DefaultBusyOverlay,
  FileInfoBar as DefaultFileInfoBar,
  type BusyOverlayProps,
  type FileInfoBarProps,
} from './internal/shared-ui';
import { themeToCssVars, useEmbedMode, type EmbedTheme, type EmbedMode } from './theme';
import { ImageConvert, useImageConvertContext } from './primitives/ImageConvert';
import { IMAGE_CONVERT_PRESETS, type ConvertPreset, type UseEmbedActionOptions } from './hooks/useImageConvert';

// ─── 子组件契约 ────────────────────────────────────────────

export interface UploadBoxProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  /** drop zone 的 aria-label(F4 a11y:键盘用户 + 屏幕阅读器) */
  ariaLabel?: string;
  /** 非拖拽态提示文案(已 i18n;默认 UI 注入 t('quickConvert.dropHint')) */
  label?: string;
  /** 拖拽态提示文案(已 i18n;默认 UI 注入 t('common.dropHere')) */
  dragLabel?: string;
}

export interface PreviewBoxProps {
  type: 'input' | 'output';
  className?: string;
  style?: CSSProperties;
  /** 无图时的占位文案(已 i18n;默认 UI 注入 t('common.noImage')) */
  placeholderLabel?: string;
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

export interface ImageConvertComponents {
  UploadBox: ComponentType<UploadBoxProps>;
  PreviewBox: ComponentType<PreviewBoxProps>;
  PresetSwitcher: ComponentType<PresetSwitcherProps>;
  DownloadButton: ComponentType<DownloadButtonProps>;
  FormatBadge: ComponentType<FormatBadgeProps>;
  ErrorDisplay: ComponentType<ErrorDisplayProps>;
  ResetButton: ComponentType<ResetButtonProps>;
  /** 处理中视觉反馈 overlay(默认 DefaultBusyOverlay) */
  BusyOverlay: ComponentType<BusyOverlayProps>;
  /** 文件信息栏(默认 DefaultFileInfoBar) */
  FileInfoBar: ComponentType<FileInfoBarProps>;
}

// ─── 默认子组件 ────────────────────────────────────────────

function DefaultUploadBox({ className = '', style, ariaLabel, label, dragLabel }: UploadBoxProps) {
  return (
    <ImageConvert.Upload
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
          {isDragging ? (dragLabel ?? '↓ Drop image') : (label ?? 'Click or drop image')}
        </span>
      )}
    </ImageConvert.Upload>
  );
}

function DefaultPreviewBox({ type, className = '', style, placeholderLabel }: PreviewBoxProps) {
  return (
    <ImageConvert.Preview
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
      placeholder={<span style={{ color: 'var(--lokvis-text-muted, #71717a)', fontSize: '0.75rem' }}>{placeholderLabel ?? 'No image'}</span>}
    />
  );
}

function presetLabel(preset: ConvertPreset): string {
  return IMAGE_CONVERT_PRESETS[preset].label;
}

/** output 预览区 + busy overlay(F2:处理中视觉反馈;Overlay 走 components slot) */
function ConvertOutputPreview({
  processingLabel,
  Overlay,
  children,
}: {
  processingLabel: string;
  Overlay: ComponentType<BusyOverlayProps>;
  children: ReactNode;
}) {
  const { busy } = useImageConvertContext();
  return (
    <Overlay busy={busy} label={processingLabel}>
      {children}
    </Overlay>
  );
}

/** 文件信息栏(F3:format badge · WxH · formatBytes;InfoBar 走 components slot) */
function ConvertFileInfoBar({ type, InfoBar }: { type: 'input' | 'output'; InfoBar: ComponentType<FileInfoBarProps> }) {
  const { inputInfo, outputInfo } = useImageConvertContext();
  const info = type === 'input' ? inputInfo : outputInfo;
  return <InfoBar info={info} />;
}

/**
 * 慢速编码提示条:当前预设仅能经由 WASM 软件编码器完成时展示
 * (如浏览器无原生 AVIF 编码、改用 wasm 兜底,耗时数秒)。
 * slowEncode 检测中(null)或非慢速预设时不渲染。
 */
function ConvertSlowHint({ label }: { label: string }) {
  const { preset, slowEncode } = useImageConvertContext();
  if (!slowEncode || !slowEncode[preset]) {
    return null;
  }
  return (
    <p
      role="status"
      className="px-2.5 py-1.5 text-xs leading-relaxed"
      style={{
        color: 'var(--lokvis-warning-text, #92400e)',
        background: 'var(--lokvis-warning, #fef3c7)',
        borderRadius: 'var(--lokvis-radius, 0.5rem)',
      }}
    >
      {label}
    </p>
  );
}

function DefaultPresetSwitcher({ className = '', style }: PresetSwitcherProps) {
  return (
    <ImageConvert.PresetSwitcher
      className={`flex gap-1 ${className}`}
      style={style}
      renderButton={(preset, isSelected, onClick, disabled) => (
        <button
          type="button"
          role="radio"
          aria-checked={isSelected}
          disabled={disabled}
          onClick={onClick}
          className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
          style={{
            background: isSelected ? 'var(--lokvis-primary, #6366f1)' : 'var(--lokvis-surface, #ffffff)',
            color: isSelected ? '#ffffff' : 'var(--lokvis-text-muted, #71717a)',
            border: '1px solid var(--lokvis-border, #e4e4e7)',
            borderRadius: 'var(--lokvis-radius, 0.5rem)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
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
    <ImageConvert.DownloadButton
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
    </ImageConvert.DownloadButton>
  );
}

function DefaultFormatBadge({ className = '', style }: FormatBadgeProps) {
  return (
    <ImageConvert.FormatBadge
      className={`text-xs font-medium ${className}`}
      style={style}
      format={(input, output) => `${input} → ${output}`}
    />
  );
}

function DefaultErrorDisplay({ className = '', style }: ErrorDisplayProps) {
  return (
    <ImageConvert.ErrorDisplay
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
    <ImageConvert.ResetButton
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
    </ImageConvert.ResetButton>
  );
}

// ─── EmbedImageConvert Props ───────────────────────────────

export interface EmbedImageConvertProps extends UseEmbedActionOptions<ConvertPreset> {
  className?: string;
  style?: CSSProperties;
  showPresetSwitcher?: boolean;
  showBeforeAfter?: boolean;
  showFormat?: boolean;
  showDownloadButton?: boolean;
  showResetButton?: boolean;
  theme?: EmbedTheme;
  /** 主题模式(F1):'light' | 'dark' | 'system',默认 'system' 跟随系统 */
  mode?: EmbedMode;
  components?: Partial<ImageConvertComponents>;
  /** 显式 locale 覆盖(优先级高于 EmbedI18nProvider 与 <html lang> 检测) */
  locale?: Language;
  /** 翻译覆盖(优先级高于 EmbedI18nProvider.translations) */
  translations?: EmbedTranslations;
}

// ─── 默认 UI 实现 ─────────────────────────────────────────

function EmbedImageConvertDefault({
  className = '',
  style,
  showPresetSwitcher = true,
  showBeforeAfter = true,
  showFormat = true,
  showDownloadButton = true,
  showResetButton = true,
  theme,
  mode = 'system',
  components,
  locale,
  translations,
  ...hookOptions
}: EmbedImageConvertProps) {
  const lang = useLang(locale);
  const t = useTranslations(lang, translations);
  const cssVars = themeToCssVars(theme);
  const resolvedMode = useEmbedMode(mode);

  const {
    UploadBox = DefaultUploadBox,
    PreviewBox = DefaultPreviewBox,
    PresetSwitcher = DefaultPresetSwitcher,
    DownloadButton = DefaultDownloadButton,
    FormatBadge = DefaultFormatBadge,
    ErrorDisplay = DefaultErrorDisplay,
    ResetButton = DefaultResetButton,
    BusyOverlay = DefaultBusyOverlay,
    FileInfoBar = DefaultFileInfoBar,
  } = components ?? {};

  return (
    <div
      className={`lokvis-quick-convert flex flex-col gap-3 rounded-lg p-3 ${className}`}
      data-quick-mode={resolvedMode}
      style={{
        background: 'var(--lokvis-bg, transparent)',
        color: 'var(--lokvis-text, #18181b)',
        fontFamily: 'var(--lokvis-font-family, inherit)',
        ...cssVars,
        ...style,
      }}
    >
      <ImageConvert.Root {...hookOptions}>
        <header className="flex flex-col gap-2">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--lokvis-text, #18181b)' }}>
              {t('quickConvert.title')}
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--lokvis-text-muted, #71717a)' }}>
              {t('quickConvert.subtitle')}
            </p>
          </div>
          <UploadBox
            ariaLabel={t('quickConvert.dropHint')}
            label={t('quickConvert.dropHint')}
            dragLabel={t('common.dropHere')}
          />
          {showPresetSwitcher && <PresetSwitcher />}
          <ConvertSlowHint label={t('quickConvert.slowEncoder')} />
        </header>

        <div className={`grid grid-cols-1 gap-2 ${showBeforeAfter ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
          {showBeforeAfter && (
            <div className="flex flex-col gap-1">
              <PreviewBox type="input" placeholderLabel={t('common.noImage')} />
              <ConvertFileInfoBar type="input" InfoBar={FileInfoBar} />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <ConvertOutputPreview processingLabel={t('quickConvert.processing')} Overlay={BusyOverlay}>
              <PreviewBox type="output" placeholderLabel={t('common.noImage')} />
            </ConvertOutputPreview>
            <ConvertFileInfoBar type="output" InfoBar={FileInfoBar} />
          </div>
        </div>

        <footer className="flex flex-col gap-2">
          {showFormat && <FormatBadge />}
          <div className="flex items-center justify-end gap-2">
            {showDownloadButton && <DownloadButton>{t('quickConvert.download')}</DownloadButton>}
            {showResetButton && <ResetButton>{t('quickConvert.retry')}</ResetButton>}
          </div>
          <ErrorDisplay />
        </footer>
      </ImageConvert.Root>
    </div>
  );
}

export default function EmbedImageConvert(props: EmbedImageConvertProps) {
  return (
    <ErrorBoundary locale={props.locale} translations={props.translations}>
      <EmbedImageConvertDefault {...props} />
    </ErrorBoundary>
  );
}
