/**
 * ImagePipeline — 无样式原语集合(Layer 1)。
 *
 * 8 个原语(其中 StepList 是 Pipeline 专用的中间结果展示原语):
 *   - Root:提供 context
 *   - Upload:拖拽 + 点击选择
 *   - PresetSwitcher:渲染预设按钮组(4 个 pipeline 预设)
 *   - Preview:渲染 input 或最终 output 图片
 *   - StepList:渲染各步骤中间结果(可展开/折叠,QW-1 新增原语)
 *   - DownloadButton:触发下载(最终输出)
 *   - ErrorDisplay:渲染 error 文案
 *   - ResetButton:触发 reset
 */
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { downloadBlob } from '@lokvis/embed-kit';
import { formatBytes } from '@lokvis/runtime';
import {
  useImagePipeline,
  type PipelinePreset,
  type UseImagePipelineResult,
  type UseEmbedActionOptions,
} from '../hooks/useImagePipeline';
import { fileMatchesAccept, guessExtension, DefaultPresetButton } from './shared';

// ─── Context ────────────────────────────────────────────────

interface ImagePipelineContextValue {
  state: UseImagePipelineResult;
}

const ImagePipelineContext = createContext<ImagePipelineContextValue | null>(null);

export function useImagePipelineContext(): UseImagePipelineResult {
  const ctx = useContext(ImagePipelineContext);
  if (!ctx) {
    throw new Error(
      'ImagePipeline primitives 必须包裹在 <ImagePipeline.Root> 内使用,以获取 hook 状态。'
    );
  }
  return ctx.state;
}

// ─── Root ───────────────────────────────────────────────────

export interface ImagePipelineRootProps extends UseEmbedActionOptions<PipelinePreset> {
  children: ReactNode;
}

export function ImagePipelineRoot({ children, ...options }: ImagePipelineRootProps) {
  const state = useImagePipeline(options);
  return (
    <ImagePipelineContext.Provider value={{ state }}>
      {children}
    </ImagePipelineContext.Provider>
  );
}

// ─── Upload ─────────────────────────────────────────────────

export interface ImagePipelineUploadProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode | ((state: { isDragging: boolean }) => ReactNode);
  accept?: string;
  disabled?: boolean;
  'aria-label'?: string;
  id?: string;
}

export function ImagePipelineUpload({
  className,
  style,
  children,
  accept = 'image/*',
  disabled = false,
  'aria-label': ariaLabel = 'Upload image',
  id,
}: ImagePipelineUploadProps) {
  const state = useImagePipelineContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const all = Array.from(fileList).filter((f) => fileMatchesAccept(f, accept));
      if (all.length === 0) return;
      void state.handleFiles(all);
    },
    [accept, state]
  );

  const handleClick = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        inputRef.current?.click();
      }
    },
    [disabled]
  );

  return (
    <div
      id={id}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || state.busy}
      aria-label={ariaLabel}
      className={className}
      style={style}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {typeof children === 'function' ? children({ isDragging }) : children}
    </div>
  );
}

// ─── PresetSwitcher ─────────────────────────────────────────

export interface ImagePipelinePresetSwitcherProps {
  className?: string;
  style?: CSSProperties;
  renderButton?: (preset: PipelinePreset, isSelected: boolean, onClick: () => void) => ReactNode;
  presets?: PipelinePreset[];
  'aria-label'?: string;
}

const DEFAULT_PRESETS: PipelinePreset[] = ['ecommerce', 'social', 'thumbnail', 'blog'];

export function ImagePipelinePresetSwitcher({
  className,
  style,
  renderButton,
  presets = DEFAULT_PRESETS,
  'aria-label': ariaLabel = 'Pipeline preset',
}: ImagePipelinePresetSwitcherProps) {
  const state = useImagePipelineContext();
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={className} style={style}>
      {presets.map((p) => {
        const isSelected = state.preset === p;
        const onClick = () => {
          if (!state.busy) state.setPreset(p);
        };
        return (
          <span key={p}>
            {renderButton
              ? renderButton(p, isSelected, onClick)
              : <DefaultPresetButton preset={p} isSelected={isSelected} onClick={onClick} disabled={state.busy} />}
          </span>
        );
      })}
    </div>
  );
}

// ─── Preview ────────────────────────────────────────────────

export interface ImagePipelinePreviewProps {
  /** 渲染输入或最终输出图片 */
  type: 'input' | 'output';
  className?: string;
  style?: CSSProperties;
  placeholder?: ReactNode;
  alt?: string;
  /** 是否渲染文件信息栏(默认 true;Layer 2 设 false 自行渲染 FileInfoBar) */
  showInfo?: boolean;
}

export function ImagePipelinePreview({
  type,
  className,
  style,
  placeholder = 'No image',
  alt,
  showInfo = true,
}: ImagePipelinePreviewProps) {
  const state = useImagePipelineContext();
  const url = type === 'input' ? state.inputUrl : state.outputUrl;
  const info = type === 'input' ? state.inputInfo : state.outputInfo;
  return (
    <div className={className} style={style} aria-label={`${type} preview`}>
      {url ? (
        <img
          src={url}
          alt={alt ?? `${type} image`}
          loading="lazy"
          decoding="async"
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
      ) : (
        <span>{placeholder}</span>
      )}
      {info && showInfo && (
        <span style={{ display: 'block', fontSize: '0.75rem' }}>
          {info.width}×{info.height} · {formatBytes(info.size)} · {info.format}
        </span>
      )}
    </div>
  );
}

// ─── StepList(QW-1 新增原语) ───────────────────────────────

export interface ImagePipelineStepListProps {
  className?: string;
  style?: CSSProperties;
  /** 自定义渲染每个步骤(可选) */
  renderItem?: (step: {
    index: number;
    label: string;
    capability: string;
    url: string;
    info: { width: number; height: number; size: number; format: string };
    isRunning: boolean;
  }) => ReactNode;
  /** 无步骤时显示的内容 */
  empty?: ReactNode;
  /** ARIA label */
  'aria-label'?: string;
}

/**
 * 步骤列表原语:展示各步骤中间结果(可展开/折叠)。
 *
 * 设计:
 *   - 每步显示:index + label + 缩略图 + 尺寸信息
 *   - 当前执行中的步骤有 "running" 标识(currentStep === index 且 busy)
 *   - 未执行的步骤(无输出)显示等待状态
 *   - 用 <ol role="list"> 语义化列表
 */
export function ImagePipelineStepList({
  className,
  style,
  renderItem,
  empty = null,
  'aria-label': ariaLabel = 'Pipeline steps',
}: ImagePipelineStepListProps) {
  const state = useImagePipelineContext();
  const wf = state.workflow;
  if (wf.nodes.length === 0 && state.steps.length === 0) {
    return empty !== null ? <div className={className} style={style}>{empty}</div> : null;
  }
  return (
    <ol className={className} style={style} role="list" aria-label={ariaLabel}>
      {wf.nodes.map((node, i) => {
        const output = state.steps.find((s) => s.index === i);
        const isRunning = state.busy && state.currentStep === i;
        const isPending = state.busy && state.currentStep < i;
        const nodeLabel = node.label ?? node.capability ?? `Step ${i + 1}`;
        const nodeCapability = node.capability ?? '';
        if (renderItem) {
          return (
            <li key={node.id}>
              {renderItem({
                index: i,
                label: nodeLabel,
                capability: nodeCapability,
                url: output?.url ?? '',
                info: output?.info ?? { width: 0, height: 0, size: 0, format: '' },
                isRunning,
              })}
            </li>
          );
        }
        return (
          <li
            key={node.id}
            aria-label={`Step ${i + 1}: ${nodeLabel}${isRunning ? ' (running)' : isPending ? ' (pending)' : output ? ' (done)' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.25rem 0',
              opacity: isPending ? 0.5 : 1,
            }}
          >
            <span aria-hidden="true" style={{ fontVariantNumeric: 'tabular-nums', minWidth: '1.5rem' }}>
              {i + 1}.
            </span>
            <span style={{ flex: '0 0 auto' }}>{nodeLabel}</span>
            {isRunning && (
              <span role="status" style={{ fontSize: '0.75rem' }}>running…</span>
            )}
            {output && (
              <>
                <img
                  src={output.url}
                  alt={`Step ${i + 1} output`}
                  style={{ width: '2rem', height: '2rem', objectFit: 'contain' }}
                />
                <span style={{ fontSize: '0.75rem' }}>
                  {output.info.width}×{output.info.height} · {formatBytes(output.info.size)}
                </span>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ─── DownloadButton ─────────────────────────────────────────

export interface ImagePipelineDownloadButtonProps {
  className?: string;
  style?: CSSProperties;
  fileName?: string;
  extension?: string;
  children?: ReactNode;
  empty?: ReactNode;
}

export function ImagePipelineDownloadButton({
  className,
  style,
  fileName = 'pipeline-output',
  extension,
  children = 'Download',
  empty = null,
}: ImagePipelineDownloadButtonProps) {
  const state = useImagePipelineContext();
  if (!state.outputBlob) {
    return empty !== null ? <span className={className} style={style}>{empty}</span> : null;
  }
  const ext = extension ?? guessExtension(state.outputBlob);
  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() => downloadBlob(state.outputBlob!, `${fileName}.${ext}`)}
    >
      {children}
    </button>
  );
}

// ─── ErrorDisplay ───────────────────────────────────────────

export interface ImagePipelineErrorDisplayProps {
  className?: string;
  style?: CSSProperties;
  format?: (error: string) => string;
  empty?: ReactNode;
}

export function ImagePipelineErrorDisplay({
  className,
  style,
  format,
  empty = null,
}: ImagePipelineErrorDisplayProps) {
  const state = useImagePipelineContext();
  const error = state.error ?? state.initError;
  if (!error) {
    return empty !== null ? <span className={className} style={style}>{empty}</span> : null;
  }
  return (
    <span className={className} style={style} role="alert">
      {format ? format(error) : error}
    </span>
  );
}

// ─── ResetButton ────────────────────────────────────────────

export interface ImagePipelineResetButtonProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  disabledWhenEmpty?: boolean;
}

export function ImagePipelineResetButton({
  className,
  style,
  children = 'Reset',
  disabledWhenEmpty = true,
}: ImagePipelineResetButtonProps) {
  const state = useImagePipelineContext();
  const disabled = disabledWhenEmpty && !state.inputUrl;
  return (
    <button
      type="button"
      className={className}
      style={style}
      disabled={disabled}
      onClick={() => state.reset()}
    >
      {children}
    </button>
  );
}

// ─── 导出 ───────────────────────────────────────────────────

export const ImagePipeline = {
  Root: ImagePipelineRoot,
  Upload: ImagePipelineUpload,
  PresetSwitcher: ImagePipelinePresetSwitcher,
  Preview: ImagePipelinePreview,
  StepList: ImagePipelineStepList,
  DownloadButton: ImagePipelineDownloadButton,
  ErrorDisplay: ImagePipelineErrorDisplay,
  ResetButton: ImagePipelineResetButton,
};
