/**
 * useDebouncedRun - 修改参数后 debounced 自动重跑(W11.2)
 *
 * 监听当前工作流节点序列(含 params),变化后延迟 delay 毫秒自动调用
 * store.run(),实现"修改参数即时预览"。
 *
 * 设计要点:
 *   - 仅在 enabled=true 且 nodes.length>0 且 selectedAssetId 存在时触发
 *   - debounce 避免连续修改(如拖滑块)触发过多执行
 *   - 组件卸载时清除 timer,避免 setState on unmounted
 *   - running 期间不触发新的 run(避免并发执行同一工作流)
 *   - 用户可手动触发 runNow() 立即执行(取消 pending debounce)
 *
 * 典型用法:
 * ```tsx
 * const { enabled, setEnabled, runNow } = useDebouncedRun({ delay: 400 });
 * <Toggle checked={enabled} onChange={setEnabled} label="实时预览" />
 * ```
 *
 * @module useDebouncedRun
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspaceStore } from '../store/index.js';

export interface UseDebouncedRunOptions {
  /** 防抖延迟毫秒(默认 400ms,平衡响应性与性能) */
  delay?: number;
  /** 初始是否启用(默认 false,需用户显式开启避免意外执行) */
  initialEnabled?: boolean;
}

export interface UseDebouncedRunResult {
  /** 当前是否启用自动运行 */
  enabled: boolean;
  /** 切换启用状态 */
  setEnabled: (v: boolean) => void;
  /** 立即触发运行(取消 pending debounce) */
  runNow: () => void;
  /** 取消 pending debounce(不取消正在运行的) */
  cancelPending: () => void;
  /** 是否有 pending 的执行(等待 debounce 触发) */
  isPending: boolean;
}

/** 序列化节点序列用于变化检测(params 嵌套对象需稳定序列化) */
function serializeNodes(
  nodes: ReadonlyArray<{ capability: string; params: Record<string, unknown> }>
): string {
  return JSON.stringify(
    nodes.map((n) => ({ c: n.capability, p: n.params }))
  );
}

export function useDebouncedRun(
  options: UseDebouncedRunOptions = {}
): UseDebouncedRunResult {
  const { delay = 400, initialEnabled = false } = options;
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, setIsPending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nodes = useWorkspaceStore((s) => s.nodes);
  const selectedAssetId = useWorkspaceStore((s) => s.selectedAssetId);
  const running = useWorkspaceStore((s) => s.running);
  const run = useWorkspaceStore((s) => s.run);

  // 序列化节点,作为 debounce 触发依赖
  const nodesKey = serializeNodes(nodes);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPending(false);
  }, []);

  const runNow = useCallback(() => {
    clearTimer();
    if (!selectedAssetId || nodes.length === 0 || running) return;
    void run();
  }, [clearTimer, selectedAssetId, nodes.length, running, run]);

  // 监听节点序列变化
  useEffect(() => {
    if (!enabled) return;
    if (!selectedAssetId || nodes.length === 0 || running) return;

    // 清除上一次 pending,重新计时
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    setIsPending(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setIsPending(false);
      void run();
    }, delay);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setIsPending(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesKey, enabled, selectedAssetId, delay]);

  // 卸载时清除 timer
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return {
    enabled,
    setEnabled,
    runNow,
    cancelPending: clearTimer,
    isPending,
  };
}
