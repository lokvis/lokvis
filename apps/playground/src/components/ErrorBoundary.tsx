/**
 * ErrorBoundary(W12.3)
 *
 * 捕获 React 渲染期异常,上报到 Sentry,展示友好 fallback UI。
 * 适用于 client:only="react" 组件树。
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
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 上报到 Sentry(未初始化时退化为 console.error)
    captureException(error, {
      componentStack: info.componentStack ?? undefined,
      errorBoundary: this.constructor.name,
    });
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="text-4xl">⚠️</div>
          <div className="text-base font-semibold text-zinc-200">页面出错了</div>
          <div className="max-w-md text-xs text-zinc-500">
            已自动上报错误到 Sentry。刷新页面或点击下方按钮重试。
          </div>
          <pre className="max-w-md overflow-auto rounded bg-zinc-900 p-3 text-left text-[11px] text-zinc-400">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={this.reset}
            className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500"
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
