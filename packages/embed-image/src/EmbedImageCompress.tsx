/**
 * EmbedImageCompress — 一键压缩默认 UI(Layer 2)。
 *
 * 基于 Layer 1 原语 + Tailwind 默认样式,支持三种定制方式:
 *   1. theme prop:主题对象(转 CSS 变量)
 *   2. components prop:替换子组件
 *   3. className/style:外层覆盖
 *
 * 内置 ErrorBoundary(符合 AGENTS.md 硬约束)。
 *
 * 默认布局(紧凑卡片式,见设计文档 §4.3.3):
 *   - header:标题 + 副标 + 预设切换器
 *   - 主体:input / output 横向对比(移动端纵向堆叠)
 *   - footer:压缩率 + 下载按钮 + 重置按钮 + 错误显示
 */
import type { ComponentType, CSSProperties, ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { useLang } from './i18n/useLang';
import { useTranslations } from './i18n/utils';
import type { Language } from './i18n/config';
import type { EmbedTranslations } from './i18n/EmbedI18nProvider';
import { formatBytes } from './internal/download';
import { BusyOverlay, FileInfoBar } from './internal/shared-ui';
import { themeToCssVars, useEmbedMode, type EmbedTheme, type EmbedMode } from './theme';
import { ImageCompress, useImageCompressContext } from './primitives/ImageCompress';
import type { CompressPreset, UseEmbedActionOptions } from './hooks/useImageCompress';

// ─── 子组件契约(供 components prop 替换) ─────────────────

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

export interface DownloadButtonProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export interface RatioBadgeProps {
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

/** 子组件替换契约 */
export interface ImageCompressComponents {
  UploadBox: ComponentType<UploadBoxProps>;
  PreviewBox: ComponentType<PreviewBoxProps>;
  PresetSwitcher: ComponentType<PresetSwitcherProps>;
  DownloadButton: ComponentType<DownloadButtonProps>;
  RatioBadge: ComponentType<RatioBadgeProps>;
  ErrorDisplay: ComponentType<ErrorDisplayProps>;
  ResetButton: ComponentType<ResetButtonProps>;
}

// ─── 默认子组件(用 Layer 1 原语 + Tailwind 样式) ────────

function DefaultUploadBox({ className = '', style, ariaLabel }: UploadBoxProps) {
  return (
    <ImageCompress.Upload
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
    </ImageCompress.Upload>
  );
}

function DefaultPreviewBox({ type, className = '', style }: PreviewBoxProps) {
  return (
    <ImageCompress.Preview
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

/** output 预览区 + busy overlay(F2:处理中视觉反馈) */
function CompressOutputPreview({ processingLabel, children }: { processingLabel: string; children: ReactNode }) {
  const { busy } = useImageCompressContext();
  return (
    <BusyOverlay busy={busy} label={processingLabel}>
      {children}
    </BusyOverlay>
  );
}

/** 文件信息栏(F3:format badge · WxH · formatBytes) */
function CompressFileInfoBar({ type }: { type: 'input' | 'output' }) {
  const { inputInfo, outputInfo } = useImageCompressContext();
  const info = type === 'input' ? inputInfo : outputInfo;
  return <FileInfoBar info={info} />;
}

function DefaultPresetSwitcher({ className = '', style }: PresetSwitcherProps) {
  const { busy } = useImageCompressContext();
  return (
    <ImageCompress.PresetSwitcher
      className={`flex gap-1 ${className}`}
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

function presetLabel(preset: CompressPreset): string {
  switch (preset) {
    case 'balanced':
      return 'Balanced';
    case 'highQuality':
      return 'High Quality';
    case 'small':
      return 'Small';
  }
}

function DefaultDownloadButton({ className = '', style, children }: DownloadButtonProps) {
  return (
    <ImageCompress.DownloadButton
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
    </ImageCompress.DownloadButton>
  );
}

function DefaultRatioBadge({ className = '', style }: RatioBadgeProps) {
  return (
    <ImageCompress.RatioBadge
      className={`text-xs font-medium ${className}`}
      style={style}
      format={(ratio, inputSize, outputSize) => {
        const sign = ratio >= 0 ? 'Saved ' : 'Increased ';
        return `${sign}${Math.abs(ratio).toFixed(1)}% (${formatBytes(inputSize)} → ${formatBytes(outputSize)})`;
      }}
    />
  );
}

function DefaultErrorDisplay({ className = '', style }: ErrorDisplayProps) {
  return (
    <ImageCompress.ErrorDisplay
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
    <ImageCompress.ResetButton
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
    </ImageCompress.ResetButton>
  );
}

// ─── EmbedImageCompress 默认 UI Props ────────────────────

export interface EmbedImageCompressProps extends UseEmbedActionOptions<CompressPreset> {
  // ─── UI 配置 ───
  className?: string;
  style?: CSSProperties;
  showPresetSwitcher?: boolean;
  showBeforeAfter?: boolean;
  showRatio?: boolean;
  showDownloadButton?: boolean;
  showResetButton?: boolean;

  // ─── 主题定制 ───
  theme?: EmbedTheme;
  /** 主题模式(F1):'light' | 'dark' | 'system',默认 'system' 跟随系统 */
  mode?: EmbedMode;

  // ─── 组件替换 ───
  components?: Partial<ImageCompressComponents>;

  // ─── i18n(Task 2 解耦) ───
  /** 显式 locale 覆盖(优先级高于 EmbedI18nProvider 与 <html lang> 检测) */
  locale?: Language;
  /** 翻译覆盖(优先级高于 EmbedI18nProvider.translations) */
  translations?: EmbedTranslations;
}

// ─── 默认 UI 实现 ─────────────────────────────────────────

function EmbedImageCompressDefault({
  className = '',
  style,
  showPresetSwitcher = true,
  showBeforeAfter = true,
  showRatio = true,
  showDownloadButton = true,
  showResetButton = true,
  theme,
  mode = 'system',
  components,
  locale,
  translations,
  ...hookOptions
}: EmbedImageCompressProps) {
  const lang = useLang(locale);
  const t = useTranslations(lang, translations);
  const cssVars = themeToCssVars(theme);
  const resolvedMode = useEmbedMode(mode);

  const {
    UploadBox = DefaultUploadBox,
    PreviewBox = DefaultPreviewBox,
    PresetSwitcher = DefaultPresetSwitcher,
    DownloadButton = DefaultDownloadButton,
    RatioBadge = DefaultRatioBadge,
    ErrorDisplay = DefaultErrorDisplay,
    ResetButton = DefaultResetButton,
  } = components ?? {};

  return (
    <div
      className={`lokvis-quick-compress flex flex-col gap-3 rounded-lg p-3 ${className}`}
      data-quick-mode={resolvedMode}
      style={{
        background: 'var(--lokvis-bg, transparent)',
        color: 'var(--lokvis-text, #18181b)',
        fontFamily: 'var(--lokvis-font-family, inherit)',
        ...cssVars,
        ...style,
      }}
    >
      <ImageCompress.Root {...hookOptions}>
        {/* header */}
        <header className="flex flex-col gap-2">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--lokvis-text, #18181b)' }}>
              {t('quickCompress.title')}
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--lokvis-text-muted, #71717a)' }}>
              {t('quickCompress.subtitle')}
            </p>
          </div>
          <UploadBox ariaLabel={t('quickCompress.dropHint')} />
          {showPresetSwitcher && <PresetSwitcher />}
        </header>

        {/* 主体:before/after 对比 */}
        <div className={`grid grid-cols-1 gap-2 ${showBeforeAfter ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
          {showBeforeAfter && (
            <div className="flex flex-col gap-1">
              <PreviewBox type="input" />
              <CompressFileInfoBar type="input" />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <CompressOutputPreview processingLabel={t('quickCompress.processing')}>
              <PreviewBox type="output" />
            </CompressOutputPreview>
            <CompressFileInfoBar type="output" />
          </div>
        </div>

        {/* footer:压缩率 + 下载 + 重置 + 错误 */}
        <footer className="flex flex-col gap-2">
          {showRatio && <RatioBadge />}
          <div className="flex items-center justify-end gap-2">
            {showDownloadButton && <DownloadButton>{t('quickCompress.download')}</DownloadButton>}
            {showResetButton && <ResetButton>{t('quickCompress.retry')}</ResetButton>}
          </div>
          <ErrorDisplay />
        </footer>
      </ImageCompress.Root>
    </div>
  );
}

/** 默认导出:用 ErrorBoundary 包裹(符合 AGENTS.md 硬约束) */
export default function EmbedImageCompress(props: EmbedImageCompressProps) {
  return (
    <ErrorBoundary locale={props.locale} translations={props.translations}>
      <EmbedImageCompressDefault {...props} />
    </ErrorBoundary>
  );
}
