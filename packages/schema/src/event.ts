/**
 * Lokvis Event Bus Types
 *
 * 所有操作发出标准事件，Analytics/Undo/AI/Plugin 都监听事件，无需侵入核心逻辑。
 */

import type { Asset, AssetId, AssetMetadata } from './asset.js';
import type { Workflow, WorkflowResult } from './workflow.js';
import type { HistoryEntry } from './asset.js';

/** Lokvis 标准事件类型联合 */
export type LokvisEvent =
  | { type: 'asset:imported'; assetId: AssetId; metadata: AssetMetadata }
  | { type: 'asset:removed'; assetId: AssetId }
  | { type: 'workflow:started'; workflowId: string; workflow: Workflow }
  | { type: 'workflow:paused'; workflowId: string }
  | { type: 'workflow:resumed'; workflowId: string }
  | { type: 'workflow:cancelled'; workflowId: string }
  | { type: 'node:started'; workflowId: string; nodeId: string; inputs: Asset[] }
  | {
      type: 'node:finished';
      workflowId: string;
      nodeId: string;
      capability: string;
      params: Record<string, unknown>;
      outputs: Asset[];
      duration: number;
    }
  | {
      type: 'node:failed';
      workflowId: string;
      nodeId: string;
      error: Error;
    }
  | { type: 'workflow:completed'; workflowId: string; result: WorkflowResult }
  | {
      type: 'export:completed';
      assetId: AssetId;
      format: string;
      size: number;
    }
  | {
      type: 'history:changed';
      workflowId: string;
      entries: HistoryEntry[];
      /** 当前游标(指向最后一条已应用的 entry;-1 表示无已应用条目) */
      currentIndex: number;
    }
  | { type: 'capability:registered'; capability: string; engine: string }
  | { type: 'plugin:loaded'; name: string; version: string };

/** 所有事件类型字面量 */
export type LokvisEventType = LokvisEvent['type'];

/** 事件处理器函数 */
export type EventHandler<T extends LokvisEvent> = (event: T) => void;

/** 事件总线接口 */
export interface EventBus {
  /**
   * 订阅事件
   * @returns 取消订阅函数
   */
  on<T extends LokvisEventType>(
    type: T,
    handler: (event: Extract<LokvisEvent, { type: T }>) => void
  ): () => void;

  /** 订阅所有事件（用于日志、分析） */
  onAny(handler: (event: LokvisEvent) => void): () => void;

  /** 发出事件 */
  emit(event: LokvisEvent): void;

  /** 清除所有订阅 */
  clear(): void;
}
