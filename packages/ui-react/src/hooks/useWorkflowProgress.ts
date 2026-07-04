/**
 * useWorkflowProgress - 工作流执行进度(W11.6,review 抽取)
 *
 * 单一来源计算节点执行进度,供 ProgressBar / StatusBar 共用,
 * 避免两组件各自从 nodes 重复计算 done/total/pct。
 *
 * 计算口径:
 *   - done: 已结束节点(success + failed + cancelled)
 *   - failedCount: 失败节点数(用于红色高亮)
 *   - pct: 完成百分比(0-100),total=0 时为 0
 *
 * @module useWorkflowProgress
 */

import { useWorkspaceStore } from '../store/index.js';

export interface WorkflowProgress {
  /** 节点总数 */
  total: number;
  /** 已结束节点数(success + failed + cancelled) */
  done: number;
  /** 失败节点数 */
  failedCount: number;
  /** 完成百分比(0-100) */
  pct: number;
  /** 是否有失败节点 */
  hasFailure: boolean;
}

/** 计算工作流执行进度(单一来源,供 ProgressBar / StatusBar 共用) */
export function useWorkflowProgress(): WorkflowProgress {
  const nodes = useWorkspaceStore((s) => s.nodes);
  const total = nodes.length;
  const done = nodes.filter(
    (n) => n.status === 'success' || n.status === 'failed' || n.status === 'cancelled'
  ).length;
  const failedCount = nodes.filter((n) => n.status === 'failed').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const hasFailure = failedCount > 0;
  return { total, done, failedCount, pct, hasFailure };
}
