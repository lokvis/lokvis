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

  const triggerProps: Record<string, unknown> = {};
  if (trigger === 'hover') {
    triggerProps.onMouseEnter = show;
    triggerProps.onMouseLeave = hide;
    triggerProps.onFocus = show;
    triggerProps.onBlur = hide;
  } else {
    triggerProps.onFocus = show;
    triggerProps.onBlur = hide;
  }
  triggerProps['aria-describedby'] = tipId;

  return (
    <span className="relative inline-flex">
      {React.cloneElement(children, triggerProps as React.HTMLAttributes<HTMLElement>)}
      {visible && (
        <span
          id={tipId}
          role="tooltip"
          className={`pointer-events-none absolute z-40 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white shadow-md dark:bg-zinc-100 dark:text-zinc-900 ${sideClass[side]}`}
        >
          {content}
        </span>
      )}
    </span>
  );
}
