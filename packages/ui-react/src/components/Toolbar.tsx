/**
 * Toolbar - 工作台顶部工具栏
 *
 * 显示 Logo、状态、运行按钮、清空按钮。
 */

import * as React from 'react';
import { Button } from '@lokvis/ui-core';
import { useWorkspaceStore } from '../store.js';

export interface ToolbarProps {
  /** Logo 文字 */
  title?: string;
  /** 额外的右侧操作 */
  rightExtra?: React.ReactNode;
}

export function Toolbar({ title = 'Lokvis Workspace', rightExtra }: ToolbarProps) {
  const running = useWorkspaceStore((s) => s.running);
  const statusMessage = useWorkspaceStore((s) => s.statusMessage);
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
    <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        <span className="text-base" aria-hidden>◆</span>
        <span className="font-semibold">{title}</span>
      </div>
      <div className="flex flex-1 items-center justify-center text-xs text-zinc-500">
        {statusMessage}
      </div>
      <div className="flex items-center gap-2">
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
