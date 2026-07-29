/**
 * captureException 工厂(@lokvis/embed-kit 共享)。
 *
 * 各 embed 包不依赖具体监控实现;三方接入时可替换 ErrorBoundary 内的 captureException,
 * 或在应用层用 Sentry SDK 初始化后,通过模块替换覆盖本函数。
 *
 * 默认行为:console.error,带包标签前缀。
 */

/** captureException 函数签名(与 apps/playground/src/toolkit/sentry.ts 一致) */
export type CaptureException = (
  error: unknown,
  context?: Record<string, unknown>
) => void;

/**
 * 创建带包标签的 captureException 占位实现。
 *
 * @param label 日志前缀,如 'embed-pdf' → `[embed-pdf] captured exception:`
 */
export function createCaptureException(label: string): CaptureException {
  return (error, context) => {
    console.error(`[${label}] captured exception:`, error, context);
  };
}
