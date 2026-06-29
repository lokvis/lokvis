/**
 * Lokvis Runtime API
 *
 * Runtime 是整个系统的"浏览器操作系统"，唯一职责：Input → Run → Output。
 * 第一版必须克制，只暴露最小 API。
 */

import type {
  Asset,
  AssetId,
  AssetSource,
  Capability,
  HistoryEntry,
} from '@lokvis/schema';
import type { Workflow, WorkflowResult } from '@lokvis/schema';
import type { EventBus } from '@lokvis/schema';

/** Runtime 配置 */
export interface RuntimeConfig {
  /** 是否启用 OPFS（默认 true，降级时关闭） */
  enableOpfs?: boolean;
  /** 是否启用 IndexedDB 元数据存储 */
  enableIndexedDB?: boolean;
  /** 存储配额（字节） */
  storageQuota?: number;
  /** 是否启用日志 */
  enableLog?: boolean;
}

/** Runtime 状态 */
export type RuntimeStatus = 'idle' | 'running' | 'paused' | 'error';

/** 核心 Runtime API（第一版，必须克制） */
export interface LokvisRuntime {
  /** Runtime 版本 */
  readonly version: string;
  /** 当前状态 */
  readonly status: RuntimeStatus;
  /** 事件总线 */
  readonly eventBus: EventBus;

  // ─── 工作流执行 ──────────────────────────────────────
  /** 运行工作流 */
  run(workflow: Workflow, inputs: AssetId[] | Asset[]): Promise<WorkflowResult>;
  /** 取消运行 */
  cancel(workflowId: string): Promise<void>;
  /** 暂停运行 */
  pause(workflowId: string): Promise<void>;
  /** 恢复运行 */
  resume(workflowId: string): Promise<void>;

  // ─── 历史与撤销 ──────────────────────────────────────
  /** 获取工作流的执行历史 */
  history(workflowId: string): Promise<HistoryEntry[]>;
  /** 撤销一步 */
  undo(workflowId: string): Promise<void>;
  /** 重做一步 */
  redo(workflowId: string): Promise<void>;

  // ─── Asset 管理 ──────────────────────────────────────
  /** 导入资产 */
  importAsset(source: AssetSource): Promise<AssetId>;
  /** 获取资产 */
  getAsset(id: AssetId): Promise<Asset>;
  /** 导出资产为 Blob */
  exportAsset(id: AssetId, format?: string): Promise<Blob>;
  /** 删除资产 */
  removeAsset(id: AssetId): Promise<void>;
  /** 列出所有资产 */
  listAssets(): Promise<Asset[]>;

  // ─── 能力查询 ────────────────────────────────────────
  /** 列出所有已注册能力 */
  capabilities(): Promise<Capability[]>;
  /** 检查能力是否可用 */
  hasCapability(name: string): Promise<boolean>;
}
