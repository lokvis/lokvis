/**
 * ErrorBoundary(@lokvis/quick-image 内部副本)。
 *
 * 捕获 React 渲染期异常,记录到 console.error(或三方注入的 captureException),
 * 展示友好 fallback UI。适用于 client:only="react" 组件树。
 *
 * 与 apps/playground/src/components/ErrorBoundary.tsx 保持一致;
 * 包内独立维护避免与 playground 相互耦合。
 *
 * Review 修复(继承自原 playground ErrorBoundary):
 * - `this.constructor.name` 在生产构建被混淆 → 硬编码字符串 'ErrorBoundary'
 * - 重试可致重复上报 → 加重试计数,超 3 次后隐藏重试按钮
 * - fallback 文案"已自动上报"误导(DSN 未配置时未上报)→ 改为"错误已记录"
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureException } from './internal/sentry';
import { getLangFromUrl, t } from './i18n/utils';
import type { Language } from './i18n/config';
import {
  QuickI18nContext,
  type QuickI18nContextValue,
  type QuickTranslations,
} from './i18n/QuickI18nProvider';

interface Props {
  children: ReactNode;
  /** 显式 locale 覆盖(优先级高于 Provider / URL 检测) */
  locale?: Language;
  /** 翻译覆盖(可选,优先于 Provider.translations) */
  translations?: QuickTranslations;
  /** 自定义 fallback,未提供时用默认错误提示 */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
  /** 重试次数(防止用户反复点重试导致同一错误重复上报) */
  retryCount: number;
}

/** 最大重试次数,超过后隐藏重试按钮 */
const MAX_RETRY = 3;

export class ErrorBoundary extends Component<Props, State> {
  // 类组件读取 QuickI18nProvider(优先级低于 locale / translations prop)
  static contextType = QuickI18nContext;
  declare context: QuickI18nContextValue | null;

  state: State = { error: null, retryCount: 0 };

  static getDerivedStateFromError(error: Error): State {
    // 保留 retryCount(不重置),累加在 componentDidCatch
    return { error, retryCount: 0 };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 上报到 captureException(默认 console.error;三方可注入 Sentry)
    // 硬编码 'ErrorBoundary' 字符串,避免 minify 后 constructor.name 被混淆为单字母
    captureException(error, {
      componentStack: info.componentStack ?? undefined,
      errorBoundary: 'ErrorBoundary',
      retryCount: this.state.retryCount,
    });
    this.setState((prev) => ({ retryCount: prev.retryCount + 1 }));
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      // ErrorBoundary 是 class 组件,无法用 hook;优先级:
      //   1. locale prop(显式覆盖)
      //   2. QuickI18nProvider.locale(context)
      //   3. URL 路径前缀解析(回退)
      // translations 同理:prop 优先 → context.translations
      const ctx = this.context;
      const lang = this.props.locale
        ?? ctx?.locale
        ?? getLangFromUrl(typeof window !== 'undefined' ? window.location.href : '/');
      const overrides = this.props.translations ?? ctx?.translations;
      const canRetry = this.state.retryCount < MAX_RETRY;
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="text-4xl">⚠️</div>
          <div className="text-base font-semibold text-zinc-200">
            {t(lang, 'error.title', overrides)}
          </div>
          <div className="max-w-md text-xs text-zinc-500">
            {t(lang, 'error.logged', overrides)}{canRetry ? t(lang, 'error.retryHint', overrides) : t(lang, 'error.retryExceeded', overrides)}
          </div>
          <pre className="max-w-md overflow-auto rounded bg-zinc-900 p-3 text-left text-[11px] text-zinc-400">
            {this.state.error.message}
          </pre>
          {canRetry && (
            <button
              type="button"
              onClick={this.reset}
              className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500"
            >
              {t(lang, 'common.retry', overrides)}
            </button>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
