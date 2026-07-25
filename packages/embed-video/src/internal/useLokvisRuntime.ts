/**
 * useLokvisRuntime — 共享 hook,初始化 @lokvis/sdk runtime 并注入 Video 插件。
 *
 * 默认插件为 videoToolsPluginWeb()(浏览器版,基于 ffmpeg.wasm,7 个真实操作)。
 * ffmpeg.wasm 懒加载:首次操作时按需拉取 ~32MB wasm,不影响首屏。
 * 三方也可通过 plugins 选项注入自定义处理插件(如 remote-processing plugin)。
 */
import { useEffect, useRef, useState } from 'react';
import { createLokvis } from '@lokvis/sdk';
import type { LokvisAuthSession, LokvisRuntime, PluginLoadEntry } from '@lokvis/sdk';
import { videoToolsPluginWeb } from '@lokvis/plugin-video/web';

export interface UseLokvisRuntimeResult {
  runtime: LokvisRuntime | null;
  ready: boolean;
  error: string | null;
}

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
        const resolvedPlugins = pluginsRef.current ?? [videoToolsPluginWeb()];
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
