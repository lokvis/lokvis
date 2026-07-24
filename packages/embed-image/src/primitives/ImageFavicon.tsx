/**
 * ImageFavicon — 无样式原语集合(Layer 1)。
 *
 * 8 个原语(与 ImageConvert 同构,差异在 SizeBadge):
 *   - Root:提供 context
 *   - Upload:拖拽 + 点击选择
 *   - PresetSwitcher:渲染预设按钮组(standard/modern/full)
 *   - Preview:渲染 input 或 output 图片
 *   - SizeBadge:渲染当前预设包含的 ICO 尺寸(如 16 · 32 · 48 · 256)
 *   - DownloadButton:触发下载(默认扩展名 ico)
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
  useImageFavicon,
  IMAGE_FAVICON_PRESETS,
  type FaviconPreset,
  type UseImageFaviconResult,
  type UseEmbedActionOptions,
} from '../hooks/useImageFavicon';
import { fileMatchesAccept, guessExtension, DefaultPresetButton } from './shared';

// ─── Context ────────────────────────────────────────────────

interface ImageFaviconContextValue {
  state: UseImageFaviconResult;
}

const ImageFaviconContext = createContext<ImageFaviconContextValue | null>(null);

export function useImageFaviconContext(): UseImageFaviconResult {
  const ctx = useContext(ImageFaviconContext);
  if (!ctx) {
    throw new Error(
      'ImageFavicon primitives 必须包裹在 <ImageFavicon.Root> 内使用,以获取 hook 状态。'
    );
  }
  return ctx.state;
}

// ─── Root ───────────────────────────────────────────────────

export interface ImageFaviconRootProps extends UseEmbedActionOptions<FaviconPreset> {
  children: ReactNode;
}

export function ImageFaviconRoot({ children, ...options }: ImageFaviconRootProps) {
  const state = useImageFavicon(options);
  return (
    <ImageFaviconContext.Provider value={{ state }}>
      {children}
    </ImageFaviconContext.Provider>
  );
}

// ─── Upload ─────────────────────────────────────────────────

export interface ImageFaviconUploadProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode | ((state: { isDragging: boolean }) => ReactNode);
  accept?: string;
  disabled?: boolean;
  'aria-label'?: string;
  id?: string;
}

export function ImageFaviconUpload({
  className,
  style,
  children,
  accept = 'image/*',
  disabled = false,
  'aria-label': ariaLabel = 'Upload image',
  id,
}: ImageFaviconUploadProps) {
  const state = useImageFaviconContext();
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

export interface ImageFaviconPresetSwitcherProps {
  className?: string;
  style?: CSSProperties;
  renderButton?: (preset: FaviconPreset, isSelected: boolean, onClick: () => void) => ReactNode;
  presets?: FaviconPreset[];
  'aria-label'?: string;
}

const DEFAULT_PRESETS: FaviconPreset[] = ['standard', 'modern', 'full'];

export function ImageFaviconPresetSwitcher({
  className,
  style,
  renderButton,
  presets = DEFAULT_PRESETS,
  'aria-label': ariaLabel = 'Favicon preset',
}: ImageFaviconPresetSwitcherProps) {
  const state = useImageFaviconContext();
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

export interface ImageFaviconPreviewProps {
  type: 'input' | 'output';
  className?: string;
  style?: CSSProperties;
  placeholder?: ReactNode;
  alt?: string;
  /** 是否渲染文件信息栏(默认 true;Layer 2 设 false 自行渲染 FileInfoBar) */
  showInfo?: boolean;
}

export function ImageFaviconPreview({
  type,
  className,
  style,
  placeholder = 'No image',
  alt,
  showInfo = true,
}: ImageFaviconPreviewProps) {
  const state = useImageFaviconContext();
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

// ─── SizeBadge ──────────────────────────────────────────────

export interface ImageFaviconSizeBadgeProps {
  className?: string;
  style?: CSSProperties;
  /** 自定义格式化函数(接收当前预设的尺寸数组) */
  format?: (sizes: number[]) => string;
  empty?: ReactNode;
}

/** 尺寸徽章原语:展示当前预设包含的 ICO 尺寸 */
export function ImageFaviconSizeBadge({
  className,
  style,
  format,
  empty = null,
}: ImageFaviconSizeBadgeProps) {
  const state = useImageFaviconContext();
  const sizes = IMAGE_FAVICON_PRESETS[state.preset].sizes;
  if (sizes.length === 0) {
    return empty !== null ? <span className={className} style={style}>{empty}</span> : null;
  }
  const text = format ? format(sizes) : sizes.map((s) => `${s}px`).join(' · ');
  return (
    <span className={className} style={style} role="status">
      {text}
    </span>
  );
}

// ─── DownloadButton ─────────────────────────────────────────

export interface ImageFaviconDownloadButtonProps {
  className?: string;
  style?: CSSProperties;
  fileName?: string;
  extension?: string;
  children?: ReactNode;
  empty?: ReactNode;
}

export function ImageFaviconDownloadButton({
  className,
  style,
  fileName = 'favicon',
  extension,
  children = 'Download',
  empty = null,
}: ImageFaviconDownloadButtonProps) {
  const state = useImageFaviconContext();
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

export interface ImageFaviconErrorDisplayProps {
  className?: string;
  style?: CSSProperties;
  format?: (error: string) => string;
  empty?: ReactNode;
}

export function ImageFaviconErrorDisplay({
  className,
  style,
  format,
  empty = null,
}: ImageFaviconErrorDisplayProps) {
  const state = useImageFaviconContext();
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

export interface ImageFaviconResetButtonProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  disabledWhenEmpty?: boolean;
}

export function ImageFaviconResetButton({
  className,
  style,
  children = 'Reset',
  disabledWhenEmpty = true,
}: ImageFaviconResetButtonProps) {
  const state = useImageFaviconContext();
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

export const ImageFavicon = {
  Root: ImageFaviconRoot,
  Upload: ImageFaviconUpload,
  PresetSwitcher: ImageFaviconPresetSwitcher,
  Preview: ImageFaviconPreview,
  SizeBadge: ImageFaviconSizeBadge,
  DownloadButton: ImageFaviconDownloadButton,
  ErrorDisplay: ImageFaviconErrorDisplay,
  ResetButton: ImageFaviconResetButton,
};
