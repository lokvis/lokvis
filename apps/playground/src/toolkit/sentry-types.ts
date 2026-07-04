/**
 * Sentry 类型定义(W12.3)
 *
 * 直接 re-export @sentry/browser 的 SeverityLevel 类型,避免本地定义与 SDK 偏离。
 * (PR #14 Review 修复:原本地定义若 SDK 升级增删级别会静默偏离)
 */
export type SeverityLevel = import('@sentry/browser').SeverityLevel;
