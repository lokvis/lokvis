/**
 * Demo: SDK Basics
 *
 * 展示 @lokvis/sdk 的 `createLokvis()` 工厂——SDK 的唯一入口。
 *
 * 演示 3 种典型构造方式:
 *   1. 默认(无插件):createLokvis() —— 空运行时,只有内置能力
 *   2. 预加载插件:createLokvis({ plugins: [imageToolsPlugin(), devToolsPlugin()] })
 *   3. 自定义 RuntimeConfig:createLokvis({ enableOpfs, enableIndexedDB, storageQuota, ... })
 *
 * 输出对比:capabilities 数量 / runtime.version / runtime.status / isPro。
 *
 * W14.2 任务:apps/playground/src/components/SdkDemo.tsx
 */
import { useEffect, useState, useCallback } from 'react';
import { createLokvis } from '@lokvis/sdk';
import type { LokvisRuntime, Capability, RuntimeConfig } from '@lokvis/sdk';
import { imageToolsPlugin } from '@lokvis/plugin-image';
import { devToolsPlugin } from '@lokvis/plugin-dev';

/** 单次构造结果 */
interface ConstructResult {
  /** 配置标签 */
  label: string;
  /** 传入 createLokvis 的 options 概览(JSON) */
  optionsJson: string;
  /** 构造耗时(ms) */
  durationMs: number;
  /** 构造错误 */
  error?: string;
  /** 构造成功后的运行时快照 */
  snapshot?: {
    version: string;
    status: string;
    isPro: boolean;
    capabilitiesCount: number;
    capabilityNames: string[];
  };
}

/** 三种构造配置 */
const CONFIGS: Array<{
  label: string;
  options: RuntimeConfig & { plugins?: unknown[] };
}> = [
  { label: 'Default (no plugins)', options: {} },
  {
    label: 'With imageTools + devTools',
    options: { plugins: [imageToolsPlugin(), devToolsPlugin()] },
  },
  {
    label: 'Custom config (memory-only, 256MB quota)',
    options: {
      enableOpfs: false,
      enableIndexedDB: false,
      storageQuota: 256 * 1024 * 1024,
      engineStrategy: 'first',
      memoryBudget: 128 * 1024 * 1024,
    },
  },
];

export default function SdkDemo() {
  const [results, setResults] = useState<ConstructResult[]>([]);
  const [running, setRunning] = useState(false);
  const [runtimes, setRuntimes] = useState<LokvisRuntime[]>([]);

  const runAll = useCallback(async () => {
    setRunning(true);
    setResults([]);
    // 清理上一轮 runtime
    await Promise.all(runtimes.map((rt) => rt.cancel('all').catch(() => undefined)));
    setRuntimes([]);

    const collected: ConstructResult[] = [];
    const created: LokvisRuntime[] = [];

    for (const cfg of CONFIGS) {
      const startedAt = performance.now();
      const result: ConstructResult = {
        label: cfg.label,
        optionsJson: JSON.stringify(
          {
            ...cfg.options,
            // plugins 数组无法序列化,替换为长度
            plugins: Array.isArray(cfg.options.plugins)
              ? `<${cfg.options.plugins.length} plugin(s)>`
              : undefined,
          },
          null,
          2
        ),
        durationMs: 0,
      };
      try {
        const rt = await createLokvis(cfg.options as never);
        const caps: Capability[] = await rt.capabilities();
        result.durationMs = Math.round(performance.now() - startedAt);
        result.snapshot = {
          version: rt.version,
          status: rt.status,
          isPro: rt.isPro,
          capabilitiesCount: caps.length,
          capabilityNames: caps.map((c) => c.name),
        };
        created.push(rt);
      } catch (err) {
        result.durationMs = Math.round(performance.now() - startedAt);
        result.error = err instanceof Error ? err.message : String(err);
      }
      collected.push(result);
      setResults([...collected]);
    }

    setRuntimes(created);
    setRunning(false);
  }, [runtimes]);

  // 卸载时清理
  useEffect(() => {
    return () => {
      runtimes.forEach((rt) => void rt.cancel('all').catch(() => undefined));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">SDK Basics</h1>
        <p className="mt-0.5 text-xs text-zinc-500">
          createLokvis() · 3 configurations side-by-side
        </p>
      </div>

      {/* 顶部说明 + 操作 */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950/50 px-4 py-2">
        <p className="text-[11px] text-zinc-500">
          Compare default / with plugins / custom RuntimeConfig. All runtimes
          run locally — no upload.
        </p>
        <button
          onClick={runAll}
          disabled={running}
          className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? 'Running…' : '▶ Run all 3'}
        </button>
      </div>

      {/* 结果区:3 列对比 */}
      <div className="grid flex-1 grid-cols-1 gap-px overflow-auto bg-zinc-800 lg:grid-cols-3">
        {CONFIGS.map((cfg, idx) => {
          const result = results[idx];
          return (
            <section
              key={cfg.label}
              className="flex flex-col overflow-hidden bg-zinc-950"
            >
              <header className="border-b border-zinc-800/50 px-4 py-2">
                <div className="text-xs font-semibold text-zinc-200">
                  {cfg.label}
                </div>
                <div className="mt-1 text-[10px] text-zinc-500">
                  {result ? (
                    <>
                      <span
                        className={
                          result.error ? 'text-red-400' : 'text-emerald-400'
                        }
                      >
                        {result.error ? '✕ failed' : '✓ constructed'}
                      </span>
                      <span className="mx-1.5 text-zinc-700">·</span>
                      <span>{result.durationMs} ms</span>
                    </>
                  ) : (
                    <span className="text-zinc-600">pending</span>
                  )}
                </div>
              </header>

              <div className="flex-1 overflow-auto p-3">
                {/* options JSON */}
                <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                  Options
                </h3>
                <pre className="mb-3 overflow-auto rounded border border-zinc-800 bg-zinc-900/50 p-2 font-mono text-[10px] text-zinc-300">
                  {result?.optionsJson ?? JSON.stringify(cfg.options, null, 2)}
                </pre>

                {/* snapshot */}
                {result?.snapshot && (
                  <>
                    <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                      Runtime Snapshot
                    </h3>
                    <dl className="mb-3 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
                      <dt className="text-zinc-500">version</dt>
                      <dd className="font-mono text-zinc-300">
                        {result.snapshot.version}
                      </dd>
                      <dt className="text-zinc-500">status</dt>
                      <dd className="font-mono text-zinc-300">
                        {result.snapshot.status}
                      </dd>
                      <dt className="text-zinc-500">isPro</dt>
                      <dd className="font-mono text-zinc-300">
                        {String(result.snapshot.isPro)}
                      </dd>
                      <dt className="text-zinc-500">capabilities</dt>
                      <dd className="font-mono text-indigo-400">
                        {result.snapshot.capabilitiesCount}
                      </dd>
                    </dl>

                    {result.snapshot.capabilityNames.length > 0 && (
                      <>
                        <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                          Capability Names
                        </h3>
                        <div className="flex flex-wrap gap-1">
                          {result.snapshot.capabilityNames.map((name) => (
                            <span
                              key={name}
                              className="rounded-full bg-indigo-950 px-2 py-0.5 font-mono text-[10px] text-indigo-400"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* error */}
                {result?.error && (
                  <>
                    <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-red-500">
                      Error
                    </h3>
                    <pre className="overflow-auto rounded border border-red-900/50 bg-red-950/30 p-2 font-mono text-[10px] text-red-300">
                      {result.error}
                    </pre>
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* 底部说明 */}
      <div className="border-t border-zinc-800 bg-zinc-950/50 px-4 py-2 text-[10px] text-zinc-500">
        <span className="text-zinc-400">Tip:</span> The first config registers
        0 capabilities (no plugins loaded). The second registers image + dev
        capabilities. The third shows how to opt out of OPFS/IDB for ephemeral
        sessions.
      </div>
    </div>
  );
}
