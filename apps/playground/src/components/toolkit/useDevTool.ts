/**
 * useDevTool — Developer 工具页共享 hook(R1)
 *
 * 初始化 @lokvis/sdk runtime 并注入 devToolsPlugin(plugin-dev)。
 * 提供 execute(capability, params) 方法:构造单节点 workflow → run → 读 JSON 输出。
 *
 * 与 useLokvisRuntime 区别:
 * - useLokvisRuntime 注入 imageToolsPlugin(加载 Canvas 引擎),适用于图像工具
 * - useDevTool 注入 devToolsPlugin(内联引擎,无外部依赖),适用于 Developer 工具
 *
 * Developer 工具的输入都是 params 内联文本(pattern/testText/left/right/input/token 等),
 * 不需要文件上传,因此 execute 不接受 inputTexts 参数。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createLokvis } from '@lokvis/sdk';
import type { LokvisRuntime } from '@lokvis/sdk';
import { WorkflowBuilder } from '@lokvis/workflow';
import { devToolsPlugin } from '@lokvis/plugin-dev';

export interface UseDevToolResult {
  runtime: LokvisRuntime | null;
  ready: boolean;
  initError: string | null;
  busy: boolean;
  error: string | null;
  result: unknown;
  execute: (capability: string, params: Record<string, unknown>) => Promise<void>;
  clearError: () => void;
  clearResult: () => void;
}

export function useDevTool(): UseDevToolResult {
  const [runtime, setRuntime] = useState<LokvisRuntime | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  const rtRef = useRef<LokvisRuntime | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rt = await createLokvis({ plugins: [devToolsPlugin()] });
        if (cancelled) {
          void rt.cancel('all');
          return;
        }
        rtRef.current = rt;
        setRuntime(rt);
      } catch (err) {
        if (!cancelled) {
          setInitError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
      void rtRef.current?.cancel('all');
    };
  }, []);

  const execute = useCallback(
    async (capability: string, params: Record<string, unknown>) => {
      if (!rtRef.current) return;
      setBusy(true);
      setError(null);
      try {
        const wf = new WorkflowBuilder({
          id: `dev-${capability}-${Date.now()}`,
          name: 'Developer Tool',
          category: 'developer',
        })
          .setInput({ type: 'data', multiple: false })
          .setOutput({ type: 'data', format: 'json' })
          .add(capability, params)
          .build();

        // Developer 工具的输入都在 params 中,但 workflow 要求至少一个输入 asset
        // 创建一个空文本 asset 作为输入占位
        const inputId = await rtRef.current.importAsset({
          kind: 'file',
          file: new File([''], 'dev-input.txt', { type: 'text/plain' }),
        });

        const runResult = await rtRef.current.run(wf, [inputId]);
        if (runResult.status === 'completed' && runResult.outputs[0]) {
          const blob = await rtRef.current.exportAsset(runResult.outputs[0]);
          const text = await blob.text();
          try {
            setResult(JSON.parse(text));
          } catch {
            setResult(text);
          }
        } else {
          setError(runResult.error ?? '执行失败');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setResult(null);
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const clearError = useCallback(() => setError(null), []);
  const clearResult = useCallback(() => setResult(null), []);

  return {
    runtime,
    ready: runtime !== null,
    initError,
    busy,
    error,
    result,
    execute,
    clearError,
    clearResult,
  };
}
