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
  EngineSelectionStrategy,
  HistoryEntry,
  McpManifest,
} from '@lokvis/schema';
import type { Workflow, WorkflowResult } from '@lokvis/schema';
import type { EventBus } from '@lokvis/schema';
import type { AssetStore } from './asset-store.js';

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
  /**
   * 引擎选择策略(默认 'first')。
   * 当多个引擎实现同一能力且未显式指定 preferredEngine 时,据此选择:
   * 'first'(注册顺序)/'fastest'(性能最优)/'balanced'(匹配能力声明性能,无则最快)。
   */
  engineStrategy?: EngineSelectionStrategy;
  /**
   * 注入自定义 AssetStore(测试或精细控制用)。
   * 默认由 createRuntime 通过 createAssetStore 工厂自动创建,
   * 按 OPFS → IndexedDB → Memory 降级。
   */
  assetStore?: AssetStore;
}

/** Runtime 状态 */
export type RuntimeStatus = 'idle' | 'running' | 'paused' | 'error';

/**
 * `toMcpManifest()` 选项。
 *
 * - `batchMode`:是否为 batch 模式。`mcpExposure='batch-only'` 的能力
 *   仅在 `batchMode=true` 时暴露(避免单文件误用,见方案 §7.1)。默认 false。
 */
export interface ToMcpManifestOptions {
  batchMode?: boolean;
}

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
  /**
   * 获取工作流当前输出 AssetId（undo/redo 后的"当前"状态）。
   *
   * 用途：
   * - UI 实时展示工作流中间结果
   * - MCP server 查询当前工作流产物
   * - 暂停时检查中间输出
   */
  getCurrentOutputs(workflowId: string): Promise<AssetId[]>;
  /**
   * 销毁工作流的运行时状态（取消运行 + 清空历史栈 + 回收历史 outputs 资产）。
   *
   * 修复 review 报告：原接口无清理入口，长会话累积导致 historyStacks Map
   * 与 AssetStore 中孤儿资产泄漏。ui-react 应在 Workspace 卸载时调用。
   */
  disposeWorkflow(workflowId: string): Promise<void>;

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

  // ─── MCP 暴露(见 docs/AI生态冲击调整方案.md §6) ─────
  /**
   * 生成 MCP server manifest(不启动 server,仅描述当前可被 MCP 暴露的能力)。
   * 用于:
   * 1. @lokvis/mcp-server 注册 tools 前的能力探测
   * 2. Dashboard 展示"可被 AI 调用的能力"
   * 3. 文档站自动生成 MCP tools 列表
   *
   * `options.batchMode` 控制是否暴露 `mcpExposure='batch-only'` 的能力:
   * - 默认 false(单文件模式):不暴露 batch-only 能力
   * - true(batch 模式):暴露 batch-only 能力
   * `mcpExposure='private'` 的能力在任何模式下都不暴露。
   *
   * 注:本方法同步返回 —— manifest 是对 `capabilityRegistry.list()`
   * (同步)的纯计算,无 I/O,故无需 async。`capabilities()` 仍为 async
   * 仅为接口对称性(未来可能涉及异步加载)。
   */
  toMcpManifest(options?: ToMcpManifestOptions): McpManifest;
}
