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
  ImageMetadata,
  McpManifest,
  PdfInfo,
  PluginConfig,
  PluginInstaller,
} from '@lokvis/schema';
import type { Workflow, WorkflowResult } from '@lokvis/schema';
import type { EventBus } from '@lokvis/schema';
import type { AssetStore } from './asset-store.js';
import type { BatchProcessor } from './batch-processor.js';
import type { HistoryStore, HistoryStoreOptions } from './history-store.js';

/**
 * 待安装的插件条目。
 *
 * 由 SDK 的 `createLokvis({ plugins })` 与 `loadPlugin()` 构造,
 * 交给 `LokvisRuntime.installPlugin()` 在 runtime 内部完成注册
 * (能力声明 + 调用 installer + 发射 plugin:loaded 事件)。
 *
 * 把"插件安装"提升为 Runtime 公共接口,避免 SDK 通过
 * `instanceof LokvisRuntimeImpl` + 私有 `_getAssetStore()` /
 * `_getCapabilityRegistry()` 反向耦合具体实现类。
 */
export interface PluginInstallEntry {
  config: PluginConfig;
  install: PluginInstaller;
}

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
   *
   * 注:`isPro` 仅控制本地批量/槽位门控(四环)。AI 调用配额由
   * `@lokvis/cloud-bridge` 的 `CloudBilling` 据 `plan` 精确判定
   * ('pro' 解锁四环但 AI 配额为 0,需 'cloud_pro' 才有 AI 配额)。
   */
  isPro?: boolean;
  /**
   * 用户订阅计划(G1)。比 `isPro` 更细粒度,用于 AI 调用计费判定。
   * - 'free'(默认):免费用户,isPro=false
   * - 'pro':Pro 订阅($9/月),isPro=true(解锁四环),AI 配额=0
   * - 'cloud_pro':Cloud Pro 订阅,isPro=true,AI 配额=10/天
   * - 'enterprise':企业版,isPro=true,AI 配额=∞
   *
   * 由 SDK 据 `auth.plan` 注入;未传时默认 'free'。
   * `isPro` 派生自 `plan !== 'free'`(在 SDK resolvePlan 中计算)。
   */
  plan?: Plan;
  /**
   * 内存预算(字节,W3.3 MemoryGuard)。
   * 默认 512MB。BatchProcessor 据此在内存压力高时收缩并发槽位。
   */
  memoryBudget?: number;
}

/**
 * Runtime 内部构造参数(W21.6)。
 *
 * `ownsAssetStore` 不出现在公共 `RuntimeConfig` 上,仅供 `createRuntime` 工厂
 * 内部向 `LokvisRuntimeImpl` 传递"assetStore 是否由工厂创建"的标记 —— 工厂
 * 创建的 store 由 Runtime 拥有,dispose() 时负责调用 assetStore.dispose?.();
 * 注入路径由消费方自行管理生命周期。
 *
 * 类型层面 SDK 用户传不进此字段;`LokvisRuntimeImpl` 构造函数另有运行时
 * 守卫,即使 JS 用户绕过类型系统传 `assetStore + ownsAssetStore:true`,
 * 仍会被强制为 false(防止越权清理注入的 store)。
 */
export interface InternalRuntimeInit {
  /** assetStore 是否由 Runtime 拥有(工厂创建路径)。注入路径强制为 false。 */
  ownsAssetStore?: boolean;
}

/** Runtime 状态 */
export type RuntimeStatus = 'idle' | 'running' | 'paused' | 'error';

/**
 * 用户订阅计划(G1)。
 *
 * 与 `@lokvis/cloud-bridge` 的 `AuthenticatedUser.plan` 对齐,但收窄为字面量联合
 * (cloud-bridge 保留 `string` 以兼容未来新增 plan 而无需发版)。
 *
 * - `free`:免费用户,本地工具无限制,cloud AI 不可用
 * - `pro`:Pro 订阅($9/月),解锁本地四环门控,cloud AI 仍不可用(配额=0)
 * - `cloud_pro`:Cloud Pro 订阅,解锁四环 + cloud AI 配额(10/天)
 * - `enterprise`:企业版,无任何限制
 *
 * `isPro` 派生自 `plan !== 'free'`。AI 调用配额由 `CloudBilling.planQuotas` 判定。
 */
export type Plan = 'free' | 'pro' | 'cloud_pro' | 'enterprise';

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
  /**
   * 用户订阅计划(G1)。比 `isPro` 更细粒度,用于 AI 调用计费判定。
   * `isPro === (plan !== 'free')`,二者保持一致。
   */
  readonly plan: Plan;
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
  /**
   * 销毁整个 Runtime:取消所有运行中 workflow + 批处理任务,
   * 清空所有历史栈(触发 outputs 资产回收),清理 eventBus 订阅。
   *
   * W21.6: 修复长会话 / SPA 卸载场景的资源泄漏。在以下时机调用:
   * - SPA 整体卸载(window beforeunload 或 React root unmount)
   * - 测试 afterEach 清理
   * - 消费方明确知道不再使用此 runtime 实例时
   *
   * AssetStore 的清理策略:
   * - 若 Runtime 通过 createRuntime 工厂创建 store(默认路径):dispose()
   *   会调用 assetStore.dispose?.() 关闭 Dexie 连接 / 清空内存 Map
   * - 若消费方注入 store(config.assetStore):Runtime 不清理,由消费方
   *   在合适的时机调用 store.dispose?.()
   *
   * 调用 dispose() 后再调 run()/cancel() 等方法会抛 'Runtime is disposed'。
   * 幂等:重复调用为 no-op。
   */
  dispose(): Promise<void>;

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
  /**
   * 读取 image 资产的 dimensions/format 元数据。
   *
   * 走 MetadataReader 机制(与 readAssetExif 同一设计):Runtime 持有
   * plugin-image 通过 `ctx.registerMetadataReader('image.read-metadata', fn)`
   * 注册的 reader 引用,按名调用。reader 内部调 engine-image/node 的
   * getMetadata(sharp .metadata())。
   *
   * 用途:mcp-server 在 image tool 处理完成后,读取输出 Blob 的精确尺寸
   * 用于结果文本报告。Plugin 未安装时优雅降级返回 null。
   *
   * 架构意义:使 mcp-server 不再直接 import @lokvis/engine-image(违反
   * 五层架构单向依赖),改为通过 Runtime 间接调用(见 A1 修复)。
   *
   * @param id 资产 ID(须为 image 类型)
   * @returns ImageMetadata;非 image / reader 未注册 / 解析失败返回 null
   */
  readAssetImageMetadata(id: AssetId): Promise<ImageMetadata | null>;
  /**
   * 读取 pdf 资产的页数。
   *
   * 走 MetadataReader 机制:Runtime 持有 plugin-pdf 通过
   * `ctx.registerMetadataReader('pdf.read-info', fn)` 注册的 reader 引用,
   * 按名调用。reader 内部调 engine-pdf 的 getPdfInfo(pdf-lib getPageCount)。
   *
   * 用途:mcp-server 在 pdf tool 处理完成后,读取输出 Blob 的页数用于结果
   * 文本报告。Plugin 未安装时优雅降级返回 null。
   *
   * 架构意义:使 mcp-server 不再直接 import @lokvis/engine-pdf(违反
   * 五层架构单向依赖),改为通过 Runtime 间接调用(见 A1 修复)。
   *
   * @param id 资产 ID(须为 pdf 类型)
   * @returns PdfInfo;非 pdf / reader 未注册 / 解析失败返回 null
   */
  readAssetPdfInfo(id: AssetId): Promise<PdfInfo | null>;
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
  /**
   * 检查能力是否仅有 stub 实现(无可用引擎)。
   *
   * UI 层据此为 stub-only 能力显示 "Coming Soon" 标记(A7),
   * 避免用户选择后在工作流执行阶段才收到 stub error。
   * 返回 true 表示该能力已声明但仅有占位实现,resolve() 会跳过。
   */
  isStubOnly(name: string): Promise<boolean>;

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

  // ─── 插件安装 ────────────────────────────────────────
  /**
   * 在 Runtime 上安装一个插件。
   *
   * 步骤:
   * 1. 把 plugin.config.capabilities 注册到 CapabilityRegistry(声明能力)
   * 2. 构造受限 PluginContext(只暴露 getAsset/importAsset/getAssetBlob/
   *    createAsset/listCapabilities + eventBus + registerCapability +
   *    registerMetadataReader + registerPanel + log)
   * 3. 调用 plugin.install(ctx),让插件注册 CapabilityImplementation
   * 4. 发射 `plugin:loaded` 事件
   *
   * SDK 的 `createLokvis({ plugins })` 与 `loadPlugin()` 都委托到这里,
   * 不再需要 `instanceof LokvisRuntimeImpl` + `_getAssetStore()` 等内部 API。
   *
   * @throws plugin.install 抛出的任何错误(runtime 不吞错,由 SDK 包成 PluginLoadError)
   */
  installPlugin(plugin: PluginInstallEntry): Promise<void>;
}
