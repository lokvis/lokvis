/**
 * Demo 1: Runtime Basics
 *
 * 展示 @lokvis/sdk 的核心 API：
 *   - createLokvis() 工厂
 *   - importAsset({ kind: 'file', file }) 资产导入
 *   - listAssets() 资产列表
 *   - capabilities() 能力声明查询
 *   - eventBus.onAny() 事件订阅
 *
 * 所有数据持久化在浏览器（OPFS/IDB 降级），不上传。
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { createLokvis } from '@lokvis/sdk';
import type { LokvisRuntime, Capability, Asset } from '@lokvis/sdk';
import { imageToolsPlugin } from '@lokvis/plugin-image';
import { devToolsPlugin } from '@lokvis/plugin-dev';

interface LogEntry {
  id: number;
  text: string;
  type: 'log' | 'event' | 'error';
}

let counter = 0;

export default function RuntimeDemo() {
  const [runtime, setRuntime] = useState<LokvisRuntime | null>(null);
  const [caps, setCaps] = useState<Capability[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logBoxRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((text: string, type: LogEntry['type'] = 'log') => {
    setLogs((prev) => [...prev.slice(-200), { id: ++counter, text, type }]);
  }, []);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let rt: LokvisRuntime | undefined;
    (async () => {
      try {
        rt = await createLokvis({ plugins: [imageToolsPlugin(), devToolsPlugin()] });
        setRuntime(rt);
        const list = await rt.capabilities();
        setCaps(list);
        const asts = await rt.listAssets();
        setAssets(asts);
        unsub = rt.eventBus.onAny((e) => {
          addLog(`[${e.type}]`, 'event');
        });
        addLog(`Runtime ready · ${list.length} capabilities registered`, 'log');
      } catch (err) {
        addLog(`Failed to init runtime: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    })();
    return () => {
      unsub?.();
      void rt?.cancel('all');
    };
  }, [addLog]);

  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
  }, [logs]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!runtime || !e.target.files?.length) return;
    try {
      for (const file of Array.from(e.target.files)) {
        const id = await runtime.importAsset({ kind: 'file', file });
        addLog(`Imported: ${file.name} → ${id}`, 'log');
      }
      setAssets(await runtime.listAssets());
    } catch (err) {
      addLog(`Import failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }

  async function handleRemove(id: string) {
    if (!runtime) return;
    try {
      await runtime.removeAsset(id);
      setAssets(await runtime.listAssets());
      addLog(`Removed: ${id}`, 'log');
    } catch (err) {
      addLog(`Remove failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">Runtime Basics</h1>
        <p className="mt-0.5 text-xs text-zinc-500">createLokvis · importAsset · capabilities · eventBus</p>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-px overflow-hidden bg-zinc-800 lg:grid-cols-3">
        {/* Capabilities */}
        <section className="flex flex-col overflow-hidden bg-zinc-950">
          <header className="border-b border-zinc-800/50 px-4 py-2 text-xs font-semibold text-zinc-400">
            Capabilities ({caps.length})
          </header>
          <div className="flex-1 overflow-auto p-2">
            {caps.length === 0 ? (
              <p className="p-4 text-center text-[11px] text-zinc-600">Loading…</p>
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
        </section>

        {/* Assets */}
        <section className="flex flex-col overflow-hidden bg-zinc-950">
          <header className="flex items-center justify-between border-b border-zinc-800/50 px-4 py-2">
            <span className="text-xs font-semibold text-zinc-400">Assets ({assets.length})</span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-indigo-500"
            >
              + Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
          </header>
          <div className="flex-1 overflow-auto p-2">
            {assets.length === 0 ? (
              <p className="p-4 text-center text-[11px] text-zinc-600">No assets. Click + Upload.</p>
            ) : (
              <ul className="space-y-1">
                {assets.map((a) => {
                  const basename = a.blob.path.split('/').pop() ?? a.blob.path;
                  return (
                    <li key={a.id} className="flex items-center justify-between rounded bg-zinc-900/50 px-2 py-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-[10px] text-zinc-300">{basename}</div>
                        <div className="mt-0.5 text-[10px] text-zinc-600">
                          {(a.metadata.size / 1024).toFixed(1)} KB · {a.metadata.format}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemove(a.id)}
                        className="ml-2 text-[10px] text-zinc-500 hover:text-red-400"
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Event Log */}
        <section className="flex flex-col overflow-hidden bg-zinc-950">
          <header className="flex items-center justify-between border-b border-zinc-800/50 px-4 py-2">
            <span className="text-xs font-semibold text-zinc-400">Event Log</span>
            <button
              onClick={() => setLogs([])}
              className="text-[10px] text-zinc-500 hover:text-zinc-300"
            >
              Clear
            </button>
          </header>
          <div ref={logBoxRef} className="flex-1 overflow-auto p-2 font-mono text-[10px]">
            {logs.length === 0 ? (
              <p className="p-4 text-center text-zinc-600">Events will appear here…</p>
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
        </section>
      </div>

      {!runtime && (
        <div className="border-t border-zinc-800 bg-zinc-950 px-4 py-2 text-[10px] text-zinc-500">
          Initializing runtime…
        </div>
      )}
    </div>
  );
}
