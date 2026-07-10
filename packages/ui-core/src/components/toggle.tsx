import * as React from 'react';

export interface ToggleProps {
 /** 是否开启(受控) */
 checked?: boolean;
 /** 默认是否开启(非受控) */
 defaultChecked?: boolean;
 /** 状态变更回调 */
 onChange?: (checked: boolean) => void;
 /** 禁用 */
 disabled?: boolean;
 /** 尺寸 */
 size?: 'sm' | 'md';
 /** 旁边的标签文字(可点) */
 label?: string;
 /** 无障碍描述 */
 'aria-label'?: string;
 className?: string;
}

const sizeMap = {
 sm: { track: 'h-4 w-7', thumb: 'h-3 w-3', translate: 'translate-x-3' },
 md: { track: 'h-5 w-9', thumb: 'h-4 w-4', translate: 'translate-x-4' },
} as const;

/**
 * Toggle - 开关。
 *
 * 受控 / 非受控双模式。点击轨道或 label 切换。键盘聚焦后 Space/Enter 切换。
 */
export function Toggle({
 checked,
 defaultChecked = false,
 onChange,
 disabled = false,
 size = 'md',
 label,
 'aria-label': ariaLabel,
 className = '',
}: ToggleProps) {
 const [internal, setInternal] = React.useState(defaultChecked);
 const isControlled = checked !== undefined;
 const isOn = isControlled ? checked : internal;

 const toggle = React.useCallback(() => {
 if (disabled) return;
 const next = !isOn;
 if (!isControlled) setInternal(next);
 onChange?.(next);
 }, [disabled, isOn, isControlled, onChange]);

 const s = sizeMap[size];

 return (
 <label
 className={`inline-flex items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${className}`}
 >
 <button
 type="button"
 role="switch"
 aria-checked={isOn}
 aria-label={ariaLabel ?? label}
 disabled={disabled}
 onClick={toggle}
 className={`relative inline-flex flex-shrink-0 items-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lokvis-primary)] focus-visible:ring-offset-1 ${s.track} ${
 isOn ? 'bg-[var(--lokvis-primary)]' : 'bg-[var(--lokvis-border)]'
 }`}
 >
 <span
 className={`inline-block transform rounded-full bg-[var(--lokvis-primary-fg)] shadow-sm transition-transform duration-150 ${s.thumb} ${
 isOn ? s.translate : 'translate-x-0.5'
 }`}
 />
 </button>
 {label && (
 <span className="text-sm text-[var(--lokvis-fg-muted)]">{label}</span>
 )}
 </label>
 );
}
