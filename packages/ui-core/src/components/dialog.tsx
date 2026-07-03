import * as React from 'react';
import { createPortal } from 'react-dom';

export interface DialogProps {
  /** 是否打开(受控) */
  open: boolean;
  /** 关闭回调(点遮罩 / ESC / 关闭按钮触发) */
  onClose: () => void;
  /** 标题 */
  title?: React.ReactNode;
  /** 底部操作区(通常放 Button) */
  footer?: React.ReactNode;
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 是否允许点遮罩关闭(默认 true) */
  closeOnOverlay?: boolean;
  children?: React.ReactNode;
}

const sizeClass = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
} as const;

/**
 * Dialog - 模态对话框。
 *
 * 通过 portal 挂载到 document.body,避免父级 transform/overflow 影响。
 * ESC 关闭、点遮罩关闭、打开时聚焦对话框、锁定 body 滚动。
 * 无障碍:role="dialog" + aria-modal,标题作为 aria-label。
 *
 * SSR 环境下 document 不存在时安全降级(返回 null)。
 */
export function Dialog({
  open,
  onClose,
  title,
  footer,
  size = 'md',
  closeOnOverlay = true,
  children,
}: DialogProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // 聚焦对话框内首个可聚焦元素
    dialogRef.current?.focus();
    // 阻止 body 滚动
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const overlayStyle: React.CSSProperties = {
    backgroundColor: 'var(--lokvis-overlay, rgb(0 0 0 / 0.5))',
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={overlayStyle}
      onClick={closeOnOverlay ? onClose : undefined}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={`w-full ${sizeClass[size]} rounded-xl border border-zinc-200 bg-white shadow-lg outline-none dark:border-zinc-800 dark:bg-zinc-900`}
        style={{ backgroundColor: 'var(--lokvis-surface, #ffffff)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
