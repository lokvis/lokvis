/**
 * DefaultPresetButton — embed-pdf / embed-video 共享的预设按钮原语。
 *
 * 无样式,仅提供 role/aria 语义。embed-image 使用更复杂的版本(含 className/style),
 * 不在此统一。
 */
import { createElement, type ReactNode } from 'react';

/** DefaultPresetButton props */
export interface DefaultPresetButtonProps {
  /** 是否选中 */
  active: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 点击回调 */
  onClick: () => void;
  /** 按钮内容 */
  children?: ReactNode;
  /** 无障碍标签 */
  label?: string;
}

/** 默认预设按钮(无样式,仅提供 role/aria) */
export function DefaultPresetButton(props: DefaultPresetButtonProps) {
  const { active, disabled, onClick, children, label } = props;
  return createElement(
    'button',
    {
      type: 'button',
      role: 'radio',
      'aria-checked': active,
      'aria-disabled': disabled || undefined,
      'aria-label': label,
      disabled,
      onClick,
    },
    children
  );
}
