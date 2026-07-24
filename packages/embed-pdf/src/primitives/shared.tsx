/**
 * Layer 1 共享工具(@lokvis/embed-pdf 内部)。
 */
import { createElement, type ReactNode } from 'react';

/** 检查文件是否为 PDF */
export function fileMatchesPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/** 默认预设按钮(无样式,仅提供 role/aria) */
export function DefaultPresetButton(props: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children?: ReactNode;
  label?: string;
}) {
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
