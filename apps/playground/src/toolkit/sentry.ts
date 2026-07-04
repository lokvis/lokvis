/**
 * Sentry 监控接入(W12.3)
 *
 * 设计原则(local-first 与隐私优先):
 * 1. **DSN 通过环境变量注入**:`PUBLIC_SENTRY_DSN` 在构建期由 Astro `import.meta.env` 读取,
 *    未配置时整个模块退化为 no-op,本地开发与自托管用户不会上报。
 * 2. **只上报错误与性能指标,绝不上报文件内容**:Lokvis 是 local-first 工具,用户文件
 *    永远不上传。Sentry 的 `beforeSend` 钩子主动剔除任何可能含文件名的 breadcrumb。
 * 3. **遵循浏览器扩展 / Do-Not-Track**:`navigator.doNotTrack` 检测,用户拒绝跟踪时不上报。
 * 4. **采样率可配**:Alpha 阶段 tracesSampleRate=0.1(10%),避免额度耗尽。
 *
 * 集成位置:
 * - 在 BaseLayout.astro 的 <head> 末尾通过 <script> 调用 initSentry()(在 React 之前)
 * - React 组件内的运行时错误由 ErrorBoundary 捕获后调用 captureException()
 *
 * 注:Sentry SDK 走 ES dynamic import 懒加载,避免 ~80KB 进首屏。
 */
import type { SeverityLevel } from './sentry-types.js';
import type * as SentryBrowser from '@sentry/browser';

/** Sentry DSN,未配置则为空字符串,模块退化为 no-op */
const SENTRY_DSN = import.meta.env.PUBLIC_SENTRY_DSN ?? '';
/** Sentry release 版本号,与 package.json 对齐 */
const SENTRY_RELEASE = import.meta.env.PUBLIC_SENTRY_RELEASE ?? 'playground@0.1.0';
/** 性能采样率,Alpha 阶段 10% */
const TRACES_SAMPLE_RATE = 0.1;

/** 是否已初始化(避免重复 init) */
let initialized = false;
/** 懒加载的 Sentry SDK 实例(仅在 DSN 配置时加载) */
let sentrySdk: typeof SentryBrowser | null = null;

/**
 * 检查是否应启用 Sentry
 *
 * 用户拒绝跟踪(DNT=1)或未配置 DSN 时返回 false。
 */
export function shouldEnableSentry(): boolean {
  if (!SENTRY_DSN) return false;
  if (typeof navigator !== 'undefined' && navigator.doNotTrack === '1') return false;
  if (typeof window !== 'undefined' && (window as unknown as { doNotTrack?: string }).doNotTrack === '1') {
    return false;
  }
  return true;
}

/**
 * 初始化 Sentry
 *
 * 在 playground <head> 末尾调用,DSN 未配置时为 no-op。
 * 使用 ES dynamic import 懒加载 @sentry/browser(~80KB),不进首屏 bundle。
 *
 * @example
 * ```astro
 * <script>
 *   import { initSentry } from '../toolkit/sentry';
 *   initSentry();
 * </script>
 * ```
 */
export async function initSentry(): Promise<void> {
  if (initialized) return;
  if (!shouldEnableSentry()) return;
  if (typeof window === 'undefined') return; // SSR 安全

  try {
    // ES dynamic import 懒加载,避免 ~80KB 进首屏
    const Sentry = await import('@sentry/browser');
    sentrySdk = Sentry;
    Sentry.init({
      dsn: SENTRY_DSN,
      release: SENTRY_RELEASE,
      environment: import.meta.env.PROD ? 'production' : 'development',
      tracesSampleRate: TRACES_SAMPLE_RATE,
      // 隐私保护:主动剔除可能含文件名的 breadcrumb
      beforeBreadcrumb(breadcrumb) {
        if (breadcrumb.category === 'ui.click' || breadcrumb.category === 'ui.input') {
          // 用户输入可能含文件名,只保留 category,移除 message/data
          return { ...breadcrumb, message: '[redacted]' };
        }
        return breadcrumb;
      },
      // 默认不上报 request body(GET URL 可能含 ?workflow=<base64> 分享链接,允许但截断超长)
      beforeSend(event) {
        const url = event.request?.url;
        if (url && url.length > 200) {
          event.request = { ...event.request, url: url.slice(0, 200) + '...' };
        }
        return event;
      },
    });
    initialized = true;
  } catch (err) {
    // Sentry 加载失败不应阻塞 playground,只 warn
    console.warn('[sentry] init failed, playground will continue without monitoring:', err);
  }
}

/**
 * 手动捕获异常
 *
 * 在 React ErrorBoundary 或 try/catch 中调用。
 * Sentry 未初始化时退化为 console.error,确保 API 一致。
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (sentrySdk && initialized) {
    sentrySdk.captureException(error, { extra: context });
  } else {
    console.error('[sentry-disabled] captured exception:', error, context);
  }
}

/**
 * 捕获消息(用于非错误级别的上报,如降级触发)
 */
export function captureMessage(message: string, level: SeverityLevel = 'info'): void {
  if (sentrySdk && initialized) {
    sentrySdk.captureMessage(message, level);
  } else if (level === 'error' || level === 'fatal') {
    console.error('[sentry-disabled]', message);
  }
}

/**
 * 设置用户标识(匿名)
 *
 * 不收集任何 PII,只用随机 ID 关联同一会话的多个事件。
 */
export function setAnonymousUser(userId: string): void {
  if (sentrySdk && initialized) {
    sentrySdk.setUser({ id: userId, username: 'anonymous' });
  }
}

/** 测试用:重置模块状态(仅 __tests__ 调用) */
export function _resetSentryForTesting(): void {
  initialized = false;
  sentrySdk = null;
}
