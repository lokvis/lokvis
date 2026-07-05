/**
 * Demo: Plugin Loader (W14.4)
 *
 * 展示 @lokvis/sdk 的 `loadPlugin()` —— 运行时动态加载插件，
 * 对比加载前后 capabilities 数量变化。
 *
 *   - 初始化：createLokvis({ plugins: [imageToolsPlugin()] }) 仅预加载 image
 *   - 运行时：loadPlugin(runtime, devToolsPlugin()) 动态追加 developer.*
 *   - 事件：订阅 plugin:loaded，展示加载时间线
 *
 * 这是 plugin 生态的核心 demo：用户可在运行时启用插件，能力集动态变化。
 */
import { useEffect, useState, useRef } from 'react';
import { createLokvis, loadPlugin } from '@lokvis/sdk';
import type { LokvisRuntime, Capability, PluginLoadEntry } from '@lokvis/sdk';
import { imageToolsPlugin } from '@lokvis/plugin-image';
import { devToolsPlugin } from '@lokvis/plugin-dev';

interface PluginInfo {
  id: string;
  name: string;
  version: string;
  factory: () => PluginLoadEntry;
  preloaded: boolean;
}

/** 可用插件注册表（image 预加载，dev 运行时加载） */
const AVAILABLE_PLUGINS: PluginInfo[] = [
  { id: 'image', name: 'lokvis-image-tools', version: '0.1.0', factory: imageToolsPlugin, preloaded: true },
  { id: 'dev', name: 'lokvis-dev-tools', version: '0.1.0', factory: devToolsPlugin, preloaded: false },
];

interface LogEntry {
  id: number;
  text: string;
  ts: number;
}

let counter = 0;

/** 按 namespace 前缀（首段）分组 capability */
function groupByCategory(caps: Capability[]): Record<string, Capability[]> {
  const groups: Record<string, Capability[]> = {};
  for (const c of caps) {
    const key = c.name.split('.')[0] ?? 'other';
    (groups[key] ??= []).push(c);
  }
  return groups;
}

export default function PluginDemo() {
  const [runtime, setRuntime] = useState<LokvisRuntime | null>(null);
  const [caps, setCaps] = useState<Capability[]>([]);
  const [initialCapNames, setInitialCapNames] = useState<Set<string>>(new Set());
  const [loadedPluginIds, setLoadedPluginIds] = useState<Set<string>>(new Set());
  const [pluginCapCounts, setPluginCapCounts] = useState<Record<string, number>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logBoxRef = useRef<HTMLDivElement>(null);

  const addLog = (text: string) => {
    setLogs((prev) => [...prev.slice(-100), { id: ++counter, text, ts: Date.now() }]);
  };

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let rt: LokvisRuntime | undefined;
    (async () => {
      try {
        rt = await createLokvis({ plugins: [imageToolsPlugin()] });
        setRuntime(rt);
        const list = await rt.capabilities();
        setCaps(list);
        setInitialCapNames(new Set(list.map((c) => c.name)));
        setLoadedPluginIds(new Set(['image']));
        setPluginCapCounts({ 'lokvis-image-tools': list.length });
        addLog(`Runtime ready · ${list.length} capabilities (image preloaded)`);

        unsub = rt.eventBus.on('plugin:loaded', (e) => {
          addLog(`[plugin:loaded] ${e.name}@${e.version}`);
        });
      } catch (err) {
        addLog(`Init failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    })();
    return () => {
      unsub?.();
      void rt?.cancel('all');
    };
  }, []);

  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
  }, [logs]);

  async function handleLoad(info: PluginInfo) {
    if (!runtime || loadedPluginIds.has(info.id) || loadingId !== null) return;
    setLoadingId(info.id);
    const before = new Set(caps.map((c) => c.name));
    try {
      await loadPlugin(runtime, info.factory());
      const fresh = await runtime.capabilities();
      setCaps(fresh);
      setLoadedPluginIds((prev) => new Set(prev).add(info.id));
      const added = fresh.filter((c) => !before.has(c.name));
      setPluginCapCounts((prev) => ({ ...prev, [info.name]: added.length }));
      addLog(`Loaded ${info.name}@${info.version} · +${added.length} capabilities`);
    } catch (err) {
      addLog(`Load failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingId(null);
    }
  }

  const groups = groupByCategory(caps);
  const loadedList = AVAILABLE_PLUGINS.filter((p) => loadedPluginIds.has(p.id));
  const availableList = AVAILABLE_PLUGINS.filter((p) => !loadedPluginIds.has(p.id));

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">Plugin Loader</h1>
        <p className="mt-0.5 text-xs text-zinc-500">loadPlugin() · dynamic capability registration</p>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-px overflow-hidden bg-zinc-800 lg:grid-cols-2">
        {/* 左栏：Loaded + Available Plugins */}
        <section className="flex flex-col overflow-hidden bg-zinc-950">
          <header className="border-b border-zinc-800/50 px-4 py-2 text-xs font-semibold text-zinc-400">
            Loaded Plugins ({loadedList.length})
          </header>
          <div className="flex-1 overflow-auto p-2">
            <ul className="space-y-1">
              {loadedList.map((p) => (
                <li key={p.id} className="rounded bg-emerald-950/20 px-2 py-1.5 ring-1 ring-inset ring-emerald-800/30">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-emerald-400">{p.name}</span>
                    <span className="font-mono text-[10px] text-zinc-500">v{p.version}</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-zinc-500">
                    {pluginCapCounts[p.name] ?? 0} capabilities
                  </div>
                </li>
              ))}
              {loadedList.length === 0 && (
                <p className="p-3 text-center text-[10px] text-zinc-600">Loading…</p>
              )}
            </ul>

            {availableList.length > 0 && (
              <>
                <div className="mb-1 mt-3 px-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                  Available Plugins
                </div>
                <ul className="space-y-1">
                  {availableList.map((p) => (
                    <li key={p.id} className="flex items-center justify-between rounded bg-zinc-900/50 px-2 py-1.5">
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] text-zinc-300">{p.name}</div>
                        <div className="text-[10px] text-zinc-600">v{p.version}</div>
                      </div>
                      <button
                        onClick={() => handleLoad(p)}
                        disabled={loadingId !== null}
                        className="rounded bg-indigo-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loadingId === p.id ? 'Loading…' : 'Load'}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>

        {/* 右栏：Capabilities */}
        <section className="flex flex-col overflow-hidden bg-zinc-950">
          <header className="border-b border-zinc-800/50 px-4 py-2 text-xs font-semibold text-zinc-400">
            Capabilities ({caps.length})
          </header>
          <div className="flex-1 overflow-auto p-2">
            {Object.entries(groups).length === 0 ? (
              <p className="p-4 text-center text-[10px] text-zinc-600">Loading…</p>
            ) : (
              <div className="flex flex-col gap-2">
                {Object.entries(groups).map(([cat, list]) => (
                  <div key={cat} className="rounded border border-zinc-800 bg-zinc-900/30">
                    <div className="border-b border-zinc-800/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      {cat}.* ({list.length})
                    </div>
                    <ul className="divide-y divide-zinc-800/40">
                      {list.map((c) => {
                        const isNew = !initialCapNames.has(c.name);
                        return (
                          <li key={c.name} className={`px-2 py-1.5 ${isNew ? 'bg-emerald-900/20' : ''}`}>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px] text-indigo-400">{c.name}</span>
                              {isNew && (
                                <span className="rounded bg-emerald-600 px-1 py-0.5 text-[8px] font-bold uppercase text-white">
                                  New
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 text-[10px] text-zinc-500">{c.description}</div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 底部：Event Log */}
      <section className="flex h-32 flex-shrink-0 flex-col border-t border-zinc-800 bg-zinc-950">
        <header className="flex items-center justify-between border-b border-zinc-800/50 px-4 py-1.5">
          <span className="text-[11px] font-semibold text-zinc-400">Event Log</span>
          <button
            onClick={() => setLogs([])}
            className="text-[10px] text-zinc-500 hover:text-zinc-300"
          >
            Clear
          </button>
        </header>
        <div ref={logBoxRef} className="flex-1 overflow-auto px-3 py-1 font-mono text-[10px]">
          {logs.length === 0 ? (
            <p className="py-2 text-zinc-600">plugin:loaded events will appear here…</p>
          ) : (
            logs.map((l) => (
              <div key={l.id} className="py-0.5 text-zinc-400">
                <span className="text-zinc-600">{new Date(l.ts).toLocaleTimeString()}</span> {l.text}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
