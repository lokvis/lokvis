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
 *
 * @example 接 cloud session(W17.6)
 * ```tsx
 * const { runtime } = useLokvis({
 *   plugins: [imageToolsPlugin()],
 *   auth: { session: cloudJwt }, // → isPro: true,批量/槽位无上限
 * });
 * ```
 */

import { useEffect, useRef, useState } from 'react';
import { createLokvis } from '@lokvis/sdk';
import type { LokvisRuntime, RuntimeConfig } from '@lokvis/runtime';
import type { LokvisAuthSession, PluginLoadEntry } from '@lokvis/sdk';
import { useWorkspaceStore } from '../store/index.js';

export interface UseLokvisOptions extends RuntimeConfig {
  /** 预加载的插件列表 */
  plugins?: PluginLoadEntry[];
  /** 是否在挂载时自动初始化（默认 true） */
  autoInit?: boolean;
  /**
   * Cloud 注入的认证信息(W17.3 / W17.6)。
   *
   * 透传到 `createLokvis({ auth })`,SDK 据 presence 推导 `isPro`:
   * - 传入非空 `session` 或 `token` 且未显式 `isPro: false` → Pro 模式
   * - 不传 `auth`:保持 free 模式
   *
   * 详见 `@lokvis/sdk` 的 `LokvisAuthSession` 与 `resolveIsPro()` 文档。
   */
  auth?: LokvisAuthSession;
}

export interface UseLokvisResult {
  runtime: LokvisRuntime | null;
  status: 'idle' | 'initializing' | 'ready' | 'error';
  error: string | null;
}

export function useLokvis(options: UseLokvisOptions = {}): UseLokvisResult {
  const { plugins = [], autoInit = true, auth, ...runtimeConfig } = options;
  const [runtime, setRuntime] = useState<LokvisRuntime | null>(null);
  const [status, setStatus] = useState<UseLokvisResult['status']>('idle');
  const [error, setError] = useState<string | null>(null);

  const storeInit = useWorkspaceStore((s) => s.init);

  // 用 useRef 持有 plugins / runtimeConfig / auth / storeInit 的最新值,
  // 避免 effect 依赖这些对象引用导致每次 render 都重新初始化 runtime。
  // effect 仅在 authKey / autoInit 变化时触发,内部从 ref 读取当前值。
  const pluginsRef = useRef(plugins);
  const runtimeConfigRef = useRef(runtimeConfig);
  const authRef = useRef(auth);
  const storeInitRef = useRef(storeInit);
  pluginsRef.current = plugins;
  runtimeConfigRef.current = runtimeConfig;
  authRef.current = auth;
  storeInitRef.current = storeInit;

  // 用 JSON.stringify(auth) 作为 effect 依赖,使 auth 变化时重新初始化。
  // (auth 是对象,直接放依赖数组会因引用变化每次 render 都触发;
  //  JSON.stringify 提供稳定的 primitive 依赖,只在 auth 内容变化时重 init)
  const authKey = JSON.stringify(auth ?? null);

  useEffect(() => {
    if (!autoInit) return;

    let cancelled = false;
    (async () => {
      try {
        setStatus('initializing');
        const rt = await createLokvis({
          ...runtimeConfigRef.current,
          plugins: pluginsRef.current,
          auth: authRef.current,
        });
        if (cancelled) return;
        setRuntime(rt);
        await storeInitRef.current(rt);
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
  }, [authKey, autoInit]);

  return { runtime, status, error };
}
