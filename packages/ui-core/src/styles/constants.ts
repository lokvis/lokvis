/**
 * 共享交互态样式常量。
 *
 * 组件内部引用这些常量以保持 focus / disabled 样式全局统一,
 * 避免每个组件手写不同风格的 ring / opacity。
 */

/** 全局统一 focus-visible 环:2px 半透明 primary + 1px offset */
export const FOCUS_RING =
 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lokvis-primary)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--lokvis-bg)]';

/** 全局统一 disabled 态 */
export const DISABLED_STYLE =
 'disabled:cursor-not-allowed disabled:opacity-50';
