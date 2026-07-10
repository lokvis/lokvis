/**
 * ErrorBoundary - React 错误边界(D6)
 *
 * 捕获子组件树渲染期间的运行时异常,避免整个 Workspace 白屏。
 * 必须是 class 组件(React 错误边界 API 仅支持 class)。
 *
 * 设计:
 * - 默认 fallback 使用 lokvis token,与 Workspace 错误态视觉一致
 * - 可选 fallback 渲染 prop(消费方自定义 UI)
 * - 可选 onError 回调(上报等);默认 console.error,不引入 sentry 等
 *   app 层依赖,保持 ui-react 包架构纯净(不反向依赖消费方)
 * - reset() 清空 error 状态,尝试重新渲染子树
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <Workspace plugins={[...]} />
 * </ErrorBoundary>
 * ```
 */

import * as React from 'react';

export interface ErrorBoundaryProps {
 children: React.ReactNode;
 /** 自定义 fallback;不传则用默认 UI */
 fallback?: (error: Error, reset: () => void) => React.ReactNode;
 /** 错误回调(上报等),不传则 console.error */
 onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface State {
 error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, State> {
 state: State = { error: null };

 static getDerivedStateFromError(error: Error): State {
 return { error };
 }

 componentDidCatch(error: Error, info: React.ErrorInfo) {
 if (this.props.onError) {
 this.props.onError(error, info);
 } else {
 console.error('[lokvis ErrorBoundary]', error, info.componentStack);
 }
 }

 reset = () => {
 this.setState({ error: null });
 };

 render() {
 if (this.state.error) {
 if (this.props.fallback) {
 return this.props.fallback(this.state.error, this.reset);
 }
 return <DefaultFallback error={this.state.error} onReset={this.reset} />;
 }
 return this.props.children;
 }
}

function DefaultFallback({ error, onReset }: { error: Error; onReset: () => void }) {
 return (
 <div className="flex h-full w-full items-center justify-center p-6" role="alert">
 <div className="max-w-md rounded-xl border border-[var(--lokvis-danger)]/30 bg-[var(--lokvis-surface)] p-6 text-center shadow-[var(--lokvis-elevation-2)]">
 <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--lokvis-danger)]/15">
 <svg
 width="20"
 height="20"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 className="text-[var(--lokvis-danger)]"
 >
 <circle cx="12" cy="12" r="10" />
 <line x1="12" y1="8" x2="12" y2="12" />
 <line x1="12" y1="16" x2="12.01" y2="16" />
 </svg>
 </div>
 <p className="font-semibold text-[var(--lokvis-fg)]">Something went wrong</p>
 <p className="mt-1.5 break-words text-sm text-[var(--lokvis-fg-muted)]">
 {error.message || 'An unexpected error occurred while rendering this panel.'}
 </p>
 <button
 type="button"
 onClick={onReset}
 className="mt-4 inline-flex items-center justify-center rounded-lg bg-[var(--lokvis-primary)] px-4 py-2 text-sm font-medium text-[var(--lokvis-primary-fg)] transition-colors hover:bg-[var(--lokvis-primary-hover)]"
 >
 Try again
 </button>
 </div>
 </div>
 );
}
