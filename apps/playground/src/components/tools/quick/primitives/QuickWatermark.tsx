/**
 * QuickWatermark — 无样式原语集合(Layer 1)。
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
import { downloadBlob, formatBytes } from '@/components/toolkit/download';
import {
  useQuickWatermark,
  type WatermarkPreset,
  type UseQuickWatermarkResult,
  type UseQuickActionOptions,
} from '../useQuickWatermark';
import { fileMatchesAccept, guessExtension, DefaultPresetButton } from './shared';

// ─── Context ────────────────────────────────────────────────

interface QuickWatermarkContextValue {
  state: UseQuickWatermarkResult;
}

const QuickWatermarkContext = createContext<QuickWatermarkContextValue | null>(null);

function useQuickWatermarkContext(): UseQuickWatermarkResult {
  const ctx = useContext(QuickWatermarkContext);
  if (!ctx) {
    throw new Error(
      'QuickWatermark primitives 必须包裹在 <QuickWatermark.Root> 内使用,以获取 hook 状态。'
    );
  }
  return ctx.state;
}

// ─── Root ───────────────────────────────────────────────────

export interface QuickWatermarkRootProps extends UseQuickActionOptions<WatermarkPreset> {
  children: ReactNode;
  /** 初始水印文字(默认 'Lokvis') */
  initialText?: string;
}

export function QuickWatermarkRoot({ children, ...options }: QuickWatermarkRootProps) {
  const state = useQuickWatermark(options);
  return (
    <QuickWatermarkContext.Provider value={{ state }}>
      {children}
    </QuickWatermarkContext.Provider>
  );
}

// ─── Upload ─────────────────────────────────────────────────

export interface QuickWatermarkUploadProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode | ((state: { isDragging: boolean }) => ReactNode);
  accept?: string;
  disabled?: boolean;
  'aria-label'?: string;
  id?: string;
}

export function QuickWatermarkUpload({
  className,
  style,
  children,
  accept = 'image/*',
  disabled = false,
  'aria-label': ariaLabel = 'Upload image',
  id,
}: QuickWatermarkUploadProps) {
  const state = useQuickWatermarkContext();
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

export interface QuickWatermarkPresetSwitcherProps {
  className?: string;
  style?: CSSProperties;
  renderButton?: (preset: WatermarkPreset, isSelected: boolean, onClick: () => void) => ReactNode;
  presets?: WatermarkPreset[];
  'aria-label'?: string;
}

const DEFAULT_PRESETS: WatermarkPreset[] = ['small-br', 'large-center', 'tile'];

export function QuickWatermarkPresetSwitcher({
  className,
  style,
  renderButton,
  presets = DEFAULT_PRESETS,
  'aria-label': ariaLabel = 'Watermark preset',
}: QuickWatermarkPresetSwitcherProps) {
  const state = useQuickWatermarkContext();
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

export interface QuickWatermarkPreviewProps {
  type: 'input' | 'output';
  className?: string;
  style?: CSSProperties;
  placeholder?: ReactNode;
  alt?: string;
}

export function QuickWatermarkPreview({
  type,
  className,
  style,
  placeholder = 'No image',
  alt,
}: QuickWatermarkPreviewProps) {
  const state = useQuickWatermarkContext();
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

// ─── TextInput(QA-4 新增原语) ──────────────────────────────

export interface QuickWatermarkTextInputProps {
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
export function QuickWatermarkTextInput({
  className,
  style,
  'aria-label': ariaLabel = 'Watermark text',
  placeholder = 'Enter watermark text',
  maxLength = 50,
  id,
}: QuickWatermarkTextInputProps) {
  const state = useQuickWatermarkContext();
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

export interface QuickWatermarkDownloadButtonProps {
  className?: string;
  style?: CSSProperties;
  fileName?: string;
  extension?: string;
  children?: ReactNode;
  empty?: ReactNode;
}

export function QuickWatermarkDownloadButton({
  className,
  style,
  fileName = 'watermarked',
  extension,
  children = 'Download',
  empty = null,
}: QuickWatermarkDownloadButtonProps) {
  const state = useQuickWatermarkContext();
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

export interface QuickWatermarkErrorDisplayProps {
  className?: string;
  style?: CSSProperties;
  format?: (error: string) => string;
  empty?: ReactNode;
}

export function QuickWatermarkErrorDisplay({
  className,
  style,
  format,
  empty = null,
}: QuickWatermarkErrorDisplayProps) {
  const state = useQuickWatermarkContext();
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

export interface QuickWatermarkResetButtonProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  disabledWhenEmpty?: boolean;
}

export function QuickWatermarkResetButton({
  className,
  style,
  children = 'Reset',
  disabledWhenEmpty = true,
}: QuickWatermarkResetButtonProps) {
  const state = useQuickWatermarkContext();
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

export const QuickWatermark = {
  Root: QuickWatermarkRoot,
  Upload: QuickWatermarkUpload,
  PresetSwitcher: QuickWatermarkPresetSwitcher,
  Preview: QuickWatermarkPreview,
  TextInput: QuickWatermarkTextInput,
  DownloadButton: QuickWatermarkDownloadButton,
  ErrorDisplay: QuickWatermarkErrorDisplay,
  ResetButton: QuickWatermarkResetButton,
};
