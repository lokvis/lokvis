import * as React from 'react';

export interface TooltipProps {
 /** 提示内容 */
 content: React.ReactNode;
 /** 触发方式(默认 hover) */
 trigger?: 'hover' | 'focus';
 /** 出现位置(默认 top) */
 side?: 'top' | 'bottom' | 'left' | 'right';
 /** 子元素(触发器) */
 children: React.ReactElement;
 /** 延迟(ms),默认 200 */
 delay?: number;
}

const sideClass = {
 top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
 bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
 left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
 right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
} as const;

/**
 * Tooltip - 悬浮提示。
 *
 * 包裹一个触发器元素,鼠标悬浮或键盘聚焦时显示提示气泡。
 * 纯 CSS 定位(absolute),不依赖 portal,适合简单场景。
 *
 * 无障碍:触发器自动获得 `aria-describedby` 指向提示内容。
 */
export function Tooltip({
 content,
 trigger = 'hover',
 side = 'top',
 children,
 delay = 200,
}: TooltipProps) {
 const [visible, setVisible] = React.useState(false);
 const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
 const tipId = React.useId();

 const show = React.useCallback(() => {
 if (timer.current) clearTimeout(timer.current);
 timer.current = setTimeout(() => setVisible(true), delay);
 }, [delay]);

 const hide = React.useCallback(() => {
 if (timer.current) clearTimeout(timer.current);
 setVisible(false);
 }, []);

 React.useEffect(() => {
 return () => {
 if (timer.current) clearTimeout(timer.current);
 };
 }, []);

 // 合并触发器原有的同名 handler,而非覆盖。
 // 用户期望"我的 onMouseEnter + tooltip 的 show 都执行",而非 tooltip 吃掉事件。
 const childProps = children.props as React.HTMLAttributes<HTMLElement>;
 const mergeHandler = <K extends keyof React.HTMLAttributes<HTMLElement>>(
 key: K,
 tooltipHandler: (e: never) => void
 ) => {
 const userHandler = childProps[key];
 if (typeof userHandler === 'function') {
 return (e: never) => {
 (userHandler as (e: never) => void)(e);
 tooltipHandler(e);
 };
 }
 return tooltipHandler;
 };

 const triggerProps: Record<string, unknown> = {};
 if (trigger === 'hover') {
 triggerProps.onMouseEnter = mergeHandler('onMouseEnter', show as (e: never) => void);
 triggerProps.onMouseLeave = mergeHandler('onMouseLeave', hide as (e: never) => void);
 triggerProps.onFocus = mergeHandler('onFocus', show as (e: never) => void);
 triggerProps.onBlur = mergeHandler('onBlur', hide as (e: never) => void);
 } else {
 triggerProps.onFocus = mergeHandler('onFocus', show as (e: never) => void);
 triggerProps.onBlur = mergeHandler('onBlur', hide as (e: never) => void);
 }
 triggerProps['aria-describedby'] = tipId;

 return (
 <span className="relative inline-flex">
 {React.cloneElement(children, triggerProps as React.HTMLAttributes<HTMLElement>)}
 {visible && (
 <span
 id={tipId}
 role="tooltip"
 className={`pointer-events-none absolute z-40 whitespace-nowrap rounded-md bg-[var(--lokvis-fg)] px-2 py-1 text-xs font-medium text-[var(--lokvis-bg)] shadow-md ${sideClass[side]}`}
 >
 {content}
 </span>
 )}
 </span>
 );
}
