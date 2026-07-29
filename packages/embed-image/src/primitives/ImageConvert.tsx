/**
 * ImageConvert — 无样式原语集合(Layer 1)。
 *
 * 8 个原语(与 ImageCompress/ImageResize 同构):
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
import { downloadBlob } from '@lokvis/embed-kit';
import { formatBytes } from '@lokvis/runtime';
import {
  useImageConvert,
  type ConvertPreset,
  type UseImageConvertResult,
  type UseEmbedActionOptions,
} from '../hooks/useImageConvert';
import { fileMatchesAccept, guessExtension, DefaultPresetButton } from './shared';

// ─── Context ────────────────────────────────────────────────

interface ImageConvertContextValue {
  state: UseImageConvertResult;
}

const ImageConvertContext = createContext<ImageConvertContextValue | null>(null);

export function useImageConvertContext(): UseImageConvertResult {
  const ctx = useContext(ImageConvertContext);
  if (!ctx) {
    throw new Error(
      'ImageConvert primitives 必须包裹在 <ImageConvert.Root> 内使用,以获取 hook 状态。'
    );
  }
  return ctx.state;
}

// ─── Root ───────────────────────────────────────────────────

export interface ImageConvertRootProps extends UseEmbedActionOptions<ConvertPreset> {
  children: ReactNode;
}

export function ImageConvertRoot({ children, ...options }: ImageConvertRootProps) {
  const state = useImageConvert(options);
  return (
    <ImageConvertContext.Provider value={{ state }}>
      {children}
    </ImageConvertContext.Provider>
  );
}

// ─── Upload ─────────────────────────────────────────────────

export interface ImageConvertUploadProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode | ((state: { isDragging: boolean }) => ReactNode);
  accept?: string;
  disabled?: boolean;
  'aria-label'?: string;
  id?: string;
}

export function ImageConvertUpload({
  className,
  style,
  children,
  accept = 'image/*',
  disabled = false,
  'aria-label': ariaLabel = 'Upload image',
  id,
}: ImageConvertUploadProps) {
  const state = useImageConvertContext();
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

export interface ImageConvertPresetSwitcherProps {
  className?: string;
  style?: CSSProperties;
  renderButton?: (
    preset: ConvertPreset,
    isSelected: boolean,
    onClick: () => void,
    disabled: boolean
  ) => ReactNode;
  presets?: ConvertPreset[];
  'aria-label'?: string;
}

const DEFAULT_PRESETS: ConvertPreset[] = ['png', 'webp', 'avif', 'jpeg'];

export function ImageConvertPresetSwitcher({
  className,
  style,
  renderButton,
  presets = DEFAULT_PRESETS,
  'aria-label': ariaLabel = 'Convert preset',
}: ImageConvertPresetSwitcherProps) {
  const state = useImageConvertContext();
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={className} style={style}>
      {presets.map((p) => {
        const isSelected = state.preset === p;
        // busy 或浏览器不支持该格式(检测完成后)时禁用——
        // 不支持的格式会被 canvas 静默回退为 PNG,不应可选。
        const disabled =
          state.busy || (state.formatSupport != null && !state.formatSupport[p]);
        const onClick = () => {
          if (!disabled) state.setPreset(p);
        };
        return (
          <span key={p}>
            {renderButton
              ? renderButton(p, isSelected, onClick, disabled)
              : <DefaultPresetButton preset={p} isSelected={isSelected} onClick={onClick} disabled={disabled} />}
          </span>
        );
      })}
    </div>
  );
}

// ─── Preview ────────────────────────────────────────────────

export interface ImageConvertPreviewProps {
  type: 'input' | 'output';
  className?: string;
  style?: CSSProperties;
  placeholder?: ReactNode;
  alt?: string;
  /** 是否渲染文件信息栏(默认 true;Layer 2 设 false 自行渲染 FileInfoBar) */
  showInfo?: boolean;
}

export function ImageConvertPreview({
  type,
  className,
  style,
  placeholder = 'No image',
  alt,
  showInfo = true,
}: ImageConvertPreviewProps) {
  const state = useImageConvertContext();
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

// ─── FormatBadge ────────────────────────────────────────────

export interface ImageConvertFormatBadgeProps {
  className?: string;
  style?: CSSProperties;
  /** 自定义格式化函数(接收 input 与 output 的格式字符串) */
  format?: (inputFormat: string, outputFormat: string) => string;
  empty?: ReactNode;
}

/** 格式徽章原语:展示 input → output 格式变化 */
export function ImageConvertFormatBadge({
  className,
  style,
  format,
  empty = null,
}: ImageConvertFormatBadgeProps) {
  const state = useImageConvertContext();
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

export interface ImageConvertDownloadButtonProps {
  className?: string;
  style?: CSSProperties;
  fileName?: string;
  extension?: string;
  children?: ReactNode;
  empty?: ReactNode;
}

export function ImageConvertDownloadButton({
  className,
  style,
  fileName = 'converted',
  extension,
  children = 'Download',
  empty = null,
}: ImageConvertDownloadButtonProps) {
  const state = useImageConvertContext();
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

export interface ImageConvertErrorDisplayProps {
  className?: string;
  style?: CSSProperties;
  format?: (error: string) => string;
  empty?: ReactNode;
}

export function ImageConvertErrorDisplay({
  className,
  style,
  format,
  empty = null,
}: ImageConvertErrorDisplayProps) {
  const state = useImageConvertContext();
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

export interface ImageConvertResetButtonProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  disabledWhenEmpty?: boolean;
}

export function ImageConvertResetButton({
  className,
  style,
  children = 'Reset',
  disabledWhenEmpty = true,
}: ImageConvertResetButtonProps) {
  const state = useImageConvertContext();
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

export const ImageConvert = {
  Root: ImageConvertRoot,
  Upload: ImageConvertUpload,
  PresetSwitcher: ImageConvertPresetSwitcher,
  Preview: ImageConvertPreview,
  FormatBadge: ImageConvertFormatBadge,
  DownloadButton: ImageConvertDownloadButton,
  ErrorDisplay: ImageConvertErrorDisplay,
  ResetButton: ImageConvertResetButton,
};
