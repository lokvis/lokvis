/**
 * Workspace Store 类型定义
 *
 * 把原 store.ts 顶部的 WorkspaceState / WorkspaceActions 抽出,
 * 供各 slice 引用,避免循环依赖。
 */
import type { Asset, Capability, HistoryEntry } from '@lokvis/schema';
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
  /**
   * 最近一次 importFiles 成功导入的 Asset ID 列表(导入顺序)。
   *
   * 仅在 refreshAssets 完成后写入,保证 ID 对应的资产已在 store.assets 中。
   * 供 focused 模式自动选中新导入资产(useFocusedAutoSelect)使用——
   * 不能用"assets 差分检测新资产"替代:工作流输出也会进入 assets,
   * 差分法会把输出误判为新导入资产并抢占选中状态。
   */
  lastImportedIds: string[];

  /** 所有已注册能力 */
  capabilities: Capability[];
  /** 能力映射表（name → Capability） */
  capabilityMap: CapabilityMap;
  /**
   * 仅有 stub 实现的能力名集合(A7)。
   * UI 据此为 stub-only 能力显示 "Coming Soon" 标记,
   * 避免用户选择后在工作流执行阶段才收到 stub error。
   */
  stubCapabilities: Set<string>;

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
  /**
   * 错误事件序号(单调递增)。每次 setError(非 null) 都递增,使
   * ErrorBanner 能在相同错误消息重复出现时仍感知到"新错误事件"重新弹出。
   * null error 不递增。0 表示初始无错误状态。
   */
  errorSeq: number;

  /** 存储配额使用情况(W6.7):{ usage, quota } 字节,null 表示未查询 */
  storageUsage: { usage: number; quota: number } | null;

  /** 历史栈条目(W7.1):当前活跃工作流的执行历史 */
  historyEntries: HistoryEntry[];
  /** 历史栈游标(W7.1):-1 表示无已应用条目(初始);i 表示第 i 条已应用 */
  historyCursor: number;
  /** 当前历史所属的工作流 ID(W7.1) */
  historyWorkflowId: string | null;

  /** 上次工作流执行的输出 Asset ID 列表(W9.4/W9.5):用于 before/after 对比与下载管理 */
  lastOutputIds: string[];
  /** 当前选中的输出 Asset ID(W9.4):用于多输出场景选择 */
  selectedOutputId: string | null;

  /** 当前正在运行的工作流 ID(W11.6:用于 cancel) */
  currentRunId: string | null;
}

/** 工作台操作 */
export interface WorkspaceActions {
  /** 初始化 Runtime */
  init(runtime: LokvisRuntime): Promise<void>;
  /** 刷新资产列表 */
  refreshAssets(): Promise<void>;
  /** 刷新能力列表 */
  refreshCapabilities(): Promise<void>;
  /**
   * 导入文件,返回导入成功的 Asset ID 列表(导入顺序)。
   *
   * 全部导入完成并 refreshAssets 后,同时把 ID 列表写入
   * `lastImportedIds`,供 focused 模式自动选中(useFocusedAutoSelect)。
   */
  importFiles(files: File[]): Promise<string[]>;
  /** 选择资产 */
  selectAsset(id: string | null): void;
  /**
   * 设置缩略图(TD-5.1:替换时自动 revoke 旧 ObjectURL,集中管理生命周期)。
   * 主要由 ensureThumbnails 内部调用,外部一般不直接使用。
   */
  setThumbnail(id: string, url: string): void;
  /**
   * 为所有缺少缩略图的 image 资产异步生成 ObjectURL 缩略图(TD-5.1 长期方案)。
   *
   * 集中管理缩略图 ObjectURL 的创建:iterate assets → exportAsset →
   * createObjectURL → setThumbnail(revoke 旧 URL)。inflight 去重 + 资产
   * 存在性检查避免孤儿 URL。AssetPanel 只需在 effect 中调用此方法并读取
   * store.thumbnails,创建/替换/释放全部在 store 内统一。
   */
  ensureThumbnails(): void;
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
  /**
   * 移动节点到新位置(线性链重排,W10.4)。
   * @param from 源索引(0-based)
   * @param to 目标索引(0-based,移动后该节点的新位置)
   */
  moveNode(from: number, to: number): void;
  /**
   * 在指定位置插入节点(W11.1)。
   * @param index 目标位置(0-based;越界时自动 clamp 到 [0, length])
   * @param capability 能力名
   */
  insertNodeAt(index: number, capability: string): void;

  /** 执行工作流 */
  run(): Promise<Asset[]>;
  /** 取消当前运行(W11.6) */
  cancelRun(): Promise<void>;
  /**
   * 应用工作流模板(W11.4):替换当前 nodes 为模板节点序列。
   * @param templateNodes 模板节点(capability + 默认 params)
   */
  loadWorkflowTemplate(
    templateNodes: Array<{ capability: string; params: Record<string, unknown> }>
  ): void;
  /** 设置状态消息 */
  setStatus(message: string): void;
  /** 设置错误 */
  setError(error: string | null): void;
  /** 刷新存储配额使用情况(W6.7) */
  refreshStorageUsage(): Promise<void>;
  /** 刷新历史栈(W7.1) */
  refreshHistory(workflowId: string): Promise<void>;
  /** 撤销一步(W7.1) */
  undo(): Promise<void>;
  /** 重做一步(W7.1) */
  redo(): Promise<void>;
  /** 跳转到指定历史条目(W7.1) */
  jumpToHistory(index: number): Promise<void>;
  /** 清空工作流 */
  clearWorkflow(): void;
  /** 选择输出资产(W9.4) */
  selectOutput(id: string | null): void;
  /** 清空上次输出列表(W9.4/W9.5) */
  clearOutputs(): void;
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions;

/** 生成节点 ID */
export function genNodeId(): string {
  return `node_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
