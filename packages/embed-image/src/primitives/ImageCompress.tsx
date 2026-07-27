/**
 * ImageCompress — 无样式原语集合(Layer 1)。
 *
 * 8 个原语:
 *   - Root:提供 context,接收所有配置(透传给 useImageCompress)
 *   - Upload:拖拽 + 点击选择,接收 onFiles 回调
 *   - PresetSwitcher:渲染预设按钮组,接收 preset + onChange
 *   - Preview:渲染 input 或 output 图片,接收 type='input'|'output'
 *   - RatioBadge:渲染压缩率文字,接收 format 函数
 *   - DownloadButton:触发下载,接收 fileName
 *   - ErrorDisplay:渲染 error 文案,接收 format 函数
 *   - ResetButton:触发 reset
 *
 * 设计原则:
 *   - 零内置 className / style(三方完全自定义外观)
 *   - 提供完整 ARIA 属性(role, aria-label, aria-disabled 等)
 *   - 提供数据 props(状态 + 事件回调)
 *   - 必须包裹在 <ImageCompress.Root> 内使用(通过 context 拿到 hook 状态)
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
  useImageCompress,
  type CompressPreset,
  type UseImageCompressResult,
  type UseEmbedActionOptions,
} from '../hooks/useImageCompress';
import { fileMatchesAccept, DefaultPresetButton, guessExtension } from './shared';

// ─── Context ────────────────────────────────────────────────

interface ImageCompressContextValue {
  state: UseImageCompressResult;
}

const ImageCompressContext = createContext<ImageCompressContextValue | null>(null);

export function useImageCompressContext(): UseImageCompressResult {
  const ctx = useContext(ImageCompressContext);
  if (!ctx) {
    throw new Error(
      'ImageCompress primitives 必须包裹在 <ImageCompress.Root> 内使用,以获取 hook 状态。'
    );
  }
  return ctx.state;
}

// ─── Root ───────────────────────────────────────────────────

export interface ImageCompressRootProps extends UseEmbedActionOptions<CompressPreset> {
  children: ReactNode;
}

/** 根组件:提供 context,接收所有配置透传给 useImageCompress */
export function ImageCompressRoot({ children, ...options }: ImageCompressRootProps) {
  const state = useImageCompress(options);
  return (
    <ImageCompressContext.Provider value={{ state }}>
      {children}
    </ImageCompressContext.Provider>
  );
}

// ─── Upload ─────────────────────────────────────────────────

export interface ImageCompressUploadProps {
  className?: string;
  style?: CSSProperties;
  /** 自定义 children(默认渲染文案;函数形式接收 isDragging 状态) */
  children?: ReactNode | ((state: { isDragging: boolean }) => ReactNode);
  /** 接受的文件类型,默认 'image/*' */
  accept?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** ARIA 标签 */
  'aria-label'?: string;
  /** id 用于关联 <input type=file> 与 label */
  id?: string;
}

/** 上传区原语:零样式,提供拖拽 + 点击 + ARIA */
export function ImageCompressUpload({
  className,
  style,
  children,
  accept = 'image/*',
  disabled = false,
  'aria-label': ariaLabel = 'Upload image',
  id,
}: ImageCompressUploadProps) {
  const state = useImageCompressContext();
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

export interface ImageCompressPresetSwitcherProps {
  className?: string;
  style?: CSSProperties;
  /** 渲染每个预设按钮的函数(可选,默认渲染 <button>) */
  renderButton?: (preset: CompressPreset, isSelected: boolean, onClick: () => void) => ReactNode;
  /** 预设顺序,默认 ['balanced', 'highQuality', 'small'] */
  presets?: CompressPreset[];
  /** ARIA label */
  'aria-label'?: string;
}

const DEFAULT_PRESETS: CompressPreset[] = ['balanced', 'highQuality', 'small'];

/** 预设切换器原语:渲染预设按钮组 */
export function ImageCompressPresetSwitcher({
  className,
  style,
  renderButton,
  presets = DEFAULT_PRESETS,
  'aria-label': ariaLabel = 'Compression preset',
}: ImageCompressPresetSwitcherProps) {
  const state = useImageCompressContext();
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

export interface ImageCompressPreviewProps {
  /** 渲染输入或输出图片 */
  type: 'input' | 'output';
  className?: string;
  style?: CSSProperties;
  /** 占位文案(无图片时显示) */
  placeholder?: ReactNode;
  /** 图片 alt 文案 */
  alt?: string;
  /** 是否渲染文件信息栏(默认 true;Layer 2 设 false 自行渲染 FileInfoBar) */
  showInfo?: boolean;
}

/** 预览区原语:渲染 input 或 output 图片 */
export function ImageCompressPreview({
  type,
  className,
  style,
  placeholder = 'No image',
  alt,
  showInfo = true,
}: ImageCompressPreviewProps) {
  const state = useImageCompressContext();
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

// ─── RatioBadge ─────────────────────────────────────────────

export interface ImageCompressRatioBadgeProps {
  className?: string;
  style?: CSSProperties;
  /** 自定义格式化函数 */
  format?: (ratio: number, inputSize: number, outputSize: number) => string;
  /** 无输出时显示的内容 */
  empty?: ReactNode;
}

/** 压缩率徽章原语 */
export function ImageCompressRatioBadge({
  className,
  style,
  format,
  empty = null,
}: ImageCompressRatioBadgeProps) {
  const state = useImageCompressContext();
  if (state.ratio === null || !state.inputInfo || !state.outputInfo) {
    return empty !== null ? <span className={className} style={style}>{empty}</span> : null;
  }
  const text = format
    ? format(state.ratio, state.inputInfo.size, state.outputInfo.size)
    : `${state.ratio >= 0 ? 'Saved' : 'Increased'} ${Math.abs(state.ratio).toFixed(1)}% (${formatBytes(state.inputInfo.size)} → ${formatBytes(state.outputInfo.size)})`;
  return (
    <span className={className} style={style} role="status">
      {text}
    </span>
  );
}

// ─── DownloadButton ─────────────────────────────────────────

export interface ImageCompressDownloadButtonProps {
  className?: string;
  style?: CSSProperties;
  /** 下载文件名(不含扩展名,默认 'compressed') */
  fileName?: string;
  /** 下载文件扩展名(默认按 outputBlob.type 推断,见 guessExtension) */
  extension?: string;
  children?: ReactNode;
  /** 无输出时的渲染 */
  empty?: ReactNode;
}

/** 下载按钮原语:触发浏览器下载 */
export function ImageCompressDownloadButton({
  className,
  style,
  fileName = 'compressed',
  extension,
  children = 'Download',
  empty = null,
}: ImageCompressDownloadButtonProps) {
  const state = useImageCompressContext();
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

export interface ImageCompressErrorDisplayProps {
  className?: string;
  style?: CSSProperties;
  /** 自定义格式化函数 */
  format?: (error: string) => string;
  /** 无错误时的渲染 */
  empty?: ReactNode;
}

/** 错误显示原语 */
export function ImageCompressErrorDisplay({
  className,
  style,
  format,
  empty = null,
}: ImageCompressErrorDisplayProps) {
  const state = useImageCompressContext();
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

export interface ImageCompressResetButtonProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  /** 无输入时是否禁用(默认 true) */
  disabledWhenEmpty?: boolean;
}

/** 重置按钮原语 */
export function ImageCompressResetButton({
  className,
  style,
  children = 'Reset',
  disabledWhenEmpty = true,
}: ImageCompressResetButtonProps) {
  const state = useImageCompressContext();
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

/**
 * ImageCompress 原语集合(Layer 1)。
 *
 * 用法:
 * ```tsx
 * <ImageCompress.Root initialPreset="balanced">
 *   <ImageCompress.Upload className="my-upload">点击上传</ImageCompress.Upload>
 *   <ImageCompress.PresetSwitcher className="my-switcher" />
 *   <ImageCompress.Preview type="output" className="my-preview" />
 *   <ImageCompress.RatioBadge className="my-ratio" />
 *   <ImageCompress.DownloadButton className="my-btn">下载</ImageCompress.DownloadButton>
 * </ImageCompress.Root>
 * ```
 */
export const ImageCompress = {
  Root: ImageCompressRoot,
  Upload: ImageCompressUpload,
  PresetSwitcher: ImageCompressPresetSwitcher,
  Preview: ImageCompressPreview,
  RatioBadge: ImageCompressRatioBadge,
  DownloadButton: ImageCompressDownloadButton,
  ErrorDisplay: ImageCompressErrorDisplay,
  ResetButton: ImageCompressResetButton,
};
