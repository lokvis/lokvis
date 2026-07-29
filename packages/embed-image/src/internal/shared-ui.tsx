/**
 * Layer 2 默认 UI 共享组件(避免 6 个 ImageQuickXxx 文件复制粘贴)。
 *
 * F2:BusyOverlay — 处理中视觉反馈(shimmer + spinner + 文案)
 * F3:FileInfoBar — 文件信息栏(format badge · WxH · formatBytes)
 *
 * F6 将继续把其他重复的默认子组件(UploadBox / PreviewBox / PresetSwitcher 等)
 * 迁移到本文件。
 */
import type { CSSProperties, ReactNode } from 'react';
import { formatBytes } from '@lokvis/runtime';
import type { ImageInfo } from './download';

export interface BusyOverlayProps {
  /** 是否处于处理中状态 */
  busy: boolean;
  /** 处理中文案(已 i18n) */
  label: string;
  /** 被包裹的内容(通常是 output PreviewBox) */
  children: ReactNode;
  /** 自定义 className */
  className?: string;
  /** 自定义 style */
  style?: CSSProperties;
}

/**
 * 处理中视觉反馈 overlay。
 *
 * - busy=false:仅渲染 children(透明 wrapper)
 * - busy=true :在 children 上叠加 shimmer 骨架 + 居中 spinner + processing 文案
 *
 * 容器带 `aria-busy` + `role="status"` + `aria-live="polite"`,
 * 屏幕阅读器会在处理开始/结束时播报。
 *
 * 依赖 styles.css 中的 `.lokvis-quick-shimmer` 和 `.lokvis-quick-spinner` 类。
 */
export function BusyOverlay({ busy, label, children, className = '', style }: BusyOverlayProps) {
  return (
    <div
      className={`relative ${className}`}
      style={style}
      aria-busy={busy}
      role={busy ? 'status' : undefined}
      aria-live={busy ? 'polite' : undefined}
    >
      {children}
      {busy && (
        <>
          <div className="lokvis-quick-shimmer" />
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            style={{
              background: 'var(--lokvis-surface, #ffffff)',
              opacity: 0.75,
            }}
          >
            <span className="lokvis-quick-spinner" aria-hidden="true" />
            <span
              className="text-xs"
              style={{ color: 'var(--lokvis-text-muted, #71717a)' }}
            >
              {label}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── F3:文件信息栏 ─────────────────────────────────────────

export interface FileInfoBarProps {
  /** 图片信息(width/height/size/format);为 null 时不渲染 */
  info: ImageInfo | null;
  /** 自定义 className */
  className?: string;
  /** 自定义 style */
  style?: CSSProperties;
}

/**
 * 文件信息栏:format badge · {width}×{height} · formatBytes(size)。
 *
 * - info 为 null 时不渲染(F3 验收:无输出时信息栏隐藏)
 * - format badge 用 surface-hover 背景的小标签,大写显示格式名
 * - 颜色走 --lokvis-text-muted 变量(F1 依赖)
 *
 * 用法:
 * ```tsx
 * <FileInfoBar info={inputInfo} />
 * ```
 */
export function FileInfoBar({ info, className = '', style }: FileInfoBarProps) {
  if (!info) return null;
  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      style={{
        color: 'var(--lokvis-text-muted, #71717a)',
        fontSize: '0.75rem',
        ...style,
      }}
    >
      <span
        className="rounded px-1.5 py-0.5 font-semibold uppercase"
        style={{
          background: 'var(--lokvis-surface-hover, #f4f4f5)',
          color: 'var(--lokvis-text, #18181b)',
          fontSize: '0.625rem',
          letterSpacing: '0.025em',
        }}
      >
        {info.format}
      </span>
      <span>{info.width}×{info.height}</span>
      <span aria-hidden="true">·</span>
      <span>{formatBytes(info.size)}</span>
    </div>
  );
}
