/**
 * ImageCrop — 无样式原语集合(Layer 1)。
 *
 * 8 个原语(其中 CropArea 替代其他工具的 Badge 类原语):
 *   - Root:提供 context
 *   - Upload:拖拽 + 点击选择
 *   - PresetSwitcher:渲染预设按钮组
 *   - Preview:渲染 input 或 output 图片
 *   - CropArea:展示 input 图片 + 当前裁剪区域叠加层(QA-5 新增原语)
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
  useImageCrop,
  type CropPreset,
  type UseImageCropResult,
  type UseEmbedActionOptions,
} from '../hooks/useImageCrop';
import { fileMatchesAccept, guessExtension, DefaultPresetButton } from './shared';

// ─── Context ────────────────────────────────────────────────

interface ImageCropContextValue {
  state: UseImageCropResult;
}

const ImageCropContext = createContext<ImageCropContextValue | null>(null);

export function useImageCropContext(): UseImageCropResult {
  const ctx = useContext(ImageCropContext);
  if (!ctx) {
    throw new Error(
      'ImageCrop primitives 必须包裹在 <ImageCrop.Root> 内使用,以获取 hook 状态。'
    );
  }
  return ctx.state;
}

// ─── Root ───────────────────────────────────────────────────

export interface ImageCropRootProps extends UseEmbedActionOptions<CropPreset> {
  children: ReactNode;
}

export function ImageCropRoot({ children, ...options }: ImageCropRootProps) {
  const state = useImageCrop(options);
  return (
    <ImageCropContext.Provider value={{ state }}>
      {children}
    </ImageCropContext.Provider>
  );
}

// ─── Upload ─────────────────────────────────────────────────

export interface ImageCropUploadProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode | ((state: { isDragging: boolean }) => ReactNode);
  accept?: string;
  disabled?: boolean;
  'aria-label'?: string;
  id?: string;
}

export function ImageCropUpload({
  className,
  style,
  children,
  accept = 'image/*',
  disabled = false,
  'aria-label': ariaLabel = 'Upload image',
  id,
}: ImageCropUploadProps) {
  const state = useImageCropContext();
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

export interface ImageCropPresetSwitcherProps {
  className?: string;
  style?: CSSProperties;
  renderButton?: (preset: CropPreset, isSelected: boolean, onClick: () => void) => ReactNode;
  presets?: CropPreset[];
  'aria-label'?: string;
}

const DEFAULT_PRESETS: CropPreset[] = ['square', '4:3', '16:9', 'free'];

export function ImageCropPresetSwitcher({
  className,
  style,
  renderButton,
  presets = DEFAULT_PRESETS,
  'aria-label': ariaLabel = 'Crop preset',
}: ImageCropPresetSwitcherProps) {
  const state = useImageCropContext();
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

export interface ImageCropPreviewProps {
  type: 'input' | 'output';
  className?: string;
  style?: CSSProperties;
  placeholder?: ReactNode;
  alt?: string;
  /** 是否渲染文件信息栏(默认 true;Layer 2 设 false 自行渲染 FileInfoBar) */
  showInfo?: boolean;
}

export function ImageCropPreview({
  type,
  className,
  style,
  placeholder = 'No image',
  alt,
  showInfo = true,
}: ImageCropPreviewProps) {
  const state = useImageCropContext();
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

// ─── CropArea(QA-5 新增原语) ───────────────────────────────

export interface ImageCropAreaProps {
  className?: string;
  style?: CSSProperties;
  /** 占位文案(无输入图片时显示) */
  placeholder?: ReactNode;
  /** 图片 alt 文案 */
  alt?: string;
  /** 自定义渲染裁剪框叠加层(接收 cropRect + 缩放比例) */
  renderOverlay?: (rect: { x: number; y: number; width: number; height: number }, scale: number) => ReactNode;
  /** 裁剪框样式覆盖 */
  overlayStyle?: CSSProperties;
  /** ARIA label */
  'aria-label'?: string;
}

/**
 * 裁剪区域原语:展示 input 图片 + 当前裁剪框叠加层。
 *
 * 设计:
 *   - 用 <img> 作为底层(input 图片)
 *   - 用绝对定位的 <div> 作为裁剪框叠加层(显示 cropRect)
 *   - 裁剪框尺寸根据 cropRect 与图片实际渲染尺寸按比例缩放
 *   - 当前版本为只读(不支持拖拽/调整大小,后续可扩展)
 */
export function ImageCropArea({
  className,
  style,
  placeholder = 'No image',
  alt,
  renderOverlay,
  overlayStyle,
  'aria-label': ariaLabel = 'Crop area',
}: ImageCropAreaProps) {
  const state = useImageCropContext();
  if (!state.inputUrl || !state.inputInfo) {
    return (
      <div className={className} style={style} aria-label={ariaLabel}>
        <span>{placeholder}</span>
      </div>
    );
  }
  const { width: imgW, height: imgH } = state.inputInfo;
  const rect = state.cropRect;
  return (
    <div
      className={className}
      style={{ position: 'relative', ...style }}
      aria-label={ariaLabel}
      role="img"
    >
      <img
        src={state.inputUrl}
        alt={alt ?? 'input image with crop overlay'}
        loading="lazy"
        decoding="async"
        style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', objectFit: 'contain' }}
      />
      {rect && (
        <div
          aria-label={`Crop region: ${rect.width}×${rect.height} at (${rect.x}, ${rect.y})`}
          style={{
            position: 'absolute',
            // 按比例换算到容器坐标
            left: `${(rect.x / imgW) * 100}%`,
            top: `${(rect.y / imgH) * 100}%`,
            width: `${(rect.width / imgW) * 100}%`,
            height: `${(rect.height / imgH) * 100}%`,
            border: '2px solid currentColor',
            boxSizing: 'border-box',
            pointerEvents: 'none',
            ...overlayStyle,
          }}
        >
          {renderOverlay
            ? renderOverlay(rect, imgW / rect.width)
            : undefined}
        </div>
      )}
    </div>
  );
}

// ─── DownloadButton ─────────────────────────────────────────

export interface ImageCropDownloadButtonProps {
  className?: string;
  style?: CSSProperties;
  fileName?: string;
  extension?: string;
  children?: ReactNode;
  empty?: ReactNode;
}

export function ImageCropDownloadButton({
  className,
  style,
  fileName = 'cropped',
  extension,
  children = 'Download',
  empty = null,
}: ImageCropDownloadButtonProps) {
  const state = useImageCropContext();
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

export interface ImageCropErrorDisplayProps {
  className?: string;
  style?: CSSProperties;
  format?: (error: string) => string;
  empty?: ReactNode;
}

export function ImageCropErrorDisplay({
  className,
  style,
  format,
  empty = null,
}: ImageCropErrorDisplayProps) {
  const state = useImageCropContext();
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

export interface ImageCropResetButtonProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  disabledWhenEmpty?: boolean;
}

export function ImageCropResetButton({
  className,
  style,
  children = 'Reset',
  disabledWhenEmpty = true,
}: ImageCropResetButtonProps) {
  const state = useImageCropContext();
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

export const ImageCrop = {
  Root: ImageCropRoot,
  Upload: ImageCropUpload,
  PresetSwitcher: ImageCropPresetSwitcher,
  Preview: ImageCropPreview,
  CropArea: ImageCropArea,
  DownloadButton: ImageCropDownloadButton,
  ErrorDisplay: ImageCropErrorDisplay,
  ResetButton: ImageCropResetButton,
};
