/**
 * Sentry 类型定义(W12.3)
 *
 * 仅声明我们用到的辅助类型,实际 SDK 类型直接来自 @sentry/browser。
 * SeverityLevel 与 @sentry/browser 的 SeverityLevel 兼容。
 */

/** Sentry 严重级别(与 @sentry/browser 的 SeverityLevel 兼容) */
export type SeverityLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug' | 'log';
