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
  ExifData,
  HistoryEntry,
  McpManifest,
} from '@lokvis/schema';
import type { Workflow, WorkflowResult } from '@lokvis/schema';
import type { EventBus } from '@lokvis/schema';
import type { AssetStore } from './asset-store.js';
import type { BatchProcessor } from './batch-processor.js';
import type { HistoryStore, HistoryStoreOptions } from './history-store.js';

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
  /**
   * 注入自定义 HistoryStore(W7.2 历史持久化)。
   * 默认由 createRuntime 在 enableIndexedDB 时通过 createHistoryStore 自动创建;
   * IndexedDB 不可用时为 undefined,历史退化为仅内存模式。
   */
  historyStore?: HistoryStore;
  /**
   * HistoryStore 工厂选项(W7.2,仅 historyStore 未注入时生效)。
   * 测试可注入 dbInstance 或自定义 dbName。
   */
  historyStoreOptions?: HistoryStoreOptions;
  /**
   * 是否启用 Pro 模式(W6.2 / PROJECT_PLAN 17.4)。
   * - false(默认):批量上限 10 文件、并发 4、workflow 槽位 5
   * - true:批量无上限、并发 16、workflow 槽位无限
   * 由 cloud 侧 createLokvis({ auth }) 注入 session 后置为 true。
   */
  isPro?: boolean;
  /**
   * 内存预算(字节,W3.3 MemoryGuard)。
   * 默认 512MB。BatchProcessor 据此在内存压力高时收缩并发槽位。
   */
  memoryBudget?: number;
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

/**
 * `run()` 选项。
 *
 * - `appendHistory`:为 true 时,同一工作流 ID 的后续 run() 在已有历史栈上
 *   追加条目(支持跨次 undo/redo 链,如 playground HistoryDemo 的连续滤镜)。
 *   默认 false —— 每次 run() 重置历史栈,与"重新执行"语义一致。
 */
export interface RunOptions {
  appendHistory?: boolean;
}

/** 核心 Runtime API（第一版，必须克制） */
export interface LokvisRuntime {
  /** Runtime 版本 */
  readonly version: string;
  /** 当前状态 */
  readonly status: RuntimeStatus;
  /** 事件总线 */
  readonly eventBus: EventBus;
  /** 是否为 Pro 模式(影响批量上限/并发槽位/workflow 数,W6.2) */
  readonly isPro: boolean;
  /** 批量处理器(W6.1:并发控制 + 进度 + 失败重试) */
  readonly batch: BatchProcessor;

  // ─── 工作流执行 ──────────────────────────────────────
  /** 运行工作流 */
  run(workflow: Workflow, inputs: AssetId[] | Asset[], options?: RunOptions): Promise<WorkflowResult>;
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
  /**
   * 获取工作流历史状态(条目 + 当前游标)。
   * 游标 -1 表示无已应用条目(初始状态);i 表示第 i 条已应用。
   * 比 history() 多返回 cursor,UI 据此高亮当前步骤。
   */
  getHistoryState(
    workflowId: string
  ): Promise<{ entries: HistoryEntry[]; cursor: number }>;
  /** 撤销一步 */
  undo(workflowId: string): Promise<void>;
  /** 重做一步 */
  redo(workflowId: string): Promise<void>;
  /**
   * 跳转到指定历史条目(按时间顺序的索引,-1 表示回到初始)。
   * 用于 HistoryPanel 点击条目直接跳转,等价于连续 undo/redo 到目标位置。
   * 越界或游标未变时为 no-op。
   */
  jumpTo(workflowId: string, index: number): Promise<void>;

  // ─── Asset 管理 ──────────────────────────────────────
  /** 导入资产 */
  importAsset(source: AssetSource): Promise<AssetId>;
  /** 获取资产 */
  getAsset(id: AssetId): Promise<Asset>;
  /** 导出资产为 Blob */
  exportAsset(id: AssetId, format?: string): Promise<Blob>;
  /**
   * 读取 image 资产的 EXIF 元数据(W7.3/7.4)。
   *
   * 长期方案(MetadataReader 依赖反转):Runtime 持有 plugin-image 通过
   * `ctx.registerMetadataReader('image.read-exif', fn)` 注册的读取器引用,
   * 按名调用。Plugin 未安装时优雅降级返回 null。
   * readExif 实现位于 plugin-image(Capability 层),不进 engine-image
   * (不符合 Engine 层 Blob↔Blob 纯函数约束)。
   * UI 通过此方法访问 EXIF,不直接依赖 Engine/Plugin 包(五层架构单向依赖)。
   *
   * @param id 资产 ID(须为 image 类型)
   * @returns ExifData;非 image / 无 EXIF / 解析失败 / reader 未注册返回 null
   */
  readAssetExif(id: AssetId): Promise<ExifData | null>;
  /** 删除资产 */
  removeAsset(id: AssetId): Promise<void>;
  /** 列出所有资产 */
  listAssets(): Promise<Asset[]>;
  /**
   * 查询存储配额使用情况(W6.7)。
   *
   * 返回 `{ usage, quota }`:
   * - `usage`:当前已用字节数(所有资产 metadata.size 之和)
   * - `quota`:配置的存储配额上限(RuntimeConfig.storageQuota,默认 1GB)
   *
   * UI 据此展示"已用/总额"进度条,接近上限(>=80%)时警告。
   * 注意:usage 基于 listAssets 实时计算,反映 runtime 实际占用,
   * 与浏览器 `navigator.storage.estimate()`(origin 整体 OPFS)不同。
   */
  getStorageUsage(): Promise<{ usage: number; quota: number }>;

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
