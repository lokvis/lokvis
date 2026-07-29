/**
 * useLokvisRuntime 工厂(@lokvis/embed-kit 共享)。
 *
 * 各 embed 包的 runtime 初始化 hook 结构完全一致,仅默认插件不同
 * (imageToolsPlugin / pdfToolsPluginWeb / videoToolsPluginWeb)。
 * 本工厂参数化默认插件工厂,各包用 createUseLokvisRuntime(factory) 生成后
 * 以原有导出名 useLokvisRuntime 再导出。
 */
import { useEffect, useRef, useState } from 'react';
import { createLokvis } from '@lokvis/sdk';
import type { LokvisAuthSession, LokvisRuntime, PluginLoadEntry } from '@lokvis/sdk';

export interface UseLokvisRuntimeResult {
  runtime: LokvisRuntime | null;
  ready: boolean;
  error: string | null;
}

/** useLokvisRuntime hook 签名 */
export type UseLokvisRuntime = (
  auth?: LokvisAuthSession,
  plugins?: PluginLoadEntry[]
) => UseLokvisRuntimeResult;

/**
 * 生成绑定了默认插件的 useLokvisRuntime hook。
 *
 * @param defaultPluginsFactory 未显式传 plugins 时使用的默认插件工厂。
 *   传入空数组 `[]` 表示显式不加载任何插件;传 undefined 回落到默认。
 */
export function createUseLokvisRuntime(
  defaultPluginsFactory: () => PluginLoadEntry[]
): UseLokvisRuntime {
  return function useLokvisRuntime(
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
          const resolvedPlugins = pluginsRef.current ?? defaultPluginsFactory();
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authKey, pluginsKey]);

    return { runtime, ready: runtime !== null, error };
  };
}
