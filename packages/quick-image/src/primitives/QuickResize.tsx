/**
 * QuickResize — 无样式原语集合(Layer 1)。
 *
 * 8 个原语(与 QuickCompress 同构):
 *   - Root:提供 context,接收所有配置(透传给 useQuickResize)
 *   - Upload:拖拽 + 点击选择
 *   - PresetSwitcher:渲染预设按钮组
 *   - Preview:渲染 input 或 output 图片
 *   - DimensionBadge:渲染输出尺寸文字(替代 QuickCompress.RatioBadge)
 *   - DownloadButton:触发下载
 *   - ErrorDisplay:渲染 error 文案
 *   - ResetButton:触发 reset
 *
 * 设计原则:零内置样式、完整 ARIA、context 强校验。
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
import { downloadBlob, formatBytes } from '../internal/download';
import {
  useQuickResize,
  type ResizePreset,
  type UseQuickResizeResult,
  type UseQuickActionOptions,
} from '../hooks/useQuickResize';
import { fileMatchesAccept, guessExtension, DefaultPresetButton } from './shared';

// ─── Context ────────────────────────────────────────────────

interface QuickResizeContextValue {
  state: UseQuickResizeResult;
}

const QuickResizeContext = createContext<QuickResizeContextValue | null>(null);

function useQuickResizeContext(): UseQuickResizeResult {
  const ctx = useContext(QuickResizeContext);
  if (!ctx) {
    throw new Error(
      'QuickResize primitives 必须包裹在 <QuickResize.Root> 内使用,以获取 hook 状态。'
    );
  }
  return ctx.state;
}

// ─── Root ───────────────────────────────────────────────────

export interface QuickResizeRootProps extends UseQuickActionOptions<ResizePreset> {
  children: ReactNode;
}

export function QuickResizeRoot({ children, ...options }: QuickResizeRootProps) {
  const state = useQuickResize(options);
  return (
    <QuickResizeContext.Provider value={{ state }}>
      {children}
    </QuickResizeContext.Provider>
  );
}

// ─── Upload ─────────────────────────────────────────────────

export interface QuickResizeUploadProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode | ((state: { isDragging: boolean }) => ReactNode);
  accept?: string;
  disabled?: boolean;
  'aria-label'?: string;
  id?: string;
}

export function QuickResizeUpload({
  className,
  style,
  children,
  accept = 'image/*',
  disabled = false,
  'aria-label': ariaLabel = 'Upload image',
  id,
}: QuickResizeUploadProps) {
  const state = useQuickResizeContext();
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

export interface QuickResizePresetSwitcherProps {
  className?: string;
  style?: CSSProperties;
  renderButton?: (preset: ResizePreset, isSelected: boolean, onClick: () => void) => ReactNode;
  presets?: ResizePreset[];
  'aria-label'?: string;
}

const DEFAULT_PRESETS: ResizePreset[] = ['ig-square', 'yt-landscape', 'tk-portrait', 'half'];

export function QuickResizePresetSwitcher({
  className,
  style,
  renderButton,
  presets = DEFAULT_PRESETS,
  'aria-label': ariaLabel = 'Resize preset',
}: QuickResizePresetSwitcherProps) {
  const state = useQuickResizeContext();
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

export interface QuickResizePreviewProps {
  type: 'input' | 'output';
  className?: string;
  style?: CSSProperties;
  placeholder?: ReactNode;
  alt?: string;
}

export function QuickResizePreview({
  type,
  className,
  style,
  placeholder = 'No image',
  alt,
}: QuickResizePreviewProps) {
  const state = useQuickResizeContext();
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
      {info && (
        <span style={{ display: 'block', fontSize: '0.75rem' }}>
          {info.width}×{info.height} · {formatBytes(info.size)} · {info.format}
        </span>
      )}
    </div>
  );
}

// ─── DimensionBadge ─────────────────────────────────────────

export interface QuickResizeDimensionBadgeProps {
  className?: string;
  style?: CSSProperties;
  /** 自定义格式化函数(接收 input 与 output 的宽高信息) */
  format?: (
    inputDim: { width: number; height: number },
    outputDim: { width: number; height: number }
  ) => string;
  empty?: ReactNode;
}

/** 尺寸徽章原语:展示 input → output 尺寸变化 */
export function QuickResizeDimensionBadge({
  className,
  style,
  format,
  empty = null,
}: QuickResizeDimensionBadgeProps) {
  const state = useQuickResizeContext();
  if (!state.inputInfo || !state.outputInfo) {
    return empty !== null ? <span className={className} style={style}>{empty}</span> : null;
  }
  const text = format
    ? format(
        { width: state.inputInfo.width, height: state.inputInfo.height },
        { width: state.outputInfo.width, height: state.outputInfo.height }
      )
    : `${state.inputInfo.width}×${state.inputInfo.height} → ${state.outputInfo.width}×${state.outputInfo.height}`;
  return (
    <span className={className} style={style} role="status">
      {text}
    </span>
  );
}

// ─── DownloadButton ─────────────────────────────────────────

export interface QuickResizeDownloadButtonProps {
  className?: string;
  style?: CSSProperties;
  /** 下载文件名(不含扩展名) */
  fileName?: string;
  /** 下载文件扩展名(默认沿用输出 blob 的 type) */
  extension?: string;
  children?: ReactNode;
  empty?: ReactNode;
}

export function QuickResizeDownloadButton({
  className,
  style,
  fileName = 'resized',
  extension,
  children = 'Download',
  empty = null,
}: QuickResizeDownloadButtonProps) {
  const state = useQuickResizeContext();
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

export interface QuickResizeErrorDisplayProps {
  className?: string;
  style?: CSSProperties;
  format?: (error: string) => string;
  empty?: ReactNode;
}

export function QuickResizeErrorDisplay({
  className,
  style,
  format,
  empty = null,
}: QuickResizeErrorDisplayProps) {
  const state = useQuickResizeContext();
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

export interface QuickResizeResetButtonProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  disabledWhenEmpty?: boolean;
}

export function QuickResizeResetButton({
  className,
  style,
  children = 'Reset',
  disabledWhenEmpty = true,
}: QuickResizeResetButtonProps) {
  const state = useQuickResizeContext();
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

export const QuickResize = {
  Root: QuickResizeRoot,
  Upload: QuickResizeUpload,
  PresetSwitcher: QuickResizePresetSwitcher,
  Preview: QuickResizePreview,
  DimensionBadge: QuickResizeDimensionBadge,
  DownloadButton: QuickResizeDownloadButton,
  ErrorDisplay: QuickResizeErrorDisplay,
  ResetButton: QuickResizeResetButton,
};
