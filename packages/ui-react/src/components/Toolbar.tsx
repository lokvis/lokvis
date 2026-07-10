/**
 * Toolbar - 工作台顶部工具栏
 *
 * 左：Logo + 标题
 * 中：状态消息
 * 右：操作按钮组
 */

import * as React from 'react';
import { Button } from '@lokvis/ui-core';
import { useWorkspaceStore } from '../store/index.js';

export interface ToolbarProps {
 title?: string;
 rightExtra?: React.ReactNode;
}

export function Toolbar({ title = 'Lokvis Workspace', rightExtra }: ToolbarProps) {
 const running = useWorkspaceStore((s) => s.running);
 const statusMessage = useWorkspaceStore((s) => s.statusMessage);
 const error = useWorkspaceStore((s) => s.error);
 const nodes = useWorkspaceStore((s) => s.nodes);
 const selectedAssetId = useWorkspaceStore((s) => s.selectedAssetId);
 const run = useWorkspaceStore((s) => s.run);
 const clearWorkflow = useWorkspaceStore((s) => s.clearWorkflow);
 const setError = useWorkspaceStore((s) => s.setError);

 const canRun = !running && nodes.length > 0 && !!selectedAssetId;

 async function handleRun() {
 try {
 await run();
 } catch (err) {
 setError(err instanceof Error ? err.message : String(err));
 }
 }

 return (
 <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--lokvis-border)] bg-[var(--lokvis-surface)] px-4">
 {/* Left: Brand */}
 <div className="flex items-center gap-2.5 min-w-0">
 <span
 className="shrink-0 text-base font-bold leading-none"
 style={{
 background: 'linear-gradient(135deg, var(--lokvis-primary), var(--lokvis-info))',
 WebkitBackgroundClip: 'text',
 WebkitTextFillColor: 'transparent',
 }}
 >
 ◆
 </span>
 <span className="truncate text-sm font-semibold tracking-tight">{title}</span>
 </div>

 {/* Center: Status */}
 <div className="flex flex-1 items-center justify-center px-4 min-w-0">
 <span className={`truncate text-xs ${error ? 'text-[var(--lokvis-danger)]' : 'text-[var(--lokvis-fg-subtle)]'}`}>
 {statusMessage}
 </span>
 </div>

 {/* Right: Actions */}
 <div className="flex items-center gap-1.5 shrink-0">
 {rightExtra}
 {nodes.length > 0 && (
 <Button
 variant="ghost"
 size="sm"
 onClick={clearWorkflow}
 disabled={running}
 >
 Clear
 </Button>
 )}
 <Button
 variant="primary"
 size="sm"
 onClick={handleRun}
 loading={running}
 disabled={!canRun}
 >
 Run
 </Button>
 </div>
 </header>
 );
}
