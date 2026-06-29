/**
 * Inspector - 右侧能力配置面板
 *
 * 显示所有可用能力，点击添加到工作流。
 * 选中节点时显示其参数表单。
 */

import * as React from 'react';
import { useWorkspaceStore } from '../store.js';
import { ParamForm } from './ParamForm.js';

export interface InspectorProps {
  className?: string;
}

export function Inspector({ className = '' }: InspectorProps) {
  const capabilities = useWorkspaceStore((s) => s.capabilities);
  const nodes = useWorkspaceStore((s) => s.nodes);
  const selectedNodeId = useWorkspaceStore((s) => s.selectedNodeId);
  const capabilityMap = useWorkspaceStore((s) => s.capabilityMap);
  const addNode = useWorkspaceStore((s) => s.addNode);
  const updateNodeParams = useWorkspaceStore((s) => s.updateNodeParams);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const [filter, setFilter] = React.useState('');

  const filtered = capabilities.filter(
    (c) =>
      c.name.toLowerCase().includes(filter.toLowerCase()) ||
      c.description.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <aside
      className={`flex w-80 flex-col border-l border-zinc-200 dark:border-zinc-800 ${className}`}
    >
      {/* 参数编辑区（选中节点时显示） */}
      {selectedNode && capabilityMap[selectedNode.capability] ? (
        <div className="flex flex-col border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Configure
            </h3>
            <span className="font-mono text-xs text-zinc-400">
              {selectedNode.capability}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <ParamForm
              capability={capabilityMap[selectedNode.capability]!}
              values={selectedNode.params}
              onChange={(params) => updateNodeParams(selectedNode.id, params)}
            />
          </div>
        </div>
      ) : null}

      {/* 能力库 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Capabilities
          </h3>
          <span className="text-xs text-zinc-400">{capabilities.length}</span>
        </div>
        <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <input
            type="text"
            placeholder="Search..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full rounded-md border border-zinc-200 bg-transparent px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none dark:border-zinc-700"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {capabilities.length === 0 ? (
            <p className="px-2 text-xs text-zinc-400">
              No capabilities registered. Load a plugin to get started.
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-2 text-xs text-zinc-400">No match</p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((cap) => (
                <li key={cap.name}>
                  <button
                    type="button"
                    onClick={() => addNode(cap.name)}
                    className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-medium">{cap.name}</span>
                      <span className="text-[10px] uppercase text-zinc-400">
                        {cap.performance}
                      </span>
                    </div>
                    <div className="mt-0.5 text-zinc-500">{cap.description}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}
