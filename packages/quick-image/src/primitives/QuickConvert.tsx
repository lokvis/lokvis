/**
 * QuickConvert — 无样式原语集合(Layer 1)。
 *
 * 8 个原语(与 QuickCompress/QuickResize 同构):
 *   - Root:提供 context
 *   - Upload:拖拽 + 点击选择
 *   - PresetSwitcher:渲染预设按钮组
 *   - Preview:渲染 input 或 output 图片
 *   - FormatBadge:渲染 input → output 格式变化
 *   - DownloadButton:触发下载
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
import { downloadBlob, formatBytes } from '../internal/download';
import {
  useQuickConvert,
  type ConvertPreset,
  type UseQuickConvertResult,
  type UseQuickActionOptions,
} from '../hooks/useQuickConvert';
import { fileMatchesAccept, guessExtension, DefaultPresetButton } from './shared';

// ─── Context ────────────────────────────────────────────────

interface QuickConvertContextValue {
  state: UseQuickConvertResult;
}

const QuickConvertContext = createContext<QuickConvertContextValue | null>(null);

function useQuickConvertContext(): UseQuickConvertResult {
  const ctx = useContext(QuickConvertContext);
  if (!ctx) {
    throw new Error(
      'QuickConvert primitives 必须包裹在 <QuickConvert.Root> 内使用,以获取 hook 状态。'
    );
  }
  return ctx.state;
}

// ─── Root ───────────────────────────────────────────────────

export interface QuickConvertRootProps extends UseQuickActionOptions<ConvertPreset> {
  children: ReactNode;
}

export function QuickConvertRoot({ children, ...options }: QuickConvertRootProps) {
  const state = useQuickConvert(options);
  return (
    <QuickConvertContext.Provider value={{ state }}>
      {children}
    </QuickConvertContext.Provider>
  );
}

// ─── Upload ─────────────────────────────────────────────────

export interface QuickConvertUploadProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode | ((state: { isDragging: boolean }) => ReactNode);
  accept?: string;
  disabled?: boolean;
  'aria-label'?: string;
  id?: string;
}

export function QuickConvertUpload({
  className,
  style,
  children,
  accept = 'image/*',
  disabled = false,
  'aria-label': ariaLabel = 'Upload image',
  id,
}: QuickConvertUploadProps) {
  const state = useQuickConvertContext();
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

export interface QuickConvertPresetSwitcherProps {
  className?: string;
  style?: CSSProperties;
  renderButton?: (preset: ConvertPreset, isSelected: boolean, onClick: () => void) => ReactNode;
  presets?: ConvertPreset[];
  'aria-label'?: string;
}

const DEFAULT_PRESETS: ConvertPreset[] = ['png', 'webp', 'avif', 'jpeg'];

export function QuickConvertPresetSwitcher({
  className,
  style,
  renderButton,
  presets = DEFAULT_PRESETS,
  'aria-label': ariaLabel = 'Convert preset',
}: QuickConvertPresetSwitcherProps) {
  const state = useQuickConvertContext();
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

export interface QuickConvertPreviewProps {
  type: 'input' | 'output';
  className?: string;
  style?: CSSProperties;
  placeholder?: ReactNode;
  alt?: string;
}

export function QuickConvertPreview({
  type,
  className,
  style,
  placeholder = 'No image',
  alt,
}: QuickConvertPreviewProps) {
  const state = useQuickConvertContext();
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

// ─── FormatBadge ────────────────────────────────────────────

export interface QuickConvertFormatBadgeProps {
  className?: string;
  style?: CSSProperties;
  /** 自定义格式化函数(接收 input 与 output 的格式字符串) */
  format?: (inputFormat: string, outputFormat: string) => string;
  empty?: ReactNode;
}

/** 格式徽章原语:展示 input → output 格式变化 */
export function QuickConvertFormatBadge({
  className,
  style,
  format,
  empty = null,
}: QuickConvertFormatBadgeProps) {
  const state = useQuickConvertContext();
  if (!state.inputInfo || !state.outputInfo) {
    return empty !== null ? <span className={className} style={style}>{empty}</span> : null;
  }
  const text = format
    ? format(state.inputInfo.format, state.outputInfo.format)
    : `${state.inputInfo.format} → ${state.outputInfo.format}`;
  return (
    <span className={className} style={style} role="status">
      {text}
    </span>
  );
}

// ─── DownloadButton ─────────────────────────────────────────

export interface QuickConvertDownloadButtonProps {
  className?: string;
  style?: CSSProperties;
  fileName?: string;
  extension?: string;
  children?: ReactNode;
  empty?: ReactNode;
}

export function QuickConvertDownloadButton({
  className,
  style,
  fileName = 'converted',
  extension,
  children = 'Download',
  empty = null,
}: QuickConvertDownloadButtonProps) {
  const state = useQuickConvertContext();
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

export interface QuickConvertErrorDisplayProps {
  className?: string;
  style?: CSSProperties;
  format?: (error: string) => string;
  empty?: ReactNode;
}

export function QuickConvertErrorDisplay({
  className,
  style,
  format,
  empty = null,
}: QuickConvertErrorDisplayProps) {
  const state = useQuickConvertContext();
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

export interface QuickConvertResetButtonProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  disabledWhenEmpty?: boolean;
}

export function QuickConvertResetButton({
  className,
  style,
  children = 'Reset',
  disabledWhenEmpty = true,
}: QuickConvertResetButtonProps) {
  const state = useQuickConvertContext();
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

export const QuickConvert = {
  Root: QuickConvertRoot,
  Upload: QuickConvertUpload,
  PresetSwitcher: QuickConvertPresetSwitcher,
  Preview: QuickConvertPreview,
  FormatBadge: QuickConvertFormatBadge,
  DownloadButton: QuickConvertDownloadButton,
  ErrorDisplay: QuickConvertErrorDisplay,
  ResetButton: QuickConvertResetButton,
};
