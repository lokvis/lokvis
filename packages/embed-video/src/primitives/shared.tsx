/**
 * Layer 1 共享工具(@lokvis/embed-video 内部)。
 */
import { createElement, type ReactNode } from 'react';

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'];
const VIDEO_MIME_PREFIX = 'video/';

/** 检查文件是否为视频 */
export function fileMatchesVideo(file: File): boolean {
  if (file.type.startsWith(VIDEO_MIME_PREFIX)) return true;
  const name = file.name.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => name.endsWith(ext));
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
