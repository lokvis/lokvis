/**
 * EmbedImagePipeline — 多步 pipeline 默认 UI(Layer 2)。
 *
 * 基于 Layer 1 原语 + Tailwind 默认样式,支持三种定制方式:
 *   1. theme prop:主题对象(转 CSS 变量)
 *   2. components prop:替换子组件
 *   3. className/style:外层覆盖
 *
 * 默认布局:
 *   - header:标题 + 上传 + 预设切换器
 *   - body:StepList(各步中间结果)+ before/after 预览
 *   - footer:下载 / 重置 + 错误显示
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
import { ImagePipeline, useImagePipelineContext } from './primitives/ImagePipeline';
import {
  IMAGE_PIPELINE_PRESETS,
  type PipelinePreset,
  type UseEmbedActionOptions,
} from './hooks/useImagePipeline';

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

export interface StepListBoxProps {
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

export interface ImagePipelineComponents {
  UploadBox: ComponentType<UploadBoxProps>;
  PreviewBox: ComponentType<PreviewBoxProps>;
  PresetSwitcher: ComponentType<PresetSwitcherProps>;
  StepListBox: ComponentType<StepListBoxProps>;
  DownloadButton: ComponentType<DownloadButtonProps>;
  ErrorDisplay: ComponentType<ErrorDisplayProps>;
  ResetButton: ComponentType<ResetButtonProps>;
}

// ─── 默认子组件 ────────────────────────────────────────────

function DefaultUploadBox({ className = '', style, ariaLabel }: UploadBoxProps) {
  return (
    <ImagePipeline.Upload
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
    </ImagePipeline.Upload>
  );
}

function DefaultPreviewBox({ type, className = '', style }: PreviewBoxProps) {
  return (
    <ImagePipeline.Preview
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

function presetLabel(preset: PipelinePreset): string {
  return IMAGE_PIPELINE_PRESETS[preset].label;
}

/** output 预览区 + busy overlay(F2:处理中视觉反馈) */
function PipelineOutputPreview({ processingLabel, children }: { processingLabel: string; children: ReactNode }) {
  const { busy } = useImagePipelineContext();
  return (
    <BusyOverlay busy={busy} label={processingLabel}>
      {children}
    </BusyOverlay>
  );
}

/** 文件信息栏(F3:format badge · WxH · formatBytes) */
function PipelineFileInfoBar({ type }: { type: 'input' | 'output' }) {
  const { inputInfo, outputInfo } = useImagePipelineContext();
  const info = type === 'input' ? inputInfo : outputInfo;
  return <FileInfoBar info={info} />;
}

function DefaultPresetSwitcher({ className = '', style }: PresetSwitcherProps) {
  const { busy } = useImagePipelineContext();
  return (
    <ImagePipeline.PresetSwitcher
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

function DefaultStepListBox({ className = '', style }: StepListBoxProps) {
  return (
    <ImagePipeline.StepList
      className={`flex flex-col gap-1 rounded-lg p-2 ${className}`}
      style={{
        background: 'var(--lokvis-surface, #ffffff)',
        border: '1px solid var(--lokvis-border, #e4e4e7)',
        borderRadius: 'var(--lokvis-radius, 0.5rem)',
        ...style,
      }}
      empty={
        <span style={{ color: 'var(--lokvis-text-muted, #71717a)', fontSize: '0.75rem' }}>
          Pipeline steps will appear here after upload
        </span>
      }
    />
  );
}

function DefaultDownloadButton({ className = '', style, children }: DownloadButtonProps) {
  return (
    <ImagePipeline.DownloadButton
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
    </ImagePipeline.DownloadButton>
  );
}

function DefaultErrorDisplay({ className = '', style }: ErrorDisplayProps) {
  return (
    <ImagePipeline.ErrorDisplay
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
    <ImagePipeline.ResetButton
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
    </ImagePipeline.ResetButton>
  );
}

// ─── EmbedImagePipeline Props ────────────────────────────

export interface EmbedImagePipelineProps extends UseEmbedActionOptions<PipelinePreset> {
  className?: string;
  style?: CSSProperties;
  showPresetSwitcher?: boolean;
  /** 是否显示步骤列表(中间结果);默认 true */
  showStepList?: boolean;
  /** 是否显示 before/after 对比(默认 true;false 时只显示最终 output) */
  showBeforeAfter?: boolean;
  showDownloadButton?: boolean;
  showResetButton?: boolean;
  theme?: EmbedTheme;
  /** 主题模式(F1):'light' | 'dark' | 'system',默认 'system' 跟随系统 */
  mode?: EmbedMode;
  components?: Partial<ImagePipelineComponents>;
  /** 显式 locale 覆盖(优先级高于 EmbedI18nProvider 与 <html lang> 检测) */
  locale?: Language;
  /** 翻译覆盖(优先级高于 EmbedI18nProvider.translations) */
  translations?: EmbedTranslations;
}

// ─── 默认 UI 实现 ─────────────────────────────────────────

function EmbedImagePipelineDefault({
  className = '',
  style,
  showPresetSwitcher = true,
  showStepList = true,
  showBeforeAfter = true,
  showDownloadButton = true,
  showResetButton = true,
  theme,
  mode = 'system',
  components,
  locale,
  translations,
  ...hookOptions
}: EmbedImagePipelineProps) {
  const lang = useLang(locale);
  const t = useTranslations(lang, translations);
  const cssVars = themeToCssVars(theme);
  const resolvedMode = useEmbedMode(mode);

  const {
    UploadBox = DefaultUploadBox,
    PreviewBox = DefaultPreviewBox,
    PresetSwitcher = DefaultPresetSwitcher,
    StepListBox = DefaultStepListBox,
    DownloadButton = DefaultDownloadButton,
    ErrorDisplay = DefaultErrorDisplay,
    ResetButton = DefaultResetButton,
  } = components ?? {};

  return (
    <div
      className={`lokvis-quick-pipeline flex flex-col gap-3 rounded-lg p-3 ${className}`}
      data-quick-mode={resolvedMode}
      style={{
        background: 'var(--lokvis-bg, transparent)',
        color: 'var(--lokvis-text, #18181b)',
        fontFamily: 'var(--lokvis-font-family, inherit)',
        ...cssVars,
        ...style,
      }}
    >
      <ImagePipeline.Root {...hookOptions}>
        <header className="flex flex-col gap-2">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--lokvis-text, #18181b)' }}>
              {t('quickPipeline.title')}
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--lokvis-text-muted, #71717a)' }}>
              {t('quickPipeline.subtitle')}
            </p>
          </div>
          <UploadBox ariaLabel={t('quickPipeline.dropHint')} />
          {showPresetSwitcher && <PresetSwitcher />}
        </header>

        {showStepList && (
          <div className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: 'var(--lokvis-text-muted, #71717a)' }}>
              {t('quickPipeline.steps')}
            </span>
            <StepListBox />
          </div>
        )}

        <div className={`grid grid-cols-1 gap-2 ${showBeforeAfter ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
          {showBeforeAfter && (
            <div className="flex flex-col gap-1">
              <PreviewBox type="input" />
              <PipelineFileInfoBar type="input" />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <PipelineOutputPreview processingLabel={t('quickPipeline.processing')}>
              <PreviewBox type="output" />
            </PipelineOutputPreview>
            <PipelineFileInfoBar type="output" />
          </div>
        </div>

        <footer className="flex flex-col gap-2">
          <div className="flex items-center justify-end gap-2">
            {showDownloadButton && <DownloadButton>{t('quickPipeline.download')}</DownloadButton>}
            {showResetButton && <ResetButton>{t('quickPipeline.retry')}</ResetButton>}
          </div>
          <ErrorDisplay />
        </footer>
      </ImagePipeline.Root>
    </div>
  );
}

export default function EmbedImagePipeline(props: EmbedImagePipelineProps) {
  return (
    <ErrorBoundary locale={props.locale} translations={props.translations}>
      <EmbedImagePipelineDefault {...props} />
    </ErrorBoundary>
  );
}
