/**
 * @lokvis/embed-kit — @lokvis/embed-* 包共享的参数化骨架原语。
 *
 * 各 embed 包(image / pdf / video)以工厂生成后再用原有导出名再导出,
 * 保持三方定制 API(CSS 变量命名空间 / i18n Context / 导出名)完全不变。
 */
export { createCaptureException, type CaptureException } from './sentry.js';
export {
  makeThemeSystem,
  type ThemeSystem,
  type EmbedThemeCore,
  type EmbedModeCore,
} from './theme.js';
export {
  createUseLokvisRuntime,
  type UseLokvisRuntime,
  type UseLokvisRuntimeResult,
} from './runtime.js';
export {
  makeSingleStepWorkflowBuilder,
  type BuildSingleStepWorkflow,
  type SingleStepWorkflowConfig,
  type EmbedAssetType,
} from './workflow.js';
export {
  createEmbedErrorBoundary,
  type EmbedErrorBoundaryProps,
  type EmbedErrorBoundaryDeps,
} from './ErrorBoundary.js';
export { downloadBlob } from './download.js';
