/**
 * useLokvisRuntime — 共享 hook,初始化 @lokvis/sdk runtime 并注入 PDF 插件。
 *
 * 与 @lokvis/embed-image 内部同名 hook 模式一致,但默认插件为 pdfToolsPluginWeb()。
 * 包内独立维护,避免跨包耦合。
 */
import { useEffect, useRef, useState } from 'react';
import { createLokvis } from '@lokvis/sdk';
import type { LokvisAuthSession, LokvisRuntime, PluginLoadEntry } from '@lokvis/sdk';
import { pdfToolsPluginWeb } from '@lokvis/plugin-pdf/web';

export interface UseLokvisRuntimeResult {
  runtime: LokvisRuntime | null;
  ready: boolean;
  error: string | null;
}

/**
 * @param auth 可选的认证信息。
 * @param plugins 可选的预加载插件列表。undefined 时默认 [pdfToolsPluginWeb()]。
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
        const resolvedPlugins = pluginsRef.current ?? [pdfToolsPluginWeb()];
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
