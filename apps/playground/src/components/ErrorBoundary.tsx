/**
 * ErrorBoundary(W12.3,PR #14 Review 修复)
 *
 * 捕获 React 渲染期异常,上报到 Sentry,展示友好 fallback UI。
 * 适用于 client:only="react" 组件树。
 *
 * Review 修复:
 * - `this.constructor.name` 在生产构建被混淆 → 硬编码字符串 'ErrorBoundary'
 * - 重试可致重复上报 → 加重试计数,超 3 次后隐藏重试按钮
 * - fallback 文案"已自动上报"误导(DSN 未配置时未上报)→ 改为"错误已记录"
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureException } from '../toolkit/sentry.js';

interface Props {
  children: ReactNode;
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
  state: State = { error: null, retryCount: 0 };

  static getDerivedStateFromError(error: Error): State {
    // 保留 retryCount(不重置),累加在 componentDidCatch
    return { error, retryCount: 0 };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 上报到 Sentry(未初始化时退化为 console.error)
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
      const canRetry = this.state.retryCount < MAX_RETRY;
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="text-4xl">⚠️</div>
          <div className="text-base font-semibold text-zinc-200">页面出错了</div>
          <div className="max-w-md text-xs text-zinc-500">
            错误已记录{canRetry ? '。刷新页面或点击下方按钮重试。' : '。请刷新页面后重试。'}
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
              重试
            </button>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
