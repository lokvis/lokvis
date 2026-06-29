/**
 * Workspace UI 类型定义
 */

import type { Asset, Capability, WorkflowResult } from '@lokvis/schema';

/** 工作台事件（用于事件回调） */
export interface WorkspaceEvent {
  type:
    | 'asset:imported'
    | 'asset:selected'
    | 'asset:removed'
    | 'capability:added'
    | 'workflow:started'
    | 'workflow:completed'
    | 'workflow:failed';
  payload?: unknown;
}

/** 节点状态 */
export type NodeStatus = 'idle' | 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

/** 已添加到工作台的工作流节点 */
export interface WorkspaceNode {
  id: string;
  capability: string;
  params: Record<string, unknown>;
  status: NodeStatus;
  /** 上次执行的耗时（毫秒） */
  duration?: number;
  /** 错误信息 */
  error?: string;
}

/** 工作台运行结果摘要 */
export interface RunSummary {
  result?: WorkflowResult;
  outputs: Asset[];
  duration: number;
}

/** 资产缩略图缓存 */
export type ThumbnailMap = Record<string, string>;

/** 能力映射表（按能力名索引） */
export type CapabilityMap = Record<string, Capability>;
