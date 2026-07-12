/// <reference types="vite/client" />
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
 * 全局 body overflow 锁计数器。
 *
 * 多个 Dialog 同时打开时,每个 Dialog 在 effect 里 +1,cleanup 时 -1。
 * 仅当计数归 0 时才还原 body.overflow,避免 A 关闭时误把还在打开的 B 的滚动锁解除。
 * 模块级单例,跨组件实例共享。
 */
let bodyOverflowLockCount = 0;
let bodyOverflowPrev = '';

// HMR 清理:开发时 Vite 重新执行本模块后,计数器归零但 body.overflow 可能仍是
// 'hidden'(旧模块实例的 effect cleanup 未跑),导致 body 永久锁死无法滚动。
// 在 HMR dispose 回调里重置全局状态,生产环境 import.meta.hot 不存在,回调不执行。
// 类型由 vite/client 提供(tsconfig.json types 已引入),无需手动 cast。
if (import.meta.hot) {
 import.meta.hot.dispose(() => {
 bodyOverflowLockCount = 0;
 bodyOverflowPrev = '';
 if (typeof document !== 'undefined') {
 document.body.style.overflow = '';
 }
 });
}

/**
 * Dialog - 模态对话框。
 *
 * 通过 portal 挂载到 document.body,避免父级 transform/overflow 影响。
 * ESC 关闭、点遮罩关闭、打开时聚焦对话框、锁定 body 滚动、focus trap 限制 Tab。
 * 无障碍:role="dialog" + aria-modal,标题作为 aria-label。
 *
 * SSR 环境下 document 不存在时安全降级(返回 null)。
 *
 * 实现说明:
 * - `onClose` 用 ref 缓存,effect 依赖仅 `[open]`,避免父组件传新闭包导致反复 cleanup/setup
 * 造成 body.overflow 闪烁与 listener 抖动。
 * - body overflow 用全局计数器管理,支持多 Dialog 嵌套。
 * - focus trap 在 Tab/Shift+Tab 到边界时把焦点 wrap 回对话框内首个/末个可聚焦元素。
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
 // 缓存最新的 onClose,effect 内通过 ref 读取,避免把 onClose 放进依赖数组
 const onCloseRef = React.useRef(onClose);
 onCloseRef.current = onClose;

 React.useEffect(() => {
 if (!open) return;

 const onKey = (e: KeyboardEvent) => {
 if (e.key === 'Escape') {
 e.stopPropagation();
 onCloseRef.current();
 return;
 }
 // focus trap:Tab / Shift+Tab 在对话框内循环,不跳出 modal
 if (e.key === 'Tab') {
 const root = dialogRef.current;
 if (!root) return;
 const focusable = root.querySelectorAll<HTMLElement>(
 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
 );
 if (focusable.length === 0) {
 // 无可聚焦元素时,Tab 把焦点留在 dialog 容器本身
 e.preventDefault();
 root.focus();
 return;
 }
 const first = focusable[0]!;
 const last = focusable[focusable.length - 1]!;
 const active = document.activeElement;
 if (e.shiftKey && active === first) {
 e.preventDefault();
 last.focus();
 } else if (!e.shiftKey && active === last) {
 e.preventDefault();
 first.focus();
 }
 }
 };
 // 监听 keydown 用 capture 在 document 上,确保先于其他 listener
 document.addEventListener('keydown', onKey, true);

 // 聚焦对话框内首个可聚焦元素(无则聚焦容器)
 const root = dialogRef.current;
 if (root) {
 const firstFocusable = root.querySelector<HTMLElement>(
 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
 );
 (firstFocusable ?? root).focus();
 }

 // 锁定 body 滚动(计数器管理,支持多 Dialog 嵌套)
 if (bodyOverflowLockCount === 0) {
 bodyOverflowPrev = document.body.style.overflow;
 }
 bodyOverflowLockCount += 1;
 document.body.style.overflow = 'hidden';

 return () => {
 document.removeEventListener('keydown', onKey, true);
 bodyOverflowLockCount = Math.max(0, bodyOverflowLockCount - 1);
 if (bodyOverflowLockCount === 0) {
 document.body.style.overflow = bodyOverflowPrev;
 }
 };
 }, [open]);

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
 className={`w-full ${sizeClass[size]} rounded-xl border border-[var(--lokvis-border)] bg-[var(--lokvis-surface-raised)] shadow-[var(--lokvis-elevation-3)] outline-none`}
 onClick={(e) => e.stopPropagation()}
 >
 {title && (
 <div className="flex items-center justify-between border-b border-[var(--lokvis-border)] px-5 py-4">
 <h2 className="text-base font-semibold text-[var(--lokvis-fg)]">{title}</h2>
 <button
 type="button"
 onClick={onClose}
 aria-label="Close"
 className="rounded-md p-1 text-[var(--lokvis-fg-subtle)] transition-colors hover:bg-[var(--lokvis-surface-muted)] hover:text-[var(--lokvis-fg-muted)]"
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
 <div className="flex justify-end gap-2 border-t border-[var(--lokvis-border)] px-5 py-4">
 {footer}
 </div>
 )}
 </div>
 </div>,
 document.body
 );
}
