/**
 * useLokvisRuntime — 共享 hook,初始化 @lokvis/sdk runtime 并注入 image 插件。
 *
 * 所有工具页(compress/resize/convert/crop/watermark)共用此 hook,
 * 避免每个 demo 重复 init 逻辑。runtime 在组件 unmount 时自动 cancel('all')。
 */
import { useEffect, useState } from 'react';
import { createLokvis } from '@lokvis/sdk';
import type { LokvisRuntime } from '@lokvis/sdk';
import { imageToolsPlugin } from '@lokvis/plugin-image';

export interface UseLokvisRuntimeResult {
  runtime: LokvisRuntime | null;
  ready: boolean;
  error: string | null;
}

export function useLokvisRuntime(): UseLokvisRuntimeResult {
  const [runtime, setRuntime] = useState<LokvisRuntime | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let rt: LokvisRuntime | undefined;
    let cancelled = false;
    (async () => {
      try {
        rt = await createLokvis({ plugins: [imageToolsPlugin()] });
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
  }, []);

  return { runtime, ready: runtime !== null, error };
}
