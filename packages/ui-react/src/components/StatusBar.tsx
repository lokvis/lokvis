/**
 * StatusBar - 底部状态栏
 *
 * 紧凑单行:左侧状态指示 + 当前工具 + 进度,右侧在线状态 + 资源统计 + 存储配额。
 *
 * W9.6 新增:
 * - 当前选中工具名(从 selectedNode 取)
 * - 执行进度(已完成节点数 / 总节点数)
 * - 在线状态(navigator.onLine + 事件监听)
 */

import * as React from 'react';
import { useWorkspaceStore } from '../store/index.js';
import { useWorkflowProgress } from '../hooks/useWorkflowProgress.js';
import { formatBytes } from '../utils.js';
import { useWorkspaceLang } from '../i18n/useWorkspaceLang.js';
import { formatMessage, pluralKey, useWorkspaceTranslations } from '../i18n/utils.js';

export interface StatusBarProps {
 className?: string;
}

/** useOnlineStatus - 监听 navigator.onLine + online/offline 事件(W9.6) */
function useOnlineStatus(): boolean {
 const [online, setOnline] = React.useState<boolean>(() =>
 typeof navigator !== 'undefined' ? navigator.onLine : true
 );
 React.useEffect(() => {
 const onOnline = () => setOnline(true);
 const onOffline = () => setOnline(false);
 window.addEventListener('online', onOnline);
 window.addEventListener('offline', onOffline);
 return () => {
 window.removeEventListener('online', onOnline);
 window.removeEventListener('offline', onOffline);
 };
 }, []);
 return online;
}

export function StatusBar({ className = '' }: StatusBarProps) {
 const statusMessage = useWorkspaceStore((s) => s.statusMessage);
 const error = useWorkspaceStore((s) => s.error);
 const running = useWorkspaceStore((s) => s.running);
 const assets = useWorkspaceStore((s) => s.assets);
 const capabilities = useWorkspaceStore((s) => s.capabilities);
 const nodes = useWorkspaceStore((s) => s.nodes);
 const selectedNodeId = useWorkspaceStore((s) => s.selectedNodeId);
 const storageUsage = useWorkspaceStore((s) => s.storageUsage);
 const setError = useWorkspaceStore((s) => s.setError);
 const online = useOnlineStatus();
 const lang = useWorkspaceLang();
 const t = useWorkspaceTranslations(lang);

 // W9.6 当前选中工具名
 const selectedNode = nodes.find((n) => n.id === selectedNodeId);

 // W9.6 执行进度(抽取到共享 hook,与 ProgressBar 共用,避免重复逻辑)
 const { total: totalNodes, done: doneNodes, pct: progressPct } = useWorkflowProgress();

 // W6.7 存储配额压力:>=95% 红(临界),>=80% 琥珀(警告),其余正常
 const ratio = storageUsage ? storageUsage.usage / storageUsage.quota : 0;
 const storageCritical = ratio >= 0.95;
 const storageWarning = ratio >= 0.8 && !storageCritical;

 return (
 <footer
 className={`flex h-[var(--lokvis-statusbar-h)] shrink-0 items-center justify-between border-t border-[var(--lokvis-border)] bg-[var(--lokvis-surface)] px-3 ${className}`}
 >
 {/* Left: Status — m5 加 aria-live,屏幕阅读器播报状态变化 */}
 <div
 className="flex items-center gap-2 min-w-0"
 role="status"
 aria-live="polite"
 >
 <span className="flex items-center gap-1.5">
 <span
 className={`h-1.5 w-1.5 rounded-full shrink-0 ${
 error
 ? 'bg-[var(--lokvis-danger)]'
 : running
 ? 'bg-[var(--lokvis-warning)] animate-pulse'
 : 'bg-[var(--lokvis-success)]'
 }`}
 aria-hidden="true"
 />
 <span className={`truncate text-[10px] ${error ? 'text-[var(--lokvis-danger)]' : 'text-[var(--lokvis-fg-muted)]'}`}>
 {formatMessage(t, statusMessage)}
 </span>
 </span>

 {/* W9.6 当前工具名 */}
 {selectedNode && (
 <>
 <span className="text-[var(--lokvis-fg-subtle)]" aria-hidden="true">·</span>
 <span className="shrink-0 font-mono text-[10px] text-[var(--lokvis-primary)] truncate max-w-[120px]">
 {selectedNode.capability}
 </span>
 </>
 )}

 {/* W9.6 执行进度 */}
 {running && totalNodes > 0 && (
 <>
 <span className="text-[var(--lokvis-fg-subtle)]" aria-hidden="true">·</span>
 <span className="shrink-0 tabular-nums text-[10px] text-[var(--lokvis-warning)]">
 {doneNodes}/{totalNodes} ({progressPct}%)
 </span>
 </>
 )}

 {error && (
 <button
 type="button"
 onClick={() => setError(null)}
 className="shrink-0 text-[10px] text-[var(--lokvis-danger)] underline decoration-[var(--lokvis-danger)]/40 hover:text-[var(--lokvis-danger)]"
 >
 {t('statusBar.dismiss')}
 </button>
 )}
 </div>

 {/* Right: Stats */}
 <div className="flex items-center gap-3 shrink-0 text-[10px] text-[var(--lokvis-fg-subtle)] tabular-nums">
 {/* W9.6 在线状态 */}
 <span
 className={`flex items-center gap-1 ${online ? 'text-[var(--lokvis-success)]' : 'text-[var(--lokvis-warning)]'}`}
 title={online ? t('statusBar.online') : t('statusBar.offlineTitle')}
 aria-label={online ? t('statusBar.online') : t('statusBar.offlineAria')}
 >
 <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-[var(--lokvis-success)]' : 'bg-[var(--lokvis-warning)]'}`} aria-hidden="true" />
 {online ? t('statusBar.online') : t('statusBar.offline')}
 </span>
 <span className="text-[var(--lokvis-fg-subtle)]" aria-hidden="true">|</span>

 {/* W6.7 存储配额:接近上限时变色警告;m5 加 aria-label 让屏幕阅读器播报告警 */}
 {storageUsage && (
 <>
 <span
 className={`flex items-center gap-1 ${
 storageCritical
 ? 'text-[var(--lokvis-danger)] font-semibold'
 : storageWarning
 ? 'text-[var(--lokvis-warning)]'
 : 'text-[var(--lokvis-fg-subtle)]'
 }`}
 title={
 storageCritical
 ? t('statusBar.storageCriticalTitle', { percent: Math.round(ratio * 100) })
 : storageWarning
 ? t('statusBar.storageWarningTitle', { percent: Math.round(ratio * 100) })
 : t('statusBar.storageTitle', { used: formatBytes(storageUsage.usage), quota: formatBytes(storageUsage.quota) })
 }
 aria-label={
 storageCritical
 ? t('statusBar.storageCriticalAria', { used: formatBytes(storageUsage.usage), quota: formatBytes(storageUsage.quota), percent: Math.round(ratio * 100) })
 : storageWarning
 ? t('statusBar.storageWarningAria', { used: formatBytes(storageUsage.usage), quota: formatBytes(storageUsage.quota), percent: Math.round(ratio * 100) })
 : t('statusBar.storageAria', { used: formatBytes(storageUsage.usage), quota: formatBytes(storageUsage.quota) })
 }
 aria-live={storageCritical ? 'assertive' : 'polite'}
 >
 {(storageCritical || storageWarning) && (
 <span className="text-[9px]" aria-hidden="true">⚠</span>
 )}
 {formatBytes(storageUsage.usage)} / {formatBytes(storageUsage.quota)}
 </span>
 <span className="text-[var(--lokvis-fg-subtle)]" aria-hidden="true">|</span>
 </>
 )}
 <span>{t(pluralKey(lang, 'statusBar.assetCount', assets.length), { count: assets.length })}</span>
 <span className="text-[var(--lokvis-fg-subtle)]" aria-hidden="true">|</span>
 <span>{t(pluralKey(lang, 'statusBar.capCount', capabilities.length), { count: capabilities.length })}</span>
 <span className="text-[var(--lokvis-fg-subtle)]" aria-hidden="true">|</span>
 <span>{t(pluralKey(lang, 'statusBar.stepCount', nodes.length), { count: nodes.length })}</span>
 </div>
 </footer>
 );
}
