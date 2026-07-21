/**
 * useLokvisRuntime — 共享 hook,初始化 @lokvis/sdk runtime 并注入插件。
 *
 * 所有工具页(compress/resize/convert/crop/watermark)共用此 hook,
 * 避免每个 demo 重复 init 逻辑。runtime 在组件 unmount 时自动 cancel('all')。
 *
 * G1:接受可选 `auth` 参数,支持 playground 模拟 Free / Pro / Cloud Pro 模式,
 * 用于测试 Pro 门控(四环:batch/concurrency/workflow slots/presets)。
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
 * @param auth 可选的认证信息(用于模拟 plan)。G1:playground 通过 plan toggle 注入。
 *   - 不传或 undefined:free 模式(默认)
 *   - { plan: 'pro' }:Pro 模式(解锁四环,无 AI 配额)
 *   - { plan: 'cloud_pro' }:Cloud Pro 模式(解锁四环 + AI 配额)
 *   - { plan: 'enterprise' }:企业模式(无任何限制)
 * @param plugins 可选的预加载插件列表。
 *   - undefined(默认):加载 [imageToolsPlugin()](向后兼容)
 *   - []:显式不加载任何插件(纯 Runtime 容器场景)
 *   - [imageToolsPlugin(), audioToolsPlugin(), ...]:三方组合多个媒体插件
 */
export function useLokvisRuntime(
  auth?: LokvisAuthSession,
  plugins?: PluginLoadEntry[]
): UseLokvisRuntimeResult {
  const [runtime, setRuntime] = useState<LokvisRuntime | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 用 ref 跟踪最新 auth/plugins,避免每次渲染都重建 runtime。
  // 仅当 plan 或 plugin set 变化时才重建(authKey + pluginsKey 作 effect 依赖)。
  const authRef = useRef(auth);
  authRef.current = auth;
  const pluginsRef = useRef(plugins);
  pluginsRef.current = plugins;
  const authKey = auth?.plan ?? 'free';
  // pluginsKey:据插件 config.name 列表判定是否需要重建(避免数组引用每渲染都变)
  const pluginsKey = plugins?.map((p) => p.config.name).join(',') ?? '__default__';

  useEffect(() => {
    let rt: LokvisRuntime | undefined;
    let cancelled = false;
    (async () => {
      try {
        // undefined → 默认 imageToolsPlugin;传入数组(含空数组)→ 原样使用
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
