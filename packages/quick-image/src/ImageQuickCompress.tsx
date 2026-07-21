/**
 * ImageQuickCompress — 一键压缩默认 UI(Layer 2)。
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
import type { QuickTranslations } from './i18n/QuickI18nProvider';
import { formatBytes } from './internal/download';
import { themeToCssVars, type QuickTheme } from './theme';
import { QuickCompress } from './primitives/QuickCompress';
import type { CompressPreset, UseQuickActionOptions } from './hooks/useQuickCompress';

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
export interface QuickCompressComponents {
  UploadBox: ComponentType<UploadBoxProps>;
  PreviewBox: ComponentType<PreviewBoxProps>;
  PresetSwitcher: ComponentType<PresetSwitcherProps>;
  DownloadButton: ComponentType<DownloadButtonProps>;
  RatioBadge: ComponentType<RatioBadgeProps>;
  ErrorDisplay: ComponentType<ErrorDisplayProps>;
  ResetButton: ComponentType<ResetButtonProps>;
}

// ─── 默认子组件(用 Layer 1 原语 + Tailwind 样式) ────────

function DefaultUploadBox({ className = '', style }: UploadBoxProps) {
  return (
    <QuickCompress.Upload
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
    </QuickCompress.Upload>
  );
}

function DefaultPreviewBox({ type, className = '', style }: PreviewBoxProps) {
  return (
    <QuickCompress.Preview
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

function DefaultPresetSwitcher({ className = '', style }: PresetSwitcherProps) {
  return (
    <QuickCompress.PresetSwitcher
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
    <QuickCompress.DownloadButton
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
    </QuickCompress.DownloadButton>
  );
}

function DefaultRatioBadge({ className = '', style }: RatioBadgeProps) {
  return (
    <QuickCompress.RatioBadge
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
    <QuickCompress.ErrorDisplay
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
    <QuickCompress.ResetButton
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
    </QuickCompress.ResetButton>
  );
}

// ─── ImageQuickCompress 默认 UI Props ────────────────────

export interface ImageQuickCompressProps extends UseQuickActionOptions<CompressPreset> {
  // ─── UI 配置 ───
  className?: string;
  style?: CSSProperties;
  showPresetSwitcher?: boolean;
  showBeforeAfter?: boolean;
  showRatio?: boolean;
  showDownloadButton?: boolean;
  showResetButton?: boolean;

  // ─── 主题定制 ───
  theme?: QuickTheme;

  // ─── 组件替换 ───
  components?: Partial<QuickCompressComponents>;

  // ─── i18n(Task 2 解耦) ───
  /** 显式 locale 覆盖(优先级高于 QuickI18nProvider 与 <html lang> 检测) */
  locale?: Language;
  /** 翻译覆盖(优先级高于 QuickI18nProvider.translations) */
  translations?: QuickTranslations;
}

// ─── 默认 UI 实现 ─────────────────────────────────────────

function ImageQuickCompressDefault({
  className = '',
  style,
  showPresetSwitcher = true,
  showBeforeAfter = true,
  showRatio = true,
  showDownloadButton = true,
  showResetButton = true,
  theme,
  components,
  locale,
  translations,
  ...hookOptions
}: ImageQuickCompressProps) {
  const lang = useLang(locale);
  const t = useTranslations(lang, translations);
  const cssVars = themeToCssVars(theme);

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
      style={{
        background: 'var(--lokvis-bg)',
        color: 'var(--lokvis-text)',
        fontFamily: 'var(--lokvis-font-family)',
        ...cssVars,
        ...style,
      }}
    >
      <QuickCompress.Root {...hookOptions}>
        {/* header */}
        <header className="flex flex-col gap-2">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--lokvis-text)' }}>
              {t('quickCompress.title')}
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--lokvis-text-muted)' }}>
              {t('quickCompress.subtitle')}
            </p>
          </div>
          <UploadBox />
          {showPresetSwitcher && <PresetSwitcher />}
        </header>

        {/* 主体:before/after 对比 */}
        <div className={`grid grid-cols-1 gap-2 ${showBeforeAfter ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
          {showBeforeAfter && <PreviewBox type="input" />}
          <PreviewBox type="output" />
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
      </QuickCompress.Root>
    </div>
  );
}

/** 默认导出:用 ErrorBoundary 包裹(符合 AGENTS.md 硬约束) */
export default function ImageQuickCompress(props: ImageQuickCompressProps) {
  return (
    <ErrorBoundary locale={props.locale} translations={props.translations}>
      <ImageQuickCompressDefault {...props} />
    </ErrorBoundary>
  );
}
