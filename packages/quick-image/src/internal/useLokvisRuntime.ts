/**
 * useLokvisRuntime — 共享 hook,初始化 @lokvis/sdk runtime 并注入插件。
 *
 * @lokvis/quick-image 内部副本,与 apps/playground/src/components/toolkit/useLokvisRuntime.ts
 * 保持一致。包内独立维护,避免与 playground 相互耦合。
 *
 * W23:接受可选 `plugins` 参数,三方接入可在同一 Runtime 内组合 image / audio /
 * pdf / video 插件。不传或 undefined 时回落到默认 [imageToolsPlugin()](向后兼容);
 * 传入空数组 `[]` 表示显式不加载任何插件(用于纯 Runtime 容器场景)。
 */
import { useEffect, useRef, useState } from 'react';
import { createLokvis } from '@lokvis/sdk';
import type { LokvisAuthSession, LokvisRuntime, PluginLoadEntry } from '@lokvis/sdk';
import { imageToolsPlugin } from '@lokvis/plugin-image';

export interface UseLokvisRuntimeResult {
  runtime: LokvisRuntime | null;
  ready: boolean;
  error: string | null;
}

/**
 * @param auth 可选的认证信息。
 * @param plugins 可选的预加载插件列表。
 */
export function useLokvisRuntime(
  auth?: LokvisAuthSession,
  plugins?: PluginLoadEntry[]
): UseLokvisRuntimeResult {
  const [runtime, setRuntime] = useState<LokvisRuntime | null>(null);
  const [error, setError] = useState<string | null>(null);

  const authRef = useRef(auth);
  authRef.current = auth;
  const pluginsRef = useRef(plugins);
  pluginsRef.current = plugins;
  const authKey = auth?.plan ?? 'free';
  const pluginsKey = plugins?.map((p) => p.config.name).join(',') ?? '__default__';

  useEffect(() => {
    let rt: LokvisRuntime | undefined;
    let cancelled = false;
    (async () => {
      try {
        const resolvedPlugins = pluginsRef.current ?? [imageToolsPlugin()];
        rt = await createLokvis({ plugins: resolvedPlugins, auth: authRef.current });
        if (cancelled) {
          void rt.cancel('all');
          return;
        }
        setRuntime(rt);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
      void rt?.cancel('all');
    };
  }, [authKey, pluginsKey]);

  return { runtime, ready: runtime !== null, error };
}
