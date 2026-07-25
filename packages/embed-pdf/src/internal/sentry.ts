/**
 * Sentry captureException 占位实现(@lokvis/embed-pdf 内部副本)。
 *
 * 包不依赖具体监控实现;三方接入时可替换 ErrorBoundary 内的 captureException,
 * 或在应用层用 Sentry SDK 初始化后,通过模块替换覆盖本函数。
 *
 * 默认行为:console.error。
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  console.error('[embed-pdf] captured exception:', error, context);
}
