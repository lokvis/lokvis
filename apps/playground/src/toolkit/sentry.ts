/**
 * Sentry 监控接入(W12.3,PR #14 Review 修复)
 *
 * 设计原则(local-first 与隐私优先):
 * 1. **DSN 通过环境变量注入**:`PUBLIC_SENTRY_DSN` 在 `initSentry()` 调用时读取
 *    (而非模块顶部 const 捕获,使测试可注入 DSN),未配置时退化为 no-op。
 * 2. **只上报错误与性能指标,绝不上报文件内容**:Lokvis 是 local-first 工具,用户文件
 *    永远不上传。Sentry 的 `beforeBreadcrumb` 钩子对 `ui.click`/`ui.input`/`ui.key`
 *    /`fetch`/`xhr`/`console` 等可能含文件名的类别同时 redact `message` 与 `data`。
 * 3. **遵循浏览器扩展 / Do-Not-Track / GPC**:检测 `navigator.doNotTrack` 与
 *    `navigator.globalPrivacyControl`,用户拒绝跟踪时不上报。
 * 4. **采样率可配**:Alpha 阶段 tracesSampleRate=0.1(10%),避免额度耗尽。
 * 5. **URL 脱敏**:`beforeSend` 剥离 `?workflow=<base64>` 等查询参数,只保留 origin+pathname。
 *
 * 集成位置:
 * - 在 BaseLayout.astro 的 <head> 末尾通过 <script> 调用 initSentry()(在 React 之前)
 * - React 组件内的运行时错误由 ErrorBoundary 捕获后调用 captureException()
 *
 * 注:Sentry SDK 走 ES dynamic import 懒加载,避免 ~80KB 进首屏。
 */
import type { SeverityLevel } from './sentry-types.js';
import type * as SentryBrowser from '@sentry/browser';

/** Sentry release 版本号,与 package.json 对齐 */
const SENTRY_RELEASE = import.meta.env.PUBLIC_SENTRY_RELEASE ?? 'playground@0.1.0';
/** 性能采样率,Alpha 阶段 10% */
const TRACES_SAMPLE_RATE = 0.1;

/** 是否已初始化(避免重复 init) */
let initialized = false;
/** 懒加载的 Sentry SDK 实例(仅在 DSN 配置时加载) */
let sentrySdk: typeof SentryBrowser | null = null;

/**
 * 读取 Sentry DSN(延迟读取,使测试可通过 vi.stubEnv 注入)。
 *
 * 实现注意:原 W12.3 实现在模块顶部 `const SENTRY_DSN = import.meta.env.PUBLIC_SENTRY_DSN ?? ''`
 * 捕获,导致测试无法注入 DSN(模块 import 时已固定为 ''),核心逻辑零覆盖。
 * 改为函数延迟读取后,测试可用 `vi.stubEnv('PUBLIC_SENTRY_DSN', 'https://...')` 注入。
 */
function getSentryDsn(): string {
  return import.meta.env.PUBLIC_SENTRY_DSN ?? '';
}

/**
 * 检查是否应启用 Sentry
 *
 * 用户拒绝跟踪(DNT=1 或 GPC=true)或未配置 DSN 时返回 false。
 */
export function shouldEnableSentry(): boolean {
  const dsn = getSentryDsn();
  if (!dsn) return false;
  if (typeof navigator !== 'undefined') {
    // DNT(老标准,IE/Firefox/Safari)
    if (navigator.doNotTrack === '1') return false;
    // GPC(新标准,Firefox/Safari/Edge 已支持,Chrome 待跟进)
    if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) {
      return false;
    }
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
      dsn: getSentryDsn(),
      release: SENTRY_RELEASE,
      environment: import.meta.env.PROD ? 'production' : 'development',
      tracesSampleRate: TRACES_SAMPLE_RATE,
      // 隐私保护:对可能含文件名的 breadcrumb 类别同时 redact message + data
      // (W12.3 原实现仅 redact message,data 字段仍可能泄露 UI 点击目标)
      beforeBreadcrumb(breadcrumb) {
        const sensitiveCategories = new Set([
          'ui.click',
          'ui.input',
          'ui.key',
          'fetch',
          'xhr',
          'console',
        ]);
        if (sensitiveCategories.has(breadcrumb.category ?? '')) {
          return { ...breadcrumb, message: '[redacted]', data: undefined };
        }
        return breadcrumb;
      },
      // 默认不上报 request body;剥离 URL 查询参数防止 ?workflow=<base64> 泄露
      // (W12.3 原实现仅截断到 200 字符,前 200 字符仍泄露 workflow 开头)
      beforeSend(event) {
        if (event.request?.url) {
          try {
            const u = new URL(event.request.url);
            // 仅保留 origin + pathname,丢弃 hash 与 query(可能含 base64 workflow)
            const safeUrl = `${u.origin}${u.pathname}`;
            event.request = { ...event.request, url: safeUrl };
          } catch {
            // URL 解析失败(非标准 URL),整段 redact
            event.request = { ...event.request, url: '[redacted-url]' };
          }
        }
        return event;
      },
    });
    initialized = true;
  } catch (err) {
    // Sentry 加载失败不应阻塞 playground,只 warn(不上报到 Sentry 以免循环)
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
