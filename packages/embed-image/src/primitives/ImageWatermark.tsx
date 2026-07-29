/**
 * ImageWatermark — 无样式原语集合(Layer 1)。
 *
 * 8 个原语(其中 TextInput 替代其他工具的 Badge 类原语):
 *   - Root:提供 context
 *   - Upload:拖拽 + 点击选择
 *   - PresetSwitcher:渲染预设按钮组
 *   - Preview:渲染 input 或 output 图片
 *   - TextInput:水印文字输入框(QA-4 新增原语)
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
  useImageWatermark,
  type WatermarkPreset,
  type UseImageWatermarkResult,
  type UseEmbedActionOptions,
} from '../hooks/useImageWatermark';
import { fileMatchesAccept, guessExtension, DefaultPresetButton } from './shared';

// ─── Context ────────────────────────────────────────────────

interface ImageWatermarkContextValue {
  state: UseImageWatermarkResult;
}

const ImageWatermarkContext = createContext<ImageWatermarkContextValue | null>(null);

export function useImageWatermarkContext(): UseImageWatermarkResult {
  const ctx = useContext(ImageWatermarkContext);
  if (!ctx) {
    throw new Error(
      'ImageWatermark primitives 必须包裹在 <ImageWatermark.Root> 内使用,以获取 hook 状态。'
    );
  }
  return ctx.state;
}

// ─── Root ───────────────────────────────────────────────────

export interface ImageWatermarkRootProps extends UseEmbedActionOptions<WatermarkPreset> {
  children: ReactNode;
  /** 初始水印文字(默认 'Lokvis') */
  initialText?: string;
}

export function ImageWatermarkRoot({ children, ...options }: ImageWatermarkRootProps) {
  const state = useImageWatermark(options);
  return (
    <ImageWatermarkContext.Provider value={{ state }}>
      {children}
    </ImageWatermarkContext.Provider>
  );
}

// ─── Upload ─────────────────────────────────────────────────

export interface ImageWatermarkUploadProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode | ((state: { isDragging: boolean }) => ReactNode);
  accept?: string;
  disabled?: boolean;
  'aria-label'?: string;
  id?: string;
}

export function ImageWatermarkUpload({
  className,
  style,
  children,
  accept = 'image/*',
  disabled = false,
  'aria-label': ariaLabel = 'Upload image',
  id,
}: ImageWatermarkUploadProps) {
  const state = useImageWatermarkContext();
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

export interface ImageWatermarkPresetSwitcherProps {
  className?: string;
  style?: CSSProperties;
  renderButton?: (preset: WatermarkPreset, isSelected: boolean, onClick: () => void) => ReactNode;
  presets?: WatermarkPreset[];
  'aria-label'?: string;
}

const DEFAULT_PRESETS: WatermarkPreset[] = ['small-br', 'large-center', 'tile'];

export function ImageWatermarkPresetSwitcher({
  className,
  style,
  renderButton,
  presets = DEFAULT_PRESETS,
  'aria-label': ariaLabel = 'Watermark preset',
}: ImageWatermarkPresetSwitcherProps) {
  const state = useImageWatermarkContext();
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

export interface ImageWatermarkPreviewProps {
  type: 'input' | 'output';
  className?: string;
  style?: CSSProperties;
  placeholder?: ReactNode;
  alt?: string;
  /** 是否渲染文件信息栏(默认 true;Layer 2 设 false 自行渲染 FileInfoBar) */
  showInfo?: boolean;
}

export function ImageWatermarkPreview({
  type,
  className,
  style,
  placeholder = 'No image',
  alt,
  showInfo = true,
}: ImageWatermarkPreviewProps) {
  const state = useImageWatermarkContext();
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

// ─── TextInput(QA-4 新增原语) ──────────────────────────────

export interface ImageWatermarkTextInputProps {
  className?: string;
  style?: CSSProperties;
  /** ARIA label */
  'aria-label'?: string;
  /** placeholder */
  placeholder?: string;
  /** 最大长度(默认 50) */
  maxLength?: number;
  /** id 用于关联 label */
  id?: string;
}

/**
 * 水印文字输入原语:零样式,绑定 hook 的 text / setText。
 * 文字变化时,若有输入图片则自动重跑(由 hook 内部处理)。
 */
export function ImageWatermarkTextInput({
  className,
  style,
  'aria-label': ariaLabel = 'Watermark text',
  placeholder = 'Enter watermark text',
  maxLength = 50,
  id,
}: ImageWatermarkTextInputProps) {
  const state = useImageWatermarkContext();
  return (
    <input
      id={id}
      type="text"
      role="textbox"
      aria-label={ariaLabel}
      placeholder={placeholder}
      maxLength={maxLength}
      disabled={state.busy}
      value={state.text}
      onChange={(e) => state.setText(e.target.value)}
      className={className}
      style={style}
    />
  );
}

// ─── DownloadButton ─────────────────────────────────────────

export interface ImageWatermarkDownloadButtonProps {
  className?: string;
  style?: CSSProperties;
  fileName?: string;
  extension?: string;
  children?: ReactNode;
  empty?: ReactNode;
}

export function ImageWatermarkDownloadButton({
  className,
  style,
  fileName = 'watermarked',
  extension,
  children = 'Download',
  empty = null,
}: ImageWatermarkDownloadButtonProps) {
  const state = useImageWatermarkContext();
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

export interface ImageWatermarkErrorDisplayProps {
  className?: string;
  style?: CSSProperties;
  format?: (error: string) => string;
  empty?: ReactNode;
}

export function ImageWatermarkErrorDisplay({
  className,
  style,
  format,
  empty = null,
}: ImageWatermarkErrorDisplayProps) {
  const state = useImageWatermarkContext();
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

export interface ImageWatermarkResetButtonProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  disabledWhenEmpty?: boolean;
}

export function ImageWatermarkResetButton({
  className,
  style,
  children = 'Reset',
  disabledWhenEmpty = true,
}: ImageWatermarkResetButtonProps) {
  const state = useImageWatermarkContext();
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

export const ImageWatermark = {
  Root: ImageWatermarkRoot,
  Upload: ImageWatermarkUpload,
  PresetSwitcher: ImageWatermarkPresetSwitcher,
  Preview: ImageWatermarkPreview,
  TextInput: ImageWatermarkTextInput,
  DownloadButton: ImageWatermarkDownloadButton,
  ErrorDisplay: ImageWatermarkErrorDisplay,
  ResetButton: ImageWatermarkResetButton,
};
