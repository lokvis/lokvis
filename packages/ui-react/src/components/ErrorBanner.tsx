/**
 * ErrorBanner - 错误信息横幅(W11.3)
 *
 * 当 store.error 非空时显示,展示错误信息并提供:
 * - 关闭按钮(清除 error)
 * - 重试按钮(重新执行工作流)
 *
 * 节点失败高亮由 WorkflowEditor 的节点状态颜色处理(已实现);
 * 本组件负责全局错误信息的可见性。
 *
 * 显式错误计数器作为可见性派生依据:
 * store.error 是字符串,相同错误多次设置时引用不变,useEffect 依赖 [error] 不会触发。
 * 改为依赖 errorSeq(error 出现的序号),每次 setError(非 null)都递增,确保 banner 重新弹出。
 *
 * @module ErrorBanner
 */

import * as React from 'react';
import { Icon } from '@lokvis/ui-core';
import { useWorkspaceStore } from '../store/index.js';
import { useWorkspaceLang } from '../i18n/useWorkspaceLang.js';
import { formatMessage, useWorkspaceTranslations } from '../i18n/utils.js';

export interface ErrorBannerProps {
 className?: string;
}

export function ErrorBanner({ className = '' }: ErrorBannerProps) {
 const error = useWorkspaceStore((s) => s.error);
 const errorSeq = useWorkspaceStore((s) => s.errorSeq);
 const setError = useWorkspaceStore((s) => s.setError);
 const run = useWorkspaceStore((s) => s.run);
 const nodes = useWorkspaceStore((s) => s.nodes);
 const running = useWorkspaceStore((s) => s.running);
 const lang = useWorkspaceLang();
 const t = useWorkspaceTranslations(lang);

 // 用户关闭后隐藏;新错误(errorSeq 变化)时重新显示。
 // 用 errorSeq 而非 error 字符串本身:store.run() 在 setError(null) 之后才设新 error,
 // errorSeq 在 setError(非 null) 时递增,即使错误消息相同也能感知到"新的错误事件"。
 const [dismissedSeq, setDismissedSeq] = React.useState<number | null>(null);

 const visible = error !== null && dismissedSeq !== errorSeq;

 const handleDismiss = React.useCallback(() => {
 setDismissedSeq(errorSeq);
 setError(null);
 }, [errorSeq, setError]);

 const handleRetry = React.useCallback(() => {
 // 先清 error 再 run,避免 run 同步抛错时 banner 已隐藏且 errorSeq 未变化
 setError(null);
 void run();
 }, [setError, run]);

 if (!visible || !error) return null;

 const canRetry = nodes.length > 0 && !running;

 return (
 <div
 className={`flex items-start gap-2 border-b border-[var(--lokvis-danger)]/30 bg-[var(--lokvis-danger)]/10 px-3 py-2 ${className}`}
 role="alert"
 >
 <Icon size={14} className="mt-0.5 shrink-0 text-[var(--lokvis-danger)]">
 <circle cx="12" cy="12" r="10" />
 <line x1="12" y1="8" x2="12" y2="12" />
 <line x1="12" y1="16" x2="12.01" y2="16" />
 </Icon>
 <div className="flex-1 min-w-0">
 <p className="text-[11px] font-medium text-[var(--lokvis-danger)]">
 {t('errorBanner.title')}
 </p>
 <p className="mt-0.5 break-words text-[10px] text-[var(--lokvis-danger)]/80">
 {formatMessage(t, error)}
 </p>
 </div>
 <div className="flex shrink-0 items-center gap-1">
 {canRetry && (
 <button
 type="button"
 onClick={handleRetry}
 className="rounded bg-[var(--lokvis-danger)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--lokvis-danger)] transition-colors hover:bg-[var(--lokvis-danger)]/30"
 >
 {t('errorBanner.retry')}
 </button>
 )}
 <button
 type="button"
 onClick={handleDismiss}
 aria-label={t('errorBanner.dismissAria')}
 className="rounded p-0.5 text-[var(--lokvis-danger)] transition-colors hover:bg-[var(--lokvis-danger)]/15 hover:text-[var(--lokvis-danger)]"
 >
 <Icon size={12} strokeWidth={3}><path d="M6 18L18 6M6 6l12 12" /></Icon>
 </button>
 </div>
 </div>
 );
}
