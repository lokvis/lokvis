/**
 * Sentry captureException 占位实现(@lokvis/quick-image 内部副本)。
 *
 * 包不依赖具体监控实现;三方接入时可替换 ErrorBoundary 内的 captureException,
 * 或在应用层用 Sentry SDK 初始化后,通过模块替换覆盖本函数。
 *
 * 默认行为:console.error,与 apps/playground/src/toolkit/sentry.ts 中
 * "未初始化时退化为 console.error" 保持一致。
 */

/**
 * 捕获异常(占位实现)。
 *
 * 与 apps/playground/src/toolkit/sentry.ts 中 captureException 签名保持一致,
 * 便于三方接入时直接替换。Sentry 未初始化时退化为 console.error。
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  console.error('[quick-image] captured exception:', error, context);
}
