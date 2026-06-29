/**
 * useLokvis - 在 React 中初始化 Lokvis Runtime 并加载插件
 *
 * @example
 * ```tsx
 * import { useLokvis } from '@lokvis/ui-react';
 * import imageToolsPlugin from '@lokvis/plugin-image';
 *
 * function App() {
 *   const { runtime, status, error } = useLokvis({
 *     plugins: [imageToolsPlugin()],
 *   });
 *   if (!runtime) return <p>Loading...</p>;
 *   return <Workspace />;
 * }
 * ```
 */

import { useEffect, useRef, useState } from 'react';
import { createLokvis } from '@lokvis/sdk';
import type { LokvisRuntime, RuntimeConfig } from '@lokvis/runtime';
import type { PluginLoadEntry } from '@lokvis/sdk';
import { useWorkspaceStore } from '../store.js';

export interface UseLokvisOptions extends RuntimeConfig {
  /** 预加载的插件列表 */
  plugins?: PluginLoadEntry[];
  /** 是否在挂载时自动初始化（默认 true） */
  autoInit?: boolean;
}

export interface UseLokvisResult {
  runtime: LokvisRuntime | null;
  status: 'idle' | 'initializing' | 'ready' | 'error';
  error: string | null;
}

export function useLokvis(options: UseLokvisOptions = {}): UseLokvisResult {
  const { plugins = [], autoInit = true, ...runtimeConfig } = options;
  const [runtime, setRuntime] = useState<LokvisRuntime | null>(null);
  const [status, setStatus] = useState<UseLokvisResult['status']>('idle');
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);

  const storeInit = useWorkspaceStore((s) => s.init);

  useEffect(() => {
    if (!autoInit || initRef.current) return;
    initRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        setStatus('initializing');
        const rt = await createLokvis({
          ...runtimeConfig,
          plugins,
        });
        if (cancelled) return;
        setRuntime(rt);
        await storeInit(rt);
        if (cancelled) return;
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { runtime, status, error };
}
