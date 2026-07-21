/**
 * Layer 1 primitives 共享工具(避免 6 个 QuickXxx 文件复制粘贴)。
 *
 * - fileMatchesAccept:Upload 原语统一用的 accept 校验
 * - guessExtension:DownloadButton 原语统一用的扩展名推断
 * - DefaultPresetButton:PresetSwitcher 默认渲染的按钮(支持 label prop 用于 i18n)
 */
import type { CSSProperties, ReactNode } from 'react';

/** 校验文件是否符合 <input accept> 语法(MIME 或 .ext,支持逗号分隔) */
export function fileMatchesAccept(file: File, accept: string): boolean {
  if (!accept) return true;
  const patterns = accept.split(',').map((p) => p.trim().toLowerCase());
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return patterns.some((p) => {
    if (p.endsWith('/*')) return mime.startsWith(p.slice(0, -1));
    if (p.startsWith('.')) return name.endsWith(p);
    return mime === p;
  });
}

/** 根据 Blob.type 推断文件扩展名(供下载文件名使用) */
export function guessExtension(blob: Blob): string {
  switch (blob.type) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/avif':
      return 'avif';
    case 'image/gif':
      return 'gif';
    default:
      return 'img';
  }
}

export interface DefaultPresetButtonProps {
  /** 预设 key(用作 React key + 默认 label) */
  preset: string;
  /** 是否选中 */
  isSelected: boolean;
  /** 点击回调 */
  onClick: () => void;
  /** 是否禁用 */
  disabled: boolean;
  /**
   * 按钮显示文案(默认为 preset key)。
   * Layer 2 默认 UI 应通过 PresetSwitcher 的 renderButton 注入翻译后的 label;
   * 此 prop 提供 fallback,让 Layer 1 单独使用时也能避免渲染原始 key。
   */
  label?: ReactNode;
  /** 自定义 className */
  className?: string;
  /** 自定义 style */
  style?: CSSProperties;
}

/**
 * PresetSwitcher 的默认按钮渲染(零样式,仅 fontWeight 区分选中态)。
 *
 * Layer 1 primitives 是"无样式"契约,但渲染未本地化的原始 preset key
 * (如 'small-br' / 'ig-square' / 'ecommerce')会破坏 i18n 体系。
 * Layer 2 默认 UI 通过 `renderButton` 替换整个按钮以注入翻译;
 * 单独使用 Layer 1 时可通过 `label` prop 提供文案。
 */
export function DefaultPresetButton({
  preset,
  isSelected,
  onClick,
  disabled,
  label,
  className,
  style,
}: DefaultPresetButtonProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      disabled={disabled}
      onClick={onClick}
      className={className}
      style={{ fontWeight: isSelected ? 600 : 400, ...style }}
    >
      {label ?? preset}
    </button>
  );
}
