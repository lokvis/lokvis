/**
 * ImageQuickPipeline — 多步 pipeline 默认 UI(Layer 2)。
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
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { themeToCssVars, type QuickTheme } from './theme';
import { useQuickStrings } from './strings';
import { QuickPipeline } from './primitives/QuickPipeline';
import {
  PIPELINE_PRESETS,
  type PipelinePreset,
  type UseQuickActionOptions,
} from './useImagePipeline';

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

export interface QuickPipelineComponents {
  UploadBox: ComponentType<UploadBoxProps>;
  PreviewBox: ComponentType<PreviewBoxProps>;
  PresetSwitcher: ComponentType<PresetSwitcherProps>;
  StepListBox: ComponentType<StepListBoxProps>;
  DownloadButton: ComponentType<DownloadButtonProps>;
  ErrorDisplay: ComponentType<ErrorDisplayProps>;
  ResetButton: ComponentType<ResetButtonProps>;
}

// ─── 默认子组件 ────────────────────────────────────────────

function DefaultUploadBox({ className = '', style }: UploadBoxProps) {
  return (
    <QuickPipeline.Upload
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
    </QuickPipeline.Upload>
  );
}

function DefaultPreviewBox({ type, className = '', style }: PreviewBoxProps) {
  return (
    <QuickPipeline.Preview
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

function presetLabel(preset: PipelinePreset): string {
  return PIPELINE_PRESETS[preset].label;
}

function DefaultPresetSwitcher({ className = '', style }: PresetSwitcherProps) {
  return (
    <QuickPipeline.PresetSwitcher
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

function DefaultStepListBox({ className = '', style }: StepListBoxProps) {
  return (
    <QuickPipeline.StepList
      className={`flex flex-col gap-1 rounded-lg p-2 ${className}`}
      style={{
        background: 'var(--lokvis-surface)',
        border: '1px solid var(--lokvis-border)',
        borderRadius: 'var(--lokvis-radius)',
        ...style,
      }}
      empty={
        <span style={{ color: 'var(--lokvis-text-muted)', fontSize: '0.75rem' }}>
          Pipeline steps will appear here after upload
        </span>
      }
    />
  );
}

function DefaultDownloadButton({ className = '', style, children }: DownloadButtonProps) {
  return (
    <QuickPipeline.DownloadButton
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
    </QuickPipeline.DownloadButton>
  );
}

function DefaultErrorDisplay({ className = '', style }: ErrorDisplayProps) {
  return (
    <QuickPipeline.ErrorDisplay
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
    <QuickPipeline.ResetButton
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
    </QuickPipeline.ResetButton>
  );
}

// ─── ImageQuickPipeline Props ────────────────────────────

export interface ImageQuickPipelineProps extends UseQuickActionOptions<PipelinePreset> {
  className?: string;
  style?: CSSProperties;
  showPresetSwitcher?: boolean;
  /** 是否显示步骤列表(中间结果);默认 true */
  showStepList?: boolean;
  /** 是否显示 before/after 对比(默认 true;false 时只显示最终 output) */
  showBeforeAfter?: boolean;
  showDownloadButton?: boolean;
  showResetButton?: boolean;
  theme?: QuickTheme;
  components?: Partial<QuickPipelineComponents>;
}

// ─── 默认 UI 实现 ─────────────────────────────────────────

function ImageQuickPipelineDefault({
  className = '',
  style,
  showPresetSwitcher = true,
  showStepList = true,
  showBeforeAfter = true,
  showDownloadButton = true,
  showResetButton = true,
  theme,
  components,
  ...hookOptions
}: ImageQuickPipelineProps) {
  const s = useQuickStrings();
  const cssVars = themeToCssVars(theme);

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
      style={{
        background: 'var(--lokvis-bg)',
        color: 'var(--lokvis-text)',
        fontFamily: 'var(--lokvis-font-family)',
        ...cssVars,
        ...style,
      }}
    >
      <QuickPipeline.Root {...hookOptions}>
        <header className="flex flex-col gap-2">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--lokvis-text)' }}>
              {s.pipeline.title}
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--lokvis-text-muted)' }}>
              {s.pipeline.subtitle}
            </p>
          </div>
          <UploadBox />
          {showPresetSwitcher && <PresetSwitcher />}
        </header>

        {showStepList && (
          <div className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: 'var(--lokvis-text-muted)' }}>
              {s.pipeline.steps}
            </span>
            <StepListBox />
          </div>
        )}

        <div className={`grid grid-cols-1 gap-2 ${showBeforeAfter ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
          {showBeforeAfter && <PreviewBox type="input" />}
          <PreviewBox type="output" />
        </div>

        <footer className="flex flex-col gap-2">
          <div className="flex items-center justify-end gap-2">
            {showDownloadButton && <DownloadButton>{s.pipeline.download}</DownloadButton>}
            {showResetButton && <ResetButton>{s.pipeline.retry}</ResetButton>}
          </div>
          <ErrorDisplay />
        </footer>
      </QuickPipeline.Root>
    </div>
  );
}

export default function ImageQuickPipeline(props: ImageQuickPipelineProps) {
  return (
    <ErrorBoundary>
      <ImageQuickPipelineDefault {...props} />
    </ErrorBoundary>
  );
}
