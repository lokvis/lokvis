/**
 * Inspector - 右侧面板
 *
 * 上半部分：当前选中节点的参数配置（Configure）
 * 下半部分：可用 Capabilities 列表（点击添加到工作流）
 */

import * as React from 'react';
import { useWorkspaceStore } from '../store/index.js';
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
  const [configureOpen, setConfigureOpen] = React.useState(true);

  const filtered = capabilities.filter(
    (c) =>
      c.name.toLowerCase().includes(filter.toLowerCase()) ||
      c.description.toLowerCase().includes(filter.toLowerCase())
  );

  // 按域分组
  const grouped = React.useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const cap of filtered) {
      const domain = cap.name.split('.')[0] ?? 'other';
      if (!map.has(domain)) map.set(domain, []);
      map.get(domain)!.push(cap);
    }
    return map;
  }, [filtered]);

  const showConfigure = selectedNode && capabilityMap[selectedNode.capability];

  return (
    <aside
      className={`flex w-72 shrink-0 flex-col border-l border-zinc-200 dark:border-zinc-800 ${className}`}
    >
      {/* Configure section (when a node is selected) */}
      {showConfigure && (
        <div className="shrink-0 border-b border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setConfigureOpen(!configureOpen)}
            className="flex w-full items-center justify-between px-3 h-10 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          >
            <div className="flex items-center gap-2">
              <svg className={`h-3 w-3 text-zinc-400 transition-transform ${configureOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7"/></svg>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Configure</span>
            </div>
            <span className="font-mono text-[10px] text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 px-1.5 py-0.5 rounded">
              {selectedNode.capability}
            </span>
          </button>
          {configureOpen && (
            <div className="px-3 pb-3 max-h-60 overflow-y-auto">
              <ParamForm
                capability={capabilityMap[selectedNode.capability]!}
                values={selectedNode.params}
                onChange={(params) => updateNodeParams(selectedNode.id, params)}
              />
            </div>
          )}
        </div>
      )}

      {/* Capabilities section */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 h-10 shrink-0 border-b border-zinc-200 dark:border-zinc-800">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Capabilities
          </span>
          <span className="text-[11px] tabular-nums text-zinc-400">{filtered.length}</span>
        </div>

        {/* Search */}
        <div className="px-2 py-2 border-b border-zinc-100 dark:border-zinc-800/50">
          <div className="relative">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              type="text"
              placeholder="Search capabilities..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white py-1 pl-7 pr-2 text-[11px] placeholder-zinc-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        </div>

        {/* Capability list */}
        <div className="flex-1 overflow-y-auto p-2">
          {capabilities.length === 0 ? (
            <div className="px-2 py-8 text-center">
              <p className="text-[11px] text-zinc-400">No capabilities loaded</p>
              <p className="mt-1 text-[10px] text-zinc-500">Load a plugin to get started</p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-2 py-4 text-[11px] text-zinc-400">No matching capabilities</p>
          ) : (
            <div className="space-y-3">
              {Array.from(grouped.entries()).map(([domain, caps]) => (
                <div key={domain}>
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    {domain}
                  </div>
                  <ul className="space-y-0.5">
                    {caps.map((cap) => {
                      const isInPipeline = nodes.some((n) => n.capability === cap.name);
                      return (
                        <li key={cap.name}>
                          <button
                            type="button"
                            onClick={() => addNode(cap.name)}
                            className={`group w-full rounded-md px-2 py-1.5 text-left transition-all ${
                              isInPipeline
                                ? 'bg-indigo-50/50 ring-1 ring-indigo-200 dark:bg-indigo-950/20 dark:ring-indigo-800'
                                : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate font-mono text-[11px] font-medium">{cap.name}</span>
                              <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-medium uppercase ${
                                cap.performance === 'fast'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : cap.performance === 'medium'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                  : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                              }`}>
                                {cap.performance}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-[10px] text-zinc-500 dark:text-zinc-400">{cap.description}</p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
