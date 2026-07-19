/**
 * QuickCompress — 无样式原语集合(Layer 1)。
 *
 * 8 个原语:
 *   - Root:提供 context,接收所有配置(透传给 useQuickCompress)
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
 *   - 必须包裹在 <QuickCompress.Root> 内使用(通过 context 拿到 hook 状态)
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
  useQuickCompress,
  type CompressPreset,
  type UseQuickCompressResult,
  type UseQuickActionOptions,
} from '../useQuickCompress';
import { fileMatchesAccept, DefaultPresetButton } from './shared';

// ─── Context ────────────────────────────────────────────────

interface QuickCompressContextValue {
  state: UseQuickCompressResult;
}

const QuickCompressContext = createContext<QuickCompressContextValue | null>(null);

function useQuickCompressContext(): UseQuickCompressResult {
  const ctx = useContext(QuickCompressContext);
  if (!ctx) {
    throw new Error(
      'QuickCompress primitives 必须包裹在 <QuickCompress.Root> 内使用,以获取 hook 状态。'
    );
  }
  return ctx.state;
}

// ─── Root ───────────────────────────────────────────────────

export interface QuickCompressRootProps extends UseQuickActionOptions<CompressPreset> {
  children: ReactNode;
}

/** 根组件:提供 context,接收所有配置透传给 useQuickCompress */
export function QuickCompressRoot({ children, ...options }: QuickCompressRootProps) {
  const state = useQuickCompress(options);
  return (
    <QuickCompressContext.Provider value={{ state }}>
      {children}
    </QuickCompressContext.Provider>
  );
}

// ─── Upload ─────────────────────────────────────────────────

export interface QuickCompressUploadProps {
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
export function QuickCompressUpload({
  className,
  style,
  children,
  accept = 'image/*',
  disabled = false,
  'aria-label': ariaLabel = 'Upload image',
  id,
}: QuickCompressUploadProps) {
  const state = useQuickCompressContext();
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
        className="hidden"
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

export interface QuickCompressPresetSwitcherProps {
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
export function QuickCompressPresetSwitcher({
  className,
  style,
  renderButton,
  presets = DEFAULT_PRESETS,
  'aria-label': ariaLabel = 'Compression preset',
}: QuickCompressPresetSwitcherProps) {
  const state = useQuickCompressContext();
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

export interface QuickCompressPreviewProps {
  /** 渲染输入或输出图片 */
  type: 'input' | 'output';
  className?: string;
  style?: CSSProperties;
  /** 占位文案(无图片时显示) */
  placeholder?: ReactNode;
  /** 图片 alt 文案 */
  alt?: string;
}

/** 预览区原语:渲染 input 或 output 图片 */
export function QuickCompressPreview({
  type,
  className,
  style,
  placeholder = 'No image',
  alt,
}: QuickCompressPreviewProps) {
  const state = useQuickCompressContext();
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

// ─── RatioBadge ─────────────────────────────────────────────

export interface QuickCompressRatioBadgeProps {
  className?: string;
  style?: CSSProperties;
  /** 自定义格式化函数 */
  format?: (ratio: number, inputSize: number, outputSize: number) => string;
  /** 无输出时显示的内容 */
  empty?: ReactNode;
}

/** 压缩率徽章原语 */
export function QuickCompressRatioBadge({
  className,
  style,
  format,
  empty = null,
}: QuickCompressRatioBadgeProps) {
  const state = useQuickCompressContext();
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

export interface QuickCompressDownloadButtonProps {
  className?: string;
  style?: CSSProperties;
  /** 下载文件名(不含扩展名,默认 'compressed') */
  fileName?: string;
  /** 下载文件扩展名(默认 'webp') */
  extension?: string;
  children?: ReactNode;
  /** 无输出时的渲染 */
  empty?: ReactNode;
}

/** 下载按钮原语:触发浏览器下载 */
export function QuickCompressDownloadButton({
  className,
  style,
  fileName = 'compressed',
  extension = 'webp',
  children = 'Download',
  empty = null,
}: QuickCompressDownloadButtonProps) {
  const state = useQuickCompressContext();
  if (!state.outputBlob) {
    return empty !== null ? <span className={className} style={style}>{empty}</span> : null;
  }
  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() => downloadBlob(state.outputBlob!, `${fileName}.${extension}`)}
    >
      {children}
    </button>
  );
}

// ─── ErrorDisplay ───────────────────────────────────────────

export interface QuickCompressErrorDisplayProps {
  className?: string;
  style?: CSSProperties;
  /** 自定义格式化函数 */
  format?: (error: string) => string;
  /** 无错误时的渲染 */
  empty?: ReactNode;
}

/** 错误显示原语 */
export function QuickCompressErrorDisplay({
  className,
  style,
  format,
  empty = null,
}: QuickCompressErrorDisplayProps) {
  const state = useQuickCompressContext();
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

export interface QuickCompressResetButtonProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  /** 无输入时是否禁用(默认 true) */
  disabledWhenEmpty?: boolean;
}

/** 重置按钮原语 */
export function QuickCompressResetButton({
  className,
  style,
  children = 'Reset',
  disabledWhenEmpty = true,
}: QuickCompressResetButtonProps) {
  const state = useQuickCompressContext();
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
 * QuickCompress 原语集合(Layer 1)。
 *
 * 用法:
 * ```tsx
 * <QuickCompress.Root initialPreset="balanced">
 *   <QuickCompress.Upload className="my-upload">点击上传</QuickCompress.Upload>
 *   <QuickCompress.PresetSwitcher className="my-switcher" />
 *   <QuickCompress.Preview type="output" className="my-preview" />
 *   <QuickCompress.RatioBadge className="my-ratio" />
 *   <QuickCompress.DownloadButton className="my-btn">下载</QuickCompress.DownloadButton>
 * </QuickCompress.Root>
 * ```
 */
export const QuickCompress = {
  Root: QuickCompressRoot,
  Upload: QuickCompressUpload,
  PresetSwitcher: QuickCompressPresetSwitcher,
  Preview: QuickCompressPreview,
  RatioBadge: QuickCompressRatioBadge,
  DownloadButton: QuickCompressDownloadButton,
  ErrorDisplay: QuickCompressErrorDisplay,
  ResetButton: QuickCompressResetButton,
};
