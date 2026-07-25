/**
 * ErrorBoundary(@lokvis/embed-pdf 内部副本)。
 *
 * 捕获 React 渲染期异常,记录到 console.error(或三方注入的 captureException),
 * 展示友好 fallback UI。适用于 client:only="react" 组件树。
 *
 * - 重试可致重复上报 → 加重试计数,超 3 次后隐藏重试按钮
 * - fallback 文案"已自动上报"误导 → 改为"错误已记录"
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureException } from './internal/sentry';
import { getLangFromUrl, t } from './i18n/utils';
import type { Language } from './i18n/config';
import {
  PdfI18nContext,
  type PdfI18nContextValue,
  type EmbedPdfTranslations,
} from './i18n/EmbedPdfI18nProvider';

interface Props {
  children: ReactNode;
  /** 显式 locale 覆盖(优先级高于 Provider / URL 检测) */
  locale?: Language;
  /** 翻译覆盖(可选,优先于 Provider.translations) */
  translations?: EmbedPdfTranslations;
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

/** 受支持的语言代码集(与 useLang.ts SUPPORTED_HTML_LANGS 一致) */
const SUPPORTED_HTML_LANGS: ReadonlySet<string> = new Set(['en', 'zh', 'ja', 'es', 'de', 'fr']);

/** 从 document.documentElement.lang 检测语言,不支持时返回 undefined(回退到 URL) */
function detectHtmlLang(): Language | undefined {
  if (typeof document === 'undefined') return undefined;
  const htmlLang = document.documentElement.lang;
  if (htmlLang && SUPPORTED_HTML_LANGS.has(htmlLang)) {
    return htmlLang as Language;
  }
  return undefined;
}

export class ErrorBoundary extends Component<Props, State> {
  // 类组件读取 EmbedPdfI18nProvider(优先级低于 locale / translations prop)
  static contextType = PdfI18nContext;
  declare context: PdfI18nContextValue | null;

  state: State = { error: null, retryCount: 0 };

  /** 实例级重试计数(跨 error cycle 累积,不被 getDerivedStateFromError 重置) */
  private _retryCount = 0;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this._retryCount += 1;
    captureException(error, {
      componentStack: info.componentStack ?? undefined,
      errorBoundary: 'ErrorBoundary',
      retryCount: this._retryCount,
    });
    this.setState({ retryCount: this._retryCount });
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
      //   2. EmbedPdfI18nProvider.locale(context)
      //   3. document.documentElement.lang 检测
      //   4. URL 路径前缀解析(回退)
      const ctx = this.context;
      const lang = this.props.locale
        ?? ctx?.locale
        ?? detectHtmlLang()
        ?? getLangFromUrl(typeof window !== 'undefined' ? window.location.href : '/');
      const overrides = this.props.translations ?? ctx?.translations;
      const canRetry = this.state.retryCount < MAX_RETRY;
      return (
        <div
          className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center"
          style={{ color: 'var(--lokvis-pdf-text, #18181b)', fontFamily: 'var(--lokvis-pdf-font-family, inherit)' }}
        >
          <div className="text-4xl">⚠️</div>
          <div className="text-base font-semibold">
            {t(lang, 'error.title', overrides)}
          </div>
          <div className="max-w-md text-xs" style={{ color: 'var(--lokvis-pdf-text-muted, #71717a)' }}>
            {t(lang, 'error.logged', overrides)}{canRetry ? t(lang, 'error.retryHint', overrides) : t(lang, 'error.retryExceeded', overrides)}
          </div>
          <pre
            className="max-w-md overflow-auto rounded p-3 text-left text-[11px]"
            style={{ background: 'var(--lokvis-pdf-surface, #f4f4f5)', color: 'var(--lokvis-pdf-text-muted, #71717a)', borderRadius: 'var(--lokvis-pdf-radius, 0.5rem)' }}
          >
            {this.state.error.message}
          </pre>
          {canRetry && (
            <button
              type="button"
              onClick={this.reset}
              className="px-4 py-2 text-xs font-medium text-white"
              style={{ background: 'var(--lokvis-pdf-primary, #6366f1)', borderRadius: 'var(--lokvis-pdf-radius, 0.5rem)' }}
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
