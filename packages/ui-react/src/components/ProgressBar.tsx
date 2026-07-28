/**
 * ProgressBar - 工作流执行进度条 + 取消按钮(W11.6)
 *
 * 展示:
 * - 节点完成进度(成功数 / 总数)
 * - 横向进度条(running 时动画)
 * - Cancel 按钮(调用 cancelRun)
 * - 状态消息(statusMessage)
 *
 * 仅在 running 或最近一次执行有结果时显示。
 *
 * @module ProgressBar
 */

import { Icon } from '@lokvis/ui-core';
import { useWorkspaceStore } from '../store/index.js';
import { useWorkflowProgress } from '../hooks/useWorkflowProgress.js';
import { useWorkspaceLang } from '../i18n/useWorkspaceLang.js';
import { formatMessage, useWorkspaceTranslations } from '../i18n/utils.js';

export interface ProgressBarProps {
 className?: string;
}

export function ProgressBar({ className = '' }: ProgressBarProps) {
 const running = useWorkspaceStore((s) => s.running);
 const statusMessage = useWorkspaceStore((s) => s.statusMessage);
 const cancelRun = useWorkspaceStore((s) => s.cancelRun);
 const lang = useWorkspaceLang();
 const t = useWorkspaceTranslations(lang);

 // 进度计算抽取到共享 hook(与 StatusBar 共用,避免重复逻辑)
 const { total, done, failedCount, pct, hasFailure } = useWorkflowProgress();

 // 没有节点或未运行且无最近结果时不渲染
 if (total === 0) return null;
 if (!running && done === 0) return null;

 return (
 <div
 className={`flex items-center gap-2 border-b border-[var(--lokvis-border)] bg-[var(--lokvis-surface)] px-3 py-1.5 ${className}`}
 role="status"
 aria-live="polite"
 aria-label={t('progressBar.progressAria', { done, total })}
 >
 {/* 进度条 */}
 <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--lokvis-border)]">
 <div
 className={`absolute inset-y-0 left-0 transition-all duration-300 ${
 hasFailure
 ? 'bg-[var(--lokvis-danger)]'
 : running
 ? 'bg-[var(--lokvis-primary)]'
 : 'bg-[var(--lokvis-success)]'
 } ${running ? 'animate-pulse' : ''}`}
 style={{ width: `${pct}%` }}
 />
 </div>

 {/* 计数 */}
 <span className="shrink-0 text-[10px] font-medium tabular-nums text-[var(--lokvis-fg-muted)]">
 {done}/{total}
 {failedCount > 0 && (
 <span className="ml-1 text-[var(--lokvis-danger)]">{t('progressBar.failedCount', { count: failedCount })}</span>
 )}
 </span>

 {/* 状态消息(running 时显示) */}
 {running && statusMessage && (
 <span className="hidden shrink-0 truncate text-[10px] text-[var(--lokvis-fg-subtle)] sm:inline">
 {formatMessage(t, statusMessage)}
 </span>
 )}

 {/* Cancel 按钮(仅 running 时) */}
 {running && (
 <button
 type="button"
 onClick={() => void cancelRun()}
 aria-label={t('progressBar.cancelAria')}
 title={t('progressBar.cancelAria')}
 className="flex shrink-0 items-center gap-1 rounded-md bg-[var(--lokvis-danger)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--lokvis-danger)] transition-colors hover:bg-[var(--lokvis-danger)]/15"
 >
 <Icon size={10} strokeWidth={3}><path d="M6 6l12 12M6 18L18 6" /></Icon>
 {t('progressBar.cancel')}
 </button>
 )}

 {/* 完成图标(非 running 且有结果) */}
 {!running && done === total && (
 <span
 className={`flex shrink-0 items-center gap-1 text-[10px] font-medium ${
 hasFailure ? 'text-[var(--lokvis-danger)]' : 'text-[var(--lokvis-success)]'
 }`}
 >
 <Icon size={10} strokeWidth={3}>
 {hasFailure ? (
 <path d="M12 2L2 22h20L12 2zM12 9v5M12 17v.01" />
 ) : (
 <path d="M20 6L9 17l-5-5" />
 )}
 </Icon>
 {hasFailure ? t('progressBar.failed') : t('progressBar.done')}
 </span>
 )}
 </div>
 );
}
