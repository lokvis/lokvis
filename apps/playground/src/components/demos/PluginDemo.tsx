/**
 * Demo: Plugin Loading (W14.4)
 *
 * 展示 @lokvis/sdk 的 `loadPlugin()` ——运行时动态扩展 API。
 *
 * 与 SdkDemo 的关键区别:
 *   - `createLokvis({ plugins })` 在构造时预加载插件(一次性)
 *   - `loadPlugin(runtime, plugin)` 在 runtime 已构造后由用户触发注入
 *
 * 演示 4 个加载场景:
 *   1. imageToolsPlugin()  → 9 个图像能力(@lokvis/plugin-image)
 *   2. devToolsPlugin()    → 开发者能力(@lokvis/plugin-dev)
 *   3. 内联 definePlugin()  → 浏览器侧自定义,仅声明 demo.echo 能力,无实现
 *   4. imageToolsPlugin() 重复加载 → 预期失败,演示错误路径
 *
 * 事件流:eventBus.onAny() 订阅,过滤 plugin:loaded 事件,记录 name@version。
 * 卸载时调用 runtime.cancel('all') 释放资源。
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { createLokvis, loadPlugin } from '@lokvis/sdk';
import type { LokvisRuntime, Capability, PluginLoadEntry } from '@lokvis/sdk';
import { definePlugin } from '@lokvis/plugin-sdk';
import { imageToolsPlugin } from '@lokvis/plugin-image';
import { devToolsPlugin } from '@lokvis/plugin-dev';

/** 单个插件的加载状态 */
interface PluginState {
  status: 'idle' | 'loading' | 'loaded' | 'failed';
  /** 加载耗时(ms) */
  durationMs?: number;
  /** 失败时的错误信息 */
  error?: string;
}

/** 日志条目 */
interface LogEntry {
  id: number;
  text: string;
  type: 'log' | 'event' | 'error';
}

/** 加载场景定义 */
interface PluginScenario {
  id: string;
  /** 代码片段标签 */
  label: string;
  /** 来源(npm 包名或 inline) */
  source: string;
  description: string;
  /** 每次加载构造新鲜插件实例(install 闭包不可复用) */
  build: () => PluginLoadEntry;
  /** 预期失败(用于状态徽章文案) */
  expectFail?: boolean;
}

/** 自定义内联插件的能力声明(仅声明,无操作实现) */
const DEMO_ECHO_CAPABILITY: Capability = {
  name: 'demo.echo',
  description: 'Echo a text message (declaration only, no operation)',
  inputTypes: ['text'],
  outputTypes: ['text'],
  params: [
    { name: 'message', type: 'string', required: true, description: 'Message to echo back' },
  ],
  performance: 'fast',
};

/** 4 个加载场景 */
const SCENARIOS: PluginScenario[] = [
  {
    id: 'image-tools',
    label: 'imageToolsPlugin()',
    source: '@lokvis/plugin-image',
    description: 'Official image tools · 9 image capabilities + EXIF reader',
    build: () => imageToolsPlugin(),
  },
  {
    id: 'dev-tools',
    label: 'devToolsPlugin()',
    source: '@lokvis/plugin-dev',
    description: 'Developer tools · capability introspection & profiling',
    build: () => devToolsPlugin(),
  },
  {
    id: 'custom-echo',
    label: 'definePlugin({ ... })',
    source: 'inline (browser-defined)',
    description: 'Custom plugin · registers only demo.echo declaration, no operation',
    build: () =>
      definePlugin({
        name: 'lokvis-demo-echo',
        version: '0.0.1',
        description: 'Inline-defined demo plugin (declaration only)',
        capabilities: [DEMO_ECHO_CAPABILITY],
      }),
  },
  {
    id: 'image-duplicate',
    label: 'imageToolsPlugin() (duplicate)',
    source: '@lokvis/plugin-image',
    description: 'Expected failure · load imageTools again after #1 succeeds',
    build: () => imageToolsPlugin(),
    expectFail: true,
  },
];

let logCounter = 0;

export default function PluginDemo() {
  // loadPlugin 调用需要 runtime 引用;用 ref 持有避免成为 effect 依赖
  const runtimeRef = useRef<LokvisRuntime | null>(null);
  const [ready, setReady] = useState(false);
  const [caps, setCaps] = useState<Capability[]>([]);
  const [states, setStates] = useState<Record<string, PluginState>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((text: string, type: LogEntry['type'] = 'log') => {
    // 200 条环形缓冲:保留最近 199 条 + 新增 1 条 = 200
    setLogs((prev) => [...prev.slice(-199), { id: ++logCounter, text, type }]);
  }, []);

  const refreshCaps = useCallback(async () => {
    const rt = runtimeRef.current;
    if (!rt) return;
    setCaps(await rt.capabilities());
  }, []);

  // 初始化 runtime(不预加载任何插件,演示纯动态加载)
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let rt: LokvisRuntime | undefined;
    (async () => {
      try {
        rt = await createLokvis();
        runtimeRef.current = rt;
        const list = await rt.capabilities();
        setCaps(list);
        setReady(true);
        unsub = rt.eventBus.onAny((e) => {
          // 仅记录 plugin:loaded 事件,输出 name@version
          if (e.type === 'plugin:loaded') {
            addLog(`plugin:loaded · ${e.name}@${e.version}`, 'event');
          }
        });
        addLog(`Runtime ready (no plugins) · ${list.length} built-in capabilities`, 'log');
      } catch (err) {
        addLog(
          `Failed to init runtime: ${err instanceof Error ? err.message : String(err)}`,
          'error'
        );
      }
    })();
    return () => {
      unsub?.();
      void rt?.cancel('all').catch(() => undefined);
      runtimeRef.current = null;
    };
  }, [addLog]);

  const handleLoad = useCallback(
    async (scenario: PluginScenario) => {
      const rt = runtimeRef.current;
      if (!rt) {
        addLog('Runtime not ready', 'error');
        return;
      }
      setStates((prev) => ({ ...prev, [scenario.id]: { status: 'loading' } }));
      const startedAt = performance.now();
      try {
        await loadPlugin(rt, scenario.build());
        const durationMs = Math.round(performance.now() - startedAt);
        setStates((prev) => ({
          ...prev,
          [scenario.id]: { status: 'loaded', durationMs },
        }));
        addLog(`Loaded "${scenario.label}" in ${durationMs}ms`, 'log');
        await refreshCaps();
      } catch (err) {
        const durationMs = Math.round(performance.now() - startedAt);
        const message = err instanceof Error ? err.message : String(err);
        setStates((prev) => ({
          ...prev,
          [scenario.id]: { status: 'failed', durationMs, error: message },
        }));
        addLog(`Failed to load "${scenario.label}": ${message}`, 'error');
      }
    },
    [addLog, refreshCaps]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">Plugin Loading</h1>
        <p className="mt-0.5 text-xs text-zinc-500">
          loadPlugin() · dynamic runtime extension after construction
        </p>
      </div>

      {/* Info bar */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950/50 px-4 py-2">
        <p className="text-[11px] text-zinc-500">
          Unlike <code className="font-mono text-zinc-400">createLokvis(&#123; plugins &#125;)</code>,
          plugins here are injected on demand. Each load refreshes the capability list.
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            ready ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-900 text-zinc-500'
          }`}
        >
          {ready ? 'runtime ready' : 'initializing…'}
        </span>
      </div>

      {/* 2-column layout: left = plugins, right = capabilities + event log */}
      <div className="grid flex-1 grid-cols-1 gap-px overflow-hidden bg-zinc-800 lg:grid-cols-2">
        {/* Left: Plugins list */}
        <section className="flex flex-col overflow-hidden bg-zinc-950">
          <header className="border-b border-zinc-800/50 px-4 py-2 text-xs font-semibold text-zinc-400">
            Plugins ({SCENARIOS.length})
          </header>
          <div className="flex-1 overflow-auto p-2">
            <ul className="space-y-1.5">
              {SCENARIOS.map((sc) => {
                const st = states[sc.id] ?? { status: 'idle' as const };
                return (
                  <li
                    key={sc.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[11px] text-zinc-200">{sc.label}</div>
                        <div className="mt-0.5 text-[10px] text-indigo-400/80">{sc.source}</div>
                      </div>
                      <button
                        onClick={() => handleLoad(sc)}
                        disabled={st.status === 'loading' || !ready}
                        className="shrink-0 rounded bg-indigo-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {st.status === 'loading' ? 'Loading…' : 'Load'}
                      </button>
                    </div>
                    <p className="mt-1.5 text-[10px] text-zinc-500">{sc.description}</p>
                    <div className="mt-2 flex items-center gap-2 text-[10px]">
                      <StatusBadge state={st} expectFail={sc.expectFail} />
                      {st.durationMs !== undefined && (
                        <span className="font-mono text-zinc-600">{st.durationMs} ms</span>
                      )}
                    </div>
                    {/* error expansion */}
                    {st.status === 'failed' && st.error && (
                      <pre className="mt-2 overflow-auto rounded border border-red-900/50 bg-red-950/30 p-2 font-mono text-[10px] text-red-300">
                        {st.error}
                      </pre>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Right: Capabilities (top) + Event Log (bottom) */}
        <section className="flex flex-col overflow-hidden bg-zinc-950">
          {/* Capabilities */}
          <div className="flex min-h-0 flex-1 flex-col border-b border-zinc-800/50">
            <header className="flex items-center justify-between border-b border-zinc-800/50 px-4 py-2">
              <span className="text-xs font-semibold text-zinc-400">
                Capabilities ({caps.length})
              </span>
              <button
                onClick={refreshCaps}
                className="text-[10px] text-zinc-500 hover:text-zinc-300"
              >
                ↻ Refresh
              </button>
            </header>
            <div className="flex-1 overflow-auto p-2">
              {caps.length === 0 ? (
                <p className="p-4 text-center text-[11px] text-zinc-600">
                  No capabilities yet. Load a plugin →
                </p>
              ) : (
                <ul className="space-y-1">
                  {caps.map((c) => (
                    <li key={c.name} className="rounded bg-zinc-900/50 px-2 py-1.5">
                      <div className="font-mono text-[11px] text-indigo-400">{c.name}</div>
                      <div className="mt-0.5 text-[10px] text-zinc-500">{c.description}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Event Log */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <header className="flex items-center justify-between border-b border-zinc-800/50 px-4 py-2">
              <span className="text-xs font-semibold text-zinc-400">Event Log</span>
              <button
                onClick={() => setLogs([])}
                className="text-[10px] text-zinc-500 hover:text-zinc-300"
              >
                Clear
              </button>
            </header>
            <div className="flex-1 overflow-auto p-2 font-mono text-[10px]">
              {logs.length === 0 ? (
                <p className="p-4 text-center text-zinc-600">
                  plugin:loaded events will appear here…
                </p>
              ) : (
                logs.map((l) => (
                  <div
                    key={l.id}
                    className={`px-1 py-0.5 ${
                      l.type === 'error'
                        ? 'text-red-400'
                        : l.type === 'event'
                        ? 'text-indigo-400'
                        : 'text-zinc-400'
                    }`}
                  >
                    {l.text}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-800 bg-zinc-950/50 px-4 py-2 text-[10px] text-zinc-500">
        <span className="text-zinc-400">Tip:</span> Scenario #4 is expected to fail — load #1
        first, then #4 demonstrates the duplicate-registration error path.
      </div>
    </div>
  );
}

/** 状态徽章 */
function StatusBadge({ state, expectFail }: { state: PluginState; expectFail?: boolean }) {
  const map: Record<PluginState['status'], { label: string; cls: string }> = {
    idle: { label: 'idle', cls: 'bg-zinc-900 text-zinc-500' },
    loading: { label: 'loading', cls: 'bg-amber-950 text-amber-400' },
    loaded: { label: 'loaded', cls: 'bg-emerald-950 text-emerald-400' },
    failed: {
      label: expectFail ? 'failed (expected)' : 'failed',
      cls: 'bg-red-950 text-red-400',
    },
  };
  const { label, cls } = map[state.status];
  return <span className={`rounded-full px-2 py-0.5 font-medium ${cls}`}>{label}</span>;
}
