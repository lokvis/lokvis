/**
 * Demo 4: MCP Manifest
 *
 * 展示 Runtime.toMcpManifest() —— 将已注册的 capability 转换为 MCP server
 * manifest（JSON-RPC tool definitions）。
 *
 * 这让 Lokvis 可以被任何 MCP 兼容的 AI client（Claude Desktop / Cursor 等）
 * 当作一个工具源使用，AI 直接调用 lokvis_image_resize 等工具。
 *
 * 选项：
 *   - batchMode: 暴露 batch-only capability（如 batch 处理）
 *   - 切换 plugin 组合查看 manifest 差异
 */
import { useEffect, useState } from 'react';
import { createLokvis } from '@lokvis/sdk';
import type { LokvisRuntime, McpManifest } from '@lokvis/sdk';
import { imageToolsPlugin } from '@lokvis/plugin-image';
import { devToolsPlugin } from '@lokvis/plugin-dev';

type PluginSet = 'image-only' | 'image+dev';

const PLUGIN_SETS: Record<PluginSet, string[]> = {
  'image-only': ['@lokvis/plugin-image'],
  'image+dev': ['@lokvis/plugin-image', '@lokvis/plugin-dev'],
};

export default function McpManifestDemo() {
  const [runtime, setRuntime] = useState<LokvisRuntime | null>(null);
  const [manifest, setManifest] = useState<McpManifest | null>(null);
  const [pluginSet, setPluginSet] = useState<PluginSet>('image-only');
  const [batchMode, setBatchMode] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  useEffect(() => {
    let rt: LokvisRuntime | undefined;
    (async () => {
      const plugins =
        pluginSet === 'image-only'
          ? [imageToolsPlugin()]
          : [imageToolsPlugin(), devToolsPlugin()];
      rt = await createLokvis({ plugins });
      setRuntime(rt);
      setManifest(rt.toMcpManifest({ batchMode }));
    })();
    return () => void rt?.cancel('all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pluginSet]);

  useEffect(() => {
    if (runtime) {
      setManifest(runtime.toMcpManifest({ batchMode }));
      setSelectedTool(null);
    }
  }, [runtime, batchMode]);

  const selected = manifest?.tools.find((t) => t.name === selectedTool);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">MCP Manifest</h1>
        <p className="mt-0.5 text-xs text-zinc-500">runtime.toMcpManifest() · expose capabilities as AI tools</p>
      </div>

      {/* 控制面板 */}
      <div className="flex items-center gap-4 border-b border-zinc-800 bg-zinc-950/50 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-zinc-500">Plugins:</span>
          <select
            value={pluginSet}
            onChange={(e) => setPluginSet(e.target.value as PluginSet)}
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-200 focus:border-indigo-500 focus:outline-none"
          >
            {Object.entries(PLUGIN_SETS).map(([key, plugins]) => (
              <option key={key} value={key}>
                {plugins.join(' + ')}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={batchMode}
            onChange={(e) => setBatchMode(e.target.checked)}
            className="h-3 w-3 rounded border-zinc-700 bg-zinc-950 text-indigo-500 focus:ring-indigo-500"
          />
          <span className="text-[10px] text-zinc-400">batchMode</span>
        </label>
        <span className="ml-auto text-[10px] text-zinc-600">
          {manifest?.tools.length ?? 0} tools · {manifest?.resources.length ?? 0} resources
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 工具列表 */}
        <div className="flex w-72 flex-shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
          <header className="border-b border-zinc-800/50 px-3 py-2 text-[11px] font-semibold text-zinc-400">
            MCP Tools
          </header>
          <div className="flex-1 overflow-auto p-2">
            {manifest?.tools.length === 0 ? (
              <p className="p-3 text-center text-[10px] text-zinc-600">
                No tools exposed with current options
              </p>
            ) : (
              <ul className="space-y-1">
                {manifest?.tools.map((t) => (
                  <li key={t.name}>
                    <button
                      onClick={() => setSelectedTool(t.name)}
                      className={`w-full rounded px-2 py-1.5 text-left transition-colors ${
                        selectedTool === t.name
                          ? 'bg-indigo-600/10 ring-1 ring-inset ring-indigo-500/20'
                          : 'hover:bg-zinc-900'
                      }`}
                    >
                      <div className="font-mono text-[10px] text-indigo-400">{t.name}</div>
                      <div className="mt-0.5 line-clamp-2 text-[9px] text-zinc-500">{t.description}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 详情面板 */}
        <div className="flex flex-1 flex-col overflow-hidden bg-zinc-950">
          {selected ? (
            <>
              <header className="border-b border-zinc-800/50 px-4 py-3">
                <div className="font-mono text-sm text-indigo-400">{selected.name}</div>
                <div className="mt-1 text-[11px] text-zinc-400">{selected.description}</div>
              </header>
              <div className="flex-1 overflow-auto p-4">
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  Input Schema
                </h3>
                <pre className="overflow-auto rounded border border-zinc-800 bg-zinc-900/50 p-3 font-mono text-[10px] text-zinc-300">
                  {JSON.stringify(selected.inputSchema, null, 2)}
                </pre>
                <h3 className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  Capabilities
                </h3>
                <div className="flex flex-wrap gap-1">
                  {selected.capabilities.map((c) => (
                    <span
                      key={c}
                      className="rounded-full bg-indigo-950 px-2 py-0.5 font-mono text-[10px] text-indigo-400"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <p className="text-[11px] text-zinc-600">Select a tool to view its input schema</p>
                <p className="mt-1 text-[10px] text-zinc-700">
                  Or copy the full manifest below for your MCP client config
                </p>
              </div>
            </div>
          )}

          {/* 完整 manifest JSON */}
          {manifest && (
            <details className="border-t border-zinc-800">
              <summary className="cursor-pointer px-4 py-2 text-[11px] font-medium text-zinc-400 hover:text-zinc-200">
                Full Manifest JSON
              </summary>
              <pre className="max-h-64 overflow-auto bg-zinc-900/30 p-3 font-mono text-[10px] text-zinc-300">
                {JSON.stringify(manifest, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
