import * as React from 'react';
import { Dialog } from './dialog.js';
import { Button } from './button.js';

export interface ConfirmDialogProps {
  /** 是否打开(受控) */
  open: boolean;
  /** 标题(默认"确认操作") */
  title?: string;
  /** 正文消息 */
  message: React.ReactNode;
  /** 确认按钮文本(默认"确定") */
  confirmText?: string;
  /** 取消按钮文本(默认"取消") */
  cancelText?: string;
  /** 确认按钮 variant(默认 primary;破坏性操作用 danger) */
  variant?: 'primary' | 'danger';
  /** 确认回调 */
  onConfirm: () => void;
  /** 关闭回调(点遮罩 / ESC / 取消按钮触发) */
  onClose: () => void;
}

/**
 * ConfirmDialog - 标准确认对话框。
 *
 * 替代 window.confirm:提供一致的视觉、无障碍(role=dialog/aria-modal)、
 * ESC/遮罩关闭、focus trap。基于 Dialog + Button 组合,不引入新依赖。
 */
export function ConfirmDialog({
  open,
  title = '确认操作',
  message,
  confirmText = '确定',
  cancelText = '取消',
  variant = 'primary',
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {cancelText}
          </Button>
          <Button variant={variant} size="sm" onClick={onConfirm}>
            {confirmText}
          </Button>
        </>
      }
    >
      <p className="text-sm text-[var(--lokvis-fg-muted)]">{message}</p>
    </Dialog>
  );
}
