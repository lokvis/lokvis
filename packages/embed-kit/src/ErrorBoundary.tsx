/**
 * ErrorBoundary 工厂(@lokvis/embed-kit 共享)。
 *
 * 各 embed 包的 ErrorBoundary 逻辑一致,仅以下三处不同:
 *   1. CSS 变量命名空间前缀(--lokvis / --lokvis-pdf / --lokvis-video)
 *   2. i18n Context(QuickI18nContext / PdfI18nContext / VideoI18nContext)
 *   3. 翻译覆盖类型(EmbedTranslations / EmbedPdfTranslations / EmbedVideoTranslations)
 *
 * 本工厂参数化这些差异,各包用 createEmbedErrorBoundary(deps) 生成后以原有
 * 导出名 ErrorBoundary 再导出。Props(children / locale / translations / fallback)
 * 在三个包中完全一致,故公开 API 不变。
 *
 * 重试计数采用实例字段累积(跨 error cycle 不被 getDerivedStateFromError 重置),
 * 保证 MAX_RETRY 达到后正确隐藏重试按钮 —— 统一为唯一正确实现。
 */
import {
  Component,
  type Context,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';

/** i18n Context 值的最小结构约束 */
interface EmbedI18nCtxShape {
  locale?: string;
  translations?: unknown;
}

/** ErrorBoundary 公开 Props(三个 embed 包一致) */
export interface EmbedErrorBoundaryProps<TTranslations, TLang extends string> {
  children: ReactNode;
  /** 显式 locale 覆盖(优先级高于 Provider / URL 检测) */
  locale?: TLang;
  /** 翻译覆盖(可选,优先于 Provider.translations) */
  translations?: TTranslations;
  /** 自定义 fallback,未提供时用默认错误提示 */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

/** createEmbedErrorBoundary 依赖项 */
export interface EmbedErrorBoundaryDeps<
  TCtx extends EmbedI18nCtxShape & { locale?: TLang },
  TLang extends string,
> {
  /** CSS 变量命名空间前缀,如 '--lokvis' / '--lokvis-pdf' / '--lokvis-video' */
  cssPrefix: string;
  /** i18n React Context(类组件通过 static contextType 读取) */
  i18nContext: Context<TCtx | null>;
  /** 翻译函数 */
  t: (lang: TLang, key: string, overrides?: TCtx['translations']) => string;
  /** 从 URL 解析语言(回退链末端) */
  getLangFromUrl: (url: string) => TLang;
  /** captureException(默认 console.error;三方可注入 Sentry) */
  captureException: (error: unknown, context?: Record<string, unknown>) => void;
}

interface State {
  error: Error | null;
  /** 重试次数(防止用户反复点重试导致同一错误重复上报) */
  retryCount: number;
}

/** 最大重试次数,超过后隐藏重试按钮 */
const MAX_RETRY = 3;

/** 受支持的语言代码集(与各包 useLang SUPPORTED_HTML_LANGS 一致) */
const SUPPORTED_HTML_LANGS: ReadonlySet<string> = new Set(['en', 'zh', 'ja', 'es', 'de', 'fr']);

/**
 * 生成参数化的 ErrorBoundary 类组件。
 */
export function createEmbedErrorBoundary<
  TCtx extends EmbedI18nCtxShape & { locale?: TLang },
  TLang extends string,
>(
  deps: EmbedErrorBoundaryDeps<TCtx, TLang>
): ComponentType<EmbedErrorBoundaryProps<TCtx['translations'], TLang>> {
  const { cssPrefix, i18nContext, t, getLangFromUrl, captureException } = deps;

  /** 从 document.documentElement.lang 检测语言,不支持时返回 undefined(回退到 URL) */
  function detectHtmlLang(): TLang | undefined {
    if (typeof document === 'undefined') return undefined;
    const htmlLang = document.documentElement.lang;
    if (htmlLang && SUPPORTED_HTML_LANGS.has(htmlLang)) {
      return htmlLang as TLang;
    }
    return undefined;
  }

  type Props = EmbedErrorBoundaryProps<TCtx['translations'], TLang>;

  class EmbedErrorBoundary extends Component<Props, State> {
    // 类组件读取 i18n Provider(优先级低于 locale / translations prop)
    static contextType = i18nContext;
    declare context: TCtx | null;

    state: State = { error: null, retryCount: 0 };

    /** 实例级重试计数(跨 error cycle 累积,不被 getDerivedStateFromError 重置) */
    private _retryCount = 0;

    static getDerivedStateFromError(error: Error): Partial<State> {
      return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
      this._retryCount += 1;
      // 硬编码 'ErrorBoundary' 字符串,避免 minify 后 constructor.name 被混淆
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
        //   2. i18n Provider.locale(context)
        //   3. document.documentElement.lang 检测
        //   4. URL 路径前缀解析(回退)
        const ctx = this.context;
        const lang: TLang =
          this.props.locale ??
          ctx?.locale ??
          detectHtmlLang() ??
          getLangFromUrl(typeof window !== 'undefined' ? window.location.href : '/');
        const overrides = this.props.translations ?? ctx?.translations;
        const canRetry = this.state.retryCount < MAX_RETRY;
        return (
          <div
            className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center"
            style={{
              color: `var(${cssPrefix}-text, #18181b)`,
              fontFamily: `var(${cssPrefix}-font-family, inherit)`,
            }}
          >
            <div className="text-4xl">⚠️</div>
            <div className="text-base font-semibold">{t(lang, 'error.title', overrides)}</div>
            <div className="max-w-md text-xs" style={{ color: `var(${cssPrefix}-text-muted, #71717a)` }}>
              {t(lang, 'error.logged', overrides)}
              {canRetry ? t(lang, 'error.retryHint', overrides) : t(lang, 'error.retryExceeded', overrides)}
            </div>
            <pre
              className="max-w-md overflow-auto rounded p-3 text-left text-[11px]"
              style={{
                background: `var(${cssPrefix}-surface, #f4f4f5)`,
                color: `var(${cssPrefix}-text-muted, #71717a)`,
                borderRadius: `var(${cssPrefix}-radius, 0.5rem)`,
              }}
            >
              {this.state.error.message}
            </pre>
            {canRetry && (
              <button
                type="button"
                onClick={this.reset}
                className="px-4 py-2 text-xs font-medium text-white"
                style={{
                  background: `var(${cssPrefix}-primary, #6366f1)`,
                  borderRadius: `var(${cssPrefix}-radius, 0.5rem)`,
                }}
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

  return EmbedErrorBoundary;
}
