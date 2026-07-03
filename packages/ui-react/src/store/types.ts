/**
 * Workspace Store 类型定义
 *
 * 把原 store.ts 顶部的 WorkspaceState / WorkspaceActions 抽出,
 * 供各 slice 引用,避免循环依赖。
 */
import type { Asset, Capability } from '@lokvis/schema';
import type { LokvisRuntime } from '@lokvis/runtime';
import type { CapabilityMap, NodeStatus, WorkspaceNode } from '../types.js';

/** 工作台完整状态 */
export interface WorkspaceState {
  /** Runtime 实例 */
  runtime: LokvisRuntime | null;
  /** 是否正在初始化 Runtime */
  initializing: boolean;
  /** 初始化错误 */
  initError: string | null;

  /** 所有已导入资产 */
  assets: Asset[];
  /** 当前选中的资产 ID */
  selectedAssetId: string | null;
  /** 资产缩略图（AssetId → ObjectURL） */
  thumbnails: Record<string, string>;

  /** 所有已注册能力 */
  capabilities: Capability[];
  /** 能力映射表（name → Capability） */
  capabilityMap: CapabilityMap;

  /** 工作流节点序列（线性链） */
  nodes: WorkspaceNode[];
  /** 当前选中的节点 ID */
  selectedNodeId: string | null;

  /** 是否正在执行工作流 */
  running: boolean;
  /** 全局状态消息 */
  statusMessage: string;
  /** 错误信息 */
  error: string | null;

  /** 存储配额使用情况(W6.7):{ usage, quota } 字节,null 表示未查询 */
  storageUsage: { usage: number; quota: number } | null;
}

/** 工作台操作 */
export interface WorkspaceActions {
  /** 初始化 Runtime */
  init(runtime: LokvisRuntime): Promise<void>;
  /** 刷新资产列表 */
  refreshAssets(): Promise<void>;
  /** 刷新能力列表 */
  refreshCapabilities(): Promise<void>;
  /** 导入文件 */
  importFiles(files: File[]): Promise<void>;
  /** 选择资产 */
  selectAsset(id: string | null): void;
  /** 设置缩略图 */
  setThumbnail(id: string, url: string): void;
  /** 删除资产 */
  removeAsset(id: string): Promise<void>;

  /** 添加工作流节点 */
  addNode(capability: string): void;
  /** 更新节点参数 */
  updateNodeParams(id: string, params: Record<string, unknown>): void;
  /** 删除节点 */
  removeNode(id: string): void;
  /** 选择节点 */
  selectNode(id: string | null): void;
  /** 设置节点状态 */
  setNodeStatus(id: string, status: NodeStatus, error?: string, duration?: number): void;

  /** 执行工作流 */
  run(): Promise<Asset[]>;
  /** 设置状态消息 */
  setStatus(message: string): void;
  /** 设置错误 */
  setError(error: string | null): void;
  /** 刷新存储配额使用情况(W6.7) */
  refreshStorageUsage(): Promise<void>;
  /** 清空工作流 */
  clearWorkflow(): void;
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions;

/** 生成节点 ID */
export function genNodeId(): string {
  return `node_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
