/**
 * Quick Action 模块入口。
 *
 * 三层架构(见 docs/reports/20260719-image-workspace-ui-design.md):
 *   - Layer 0:Headless Hook(useQuickCompress,纯逻辑,无 UI)
 *   - Layer 1:Unstyled Primitives(QuickCompress,无样式,有行为)
 *   - Layer 2:Default UI(ImageQuickCompress,Tailwind 默认样式)
 *
 * 三方接入路径(按自由度递增):
 *   1. 零配置:      <ImageQuickCompress />
 *   2. 主题定制:    <ImageQuickCompress theme={{...}} />
 *   3. CSS 变量:    覆盖 .lokvis-quick-compress { --lokvis-* }
 *   4. 组件替换:    <ImageQuickCompress components={{...}} />
 *   5. 原语组装:    <QuickCompress.Root>...</QuickCompress.Root>
 *   6. 完全自定义:  useQuickCompress() hook
 */

// Layer 0:Hook
export {
  useQuickCompress,
  COMPRESS_PRESETS,
  type CompressPreset,
  type UseQuickCompressResult,
  type UseQuickActionOptions,
  type QuickActionResult,
} from './useQuickCompress';

// Layer 1:Primitives
export { QuickCompress } from './primitives/QuickCompress';
export type {
  QuickCompressRootProps,
  QuickCompressUploadProps,
  QuickCompressPresetSwitcherProps,
  QuickCompressPreviewProps,
  QuickCompressRatioBadgeProps,
  QuickCompressDownloadButtonProps,
  QuickCompressErrorDisplayProps,
  QuickCompressResetButtonProps,
} from './primitives/QuickCompress';

// Layer 2:Default UI
export { default as ImageQuickCompress } from './ImageQuickCompress';
export type {
  ImageQuickCompressProps,
  QuickCompressComponents,
  UploadBoxProps,
  PreviewBoxProps,
  PresetSwitcherProps,
  DownloadButtonProps,
  RatioBadgeProps,
  ErrorDisplayProps,
  ResetButtonProps,
} from './ImageQuickCompress';

// Theme
export { themeToCssVars, type QuickTheme } from './theme';
