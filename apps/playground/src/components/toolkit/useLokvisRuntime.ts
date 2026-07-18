/**
 * useLokvisRuntime — 共享 hook,初始化 @lokvis/sdk runtime 并注入 image 插件。
 *
 * 所有工具页(compress/resize/convert/crop/watermark)共用此 hook,
 * 避免每个 demo 重复 init 逻辑。runtime 在组件 unmount 时自动 cancel('all')。
 *
 * G1:接受可选 `auth` 参数,支持 playground 模拟 Free / Pro / Cloud Pro 模式,
 * 用于测试 Pro 门控(四环:batch/concurrency/workflow slots/presets)。
 */
import { useEffect, useRef, useState } from 'react';
import { createLokvis } from '@lokvis/sdk';
import type { LokvisAuthSession, LokvisRuntime } from '@lokvis/sdk';
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
 */
export function useLokvisRuntime(auth?: LokvisAuthSession): UseLokvisRuntimeResult {
  const [runtime, setRuntime] = useState<LokvisRuntime | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 用 ref 跟踪最新 auth,避免每次渲染都重建 runtime。
  // 仅当 plan 变化时才重建(authKey 作 effect 依赖)。
  const authRef = useRef(auth);
  authRef.current = auth;
  const authKey = auth?.plan ?? 'free';

  useEffect(() => {
    let rt: LokvisRuntime | undefined;
    let cancelled = false;
    (async () => {
      try {
        rt = await createLokvis({ plugins: [imageToolsPlugin()], auth: authRef.current });
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
  }, [authKey]);

  return { runtime, ready: runtime !== null, error };
}
