/**
 * useDebouncedRun - 修改参数后 debounced 自动重跑(W11.2)
 *
 * 监听当前工作流节点序列(含 params),变化后延迟 delay 毫秒自动调用
 * store.run(),实现"修改参数即时预览"。
 *
 * 设计要点:
 *   - 仅在 enabled=true 且 nodes.length>0 且 selectedAssetId 存在时触发
 *   - debounce 避免连续修改(如拖滑块)触发过多执行
 *   - 组件卸载时清除 timer,避免卸载后仍调用 store action
 *   - running 期间不触发新的 run(避免并发执行同一工作流;run() 也有并发保护)
 *   - 用户可手动触发 runNow() 立即执行(取消 pending debounce)
 *
 * 实现说明:
 *   - 主 effect 依赖 [nodesKey, enabled, selectedAssetId, delay](用户输入)
 *   - run / running / nodes.length 通过 ref 读取最新值,避免加入 deps:
 *     - run / running:store action 引用每次 store 变化都变,加入 deps 触发循环重订阅
 *     - nodes.length:节点数量变化必然使 nodesKey(JSON 序列化)变化,
 *       加入 deps 是冗余触发源(节点增减会触发两次 effect 重新计时)
 *   - 这是 React 社区标准模式(避免 effect 与 store action 循环 + 消除冗余触发),非 workaround
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

  // 用 ref 持有最新的 run / running / nodes.length 引用:
  // 主 effect 依赖数组只跟踪用户输入(nodesKey / enabled / selectedAssetId / delay),
  // 不包含 store action 引用(每次 store 变化都生成新函数引用,加入 deps 会
  // 触发 effect 重订阅 → debounce timer 重置 → 无法稳定等待 delay)。
  // nodes.length 同样用 ref 读取:节点数量变化必然导致 nodesKey(JSON 序列化)
  // 变化,nodes.length 在主 effect deps 中是冗余触发源,改用 ref 在 body 中读取
  // 最新值即可(与 run / running 同模式,非 workaround)。
  const runRef = useRef(run);
  const runningRef = useRef(running);
  const nodesLengthRef = useRef(nodes.length);
  useEffect(() => {
    runRef.current = run;
    runningRef.current = running;
    nodesLengthRef.current = nodes.length;
  }, [run, running, nodes.length]);

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
    if (!selectedAssetId || nodesLengthRef.current === 0 || runningRef.current) return;
    void runRef.current();
  }, [clearTimer, selectedAssetId]);

  // 监听节点序列变化。依赖数组为用户输入:
  //   nodesKey(序列化节点) / enabled / selectedAssetId / delay
  // run / running / nodes.length 通过 ref 读取最新值(见上):
  //   - run / running:action 引用每次 store 变化都变,加入 deps 触发循环重订阅
  //   - nodes.length:节点数量变化必然使 nodesKey 变化,加入 deps 是冗余触发源
  useEffect(() => {
    if (!enabled) return;
    if (!selectedAssetId || nodesLengthRef.current === 0 || runningRef.current) return;

    // 清除上一次 pending,重新计时
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    setIsPending(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setIsPending(false);
      // 再次检查 running + 节点非空,避免 timer 排队期间状态已变化
      // (用户手动触发 run / 清空节点)
      if (!runningRef.current && nodesLengthRef.current > 0) {
        void runRef.current();
      }
    }, delay);

    return () => {
      // cleanup:清 timer + 重置 isPending。React 18 卸载后调用 setState 不再 warn,
      // 但 cleanup 仍是正确做法(避免卸载后 timer 触发仍调用 store action)。
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setIsPending(false);
    };
  }, [nodesKey, enabled, selectedAssetId, delay]);

  return {
    enabled,
    setEnabled,
    runNow,
    cancelPending: clearTimer,
    isPending,
  };
}
