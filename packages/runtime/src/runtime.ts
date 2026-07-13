/**
 * Lokvis Runtime Implementation
 *
 * Runtime 是整个系统的"浏览器操作系统"，唯一职责：Input → Run → Output。
 */

import type {
  Asset,
  AssetId,
  AssetSource,
  Capability,
  CapabilityParam,
  CapabilityParamType,
  ExifData,
  HistoryEntry,
  McpManifest,
  McpToolManifest,
  MetadataReader,
  PanelDefinition,
  PluginContext,
} from '@lokvis/schema';
import type { Workflow, WorkflowResult } from '@lokvis/schema';
import { validateWorkflow } from '@lokvis/schema';
import type {
  LokvisRuntime,
  PluginInstallEntry,
  RuntimeConfig,
  RuntimeStatus,
  ToMcpManifestOptions,
} from './types.js';
import type { EventBus } from '@lokvis/schema';
import { createEventBus } from './event-bus.js';
import {
  createAssetStore,
  createMemoryAssetStore,
  type AssetStore,
} from './asset-store.js';
import { CapabilityRegistry } from './capability-registry.js';
import { WorkflowExecutor } from './executor.js';
import { MAX_WORKFLOW_STEPS } from './workflow-builder.js';
import {
  createHistoryStore,
  type HistoryStore,
} from './history-store.js';
import { BatchProcessor } from './batch-processor.js';
import { MemoryGuard, DEFAULT_MEMORY_BUDGET } from './memory-guard.js';
import {
  wrapAssetStoreWithQuota,
  type QuotaAwareAssetStore,
} from './managers/quota-manager.js';
import { AssetManager } from './managers/asset-manager.js';
import { HistoryManager } from './managers/history-manager.js';
// QuotaExceededError 仅作 re-export,保持 `@lokvis/runtime` 的对外导出路径不变
// (SDK / 测试 / 集成代码均从 runtime 包入口导入该错误类型)
export { QuotaExceededError } from './managers/quota-manager.js';

export const RUNTIME_VERSION = '0.1.0';

/** Runtime 实现类 */
export class LokvisRuntimeImpl implements LokvisRuntime {
  readonly version = RUNTIME_VERSION;
  readonly eventBus: EventBus;

  private config: Required<Omit<RuntimeConfig, 'assetStore' | 'historyStore' | 'historyStoreOptions'>>;
  private _status: RuntimeStatus = 'idle';
  /**
   * AssetStore 实例。类型为 QuotaAwareAssetStore —— 由 wrapAssetStoreWithQuota
   * 返回(在构造函数中无条件包裹,即使是注入的 assetStore 也会被包装以提供配额校验)。
   * 保留 _getQuotaUsage 内部 API 供 getStorageUsage O(1) 读取 usage。
   * 注:外部注入的 assetStore 在 wrapAssetStoreWithQuota 中同样被包装,
   * 因此所有路径下 this.assetStore 都是 QuotaAwareAssetStore。
   */
  private assetStore: QuotaAwareAssetStore;
  /**
   * AssetManager:资产操作封装(import/get/export/remove/list/exif/usage)。
   * 由 RuntimeImpl 在构造函数中创建,所有资产方法委托给它。
   * metadataReaders 由 Runtime 持有(供 _registerMetadataReader 写入),
   * 通过引用共享给 AssetManager(Plugin 注册后立即可见)。
   */
  private assetManager: AssetManager;
  private capabilityRegistry: CapabilityRegistry;
  private executor: WorkflowExecutor;
  private memoryGuard: MemoryGuard;
  private batchProcessor: BatchProcessor;
  /**
   * HistoryManager:历史栈管理封装(W1.3 抽取)。
   * 持有 historyStacks / initialInputs / currentOutputs / 持久化守卫等状态,
   * 内部订阅 node:finished 自动 append;run()/disposeWorkflow() 通过
   * prepareForRun / recordRunResult / disposeHistory 协调。
   * historyStore 由 Runtime 持有(供 createRuntime 工厂语义清晰),
   * 同时通过 deps 注入 HistoryManager。
   */
  private historyManager: HistoryManager;
  /**
   * 历史持久化存储(W7.2)。undefined 时退化为仅内存历史(刷新后丢失)。
   * 由 createRuntime 在 enableIndexedDB 时自动创建,或通过 config 注入。
   */
  private historyStore: HistoryStore | undefined;

  /**
   * 元数据读取器注册表(W7.3/7.4 长期方案:MetadataReader 依赖反转)。
   *
   * Plugin(plugin-image)通过 PluginContext.registerMetadataReader 注册
   * 查询函数(如 'image.read-exif'),Runtime 持有引用并按名调用。
   * 解决了 readExif(Blob→ExifData)不符合 Engine 层 Blob↔Blob 纯函数约束、
   * 也不符合 CapabilityImplementation Asset[]→Asset[] 契约的问题。
   * UI 经 runtime.readAssetExif 间接调用,不直接依赖 plugin/engine。
   */
  private metadataReaders = new Map<string, MetadataReader>();

  /**
   * 注册元数据读取器(由 PluginContext.registerMetadataReader 转发)。
   * 下划线前缀表示内部 API,不暴露在 LokvisRuntime 公开接口。
   */
  _registerMetadataReader(name: string, reader: MetadataReader): void {
    this.metadataReaders.set(name, reader);
  }

  constructor(config: RuntimeConfig = {}) {
    this.config = {
      enableOpfs: config.enableOpfs ?? true,
      enableIndexedDB: config.enableIndexedDB ?? true,
      storageQuota: config.storageQuota ?? 1024 * 1024 * 1024, // 1GB
      enableLog: config.enableLog ?? true,
      engineStrategy: config.engineStrategy ?? 'first',
      isPro: config.isPro ?? false,
      memoryBudget: config.memoryBudget ?? DEFAULT_MEMORY_BUDGET,
    };

    this.eventBus = createEventBus();

    // 注入或降级到内存 store;随后用配额校验包裹(W2.9)
    // M6 修复:enableOpfs/enableIndexedDB 仅在 createLokvis()/createRuntime
    // 工厂中生效(工厂按 flag 调 createAssetStore 选择 OPFS→IDB→Memory)。
    // 直接 new LokvisRuntimeImpl 且未传 assetStore 时,无法同步等待 createAssetStore,
    // 兜底用 Memory store;若用户显式期望持久化,提示其用 createLokvis()。
    if (!config.assetStore && (this.config.enableOpfs || this.config.enableIndexedDB)) {
      console.warn(
        '[lokvis] LokvisRuntimeImpl constructed without assetStore: ' +
          'enableOpfs/enableIndexedDB flags are ignored. ' +
          'Use createLokvis() to respect these flags, or pass an assetStore explicitly.'
      );
    }
    const rawStore = config.assetStore ?? createMemoryAssetStore();
    this.assetStore = wrapAssetStoreWithQuota(rawStore, this.config.storageQuota);

    // AssetManager:资产操作封装。metadataReaders 由 Runtime 持有,
    // Plugin 通过 _registerMetadataReader 写入后,AssetManager 通过引用立即可见
    this.assetManager = new AssetManager({
      assetStore: this.assetStore,
      eventBus: this.eventBus,
      metadataReaders: this.metadataReaders,
      storageQuota: this.config.storageQuota,
    });

    // W7.2 历史持久化:优先用注入的 historyStore;否则在 createRuntime 工厂中
    // 由 createHistoryStore 自动创建并注入。直接 new Impl 时为 undefined,
    // 历史退化为仅内存模式(与 W2 行为一致)。
    this.historyStore = config.historyStore;

    // HistoryManager:历史栈管理封装(W1.3)。内部订阅 node:finished 自动 append,
    // 持有 historyStacks / initialInputs / currentOutputs / 持久化守卫等状态。
    this.historyManager = new HistoryManager({
      eventBus: this.eventBus,
      assetStore: this.assetStore,
      historyStore: this.historyStore,
    });

    this.capabilityRegistry = new CapabilityRegistry(this.config.engineStrategy);

    this.executor = new WorkflowExecutor({
      assetStore: this.assetStore,
      capabilityRegistry: this.capabilityRegistry,
      eventBus: this.eventBus,
      enableLog: this.config.enableLog,
    });

    // W3.3 MemoryGuard:追踪中间结果占用,达到 high 阈值时建议 OPFS 溢出。
    // BatchProcessor 据此动态收缩并发槽位(W6.1)。
    this.memoryGuard = new MemoryGuard({
      budget: this.config.memoryBudget,
      assetStore: this.assetStore,
    });

    // W6.1 BatchProcessor:把 W5 playground 的并发/进度/重试逻辑下沉到 runtime。
    // 注入 this(实现 LokvisRuntime 接口),不直接依赖 LokvisRuntimeImpl 避免循环引用。
    this.batchProcessor = new BatchProcessor({
      runtime: this,
      eventBus: this.eventBus,
      isPro: this.config.isPro,
      memoryGuard: this.memoryGuard,
    });
  }

  get status(): RuntimeStatus {
    return this._status;
  }

  get isPro(): boolean {
    return this.config.isPro;
  }

  get batch(): BatchProcessor {
    return this.batchProcessor;
  }

  // ─── 工作流执行 ──────────────────────────────────────

  async run(
    workflow: Workflow,
    inputs: AssetId[] | Asset[],
    options?: import('./types.js').RunOptions
  ): Promise<WorkflowResult> {
    this._status = 'running';

    // Schema 层校验：在 executor.execute 之前调用 validateWorkflow，
    // 让结构问题（保留字哨兵 __input__、悬挂 edge、自环、重复 id、真环）
    // 在入口处暴露，错误信息精准（如 "Edge from __input__ references a
    // reserved sentinel id"），而不是被 executor 拓扑排序误判为含糊的 "cycle"。
    // 三层防御的第 3 层（前两层：executor 防御性校验 + 单元测试覆盖）。
    //
    // W10.2/W10.3 增强:
    //   - resolveCapability 回调注入 capability 兼容性校验(相邻节点
    //     outputTypes 与 inputTypes 必须有交集;输入/输出节点类型与
    //     workflow.inputs/outputs.type 兼容)
    //   - maxSteps: 5(由 MAX_WORKFLOW_STEPS 常量定义,M1 MVP 约束)
    const validation = validateWorkflow(workflow, {
      maxSteps: MAX_WORKFLOW_STEPS,
      resolveCapability: (name) => {
        const cap = this.capabilityRegistry.get(name);
        if (!cap) return undefined;
        return {
          inputTypes: cap.inputTypes,
          outputTypes: cap.outputTypes,
        };
      },
    });
    if (!validation.success) {
      this._status = 'error';
      const error = validation.error.issues
        .map((i) => i.message)
        .join('; ');
      const result: WorkflowResult = {
        workflowId: workflow.id,
        outputs: [],
        duration: 0,
        status: 'failed',
        error,
      };
      this.eventBus.emit({
        type: 'workflow:completed',
        workflowId: workflow.id,
        result,
      });
      return result;
    }

    // 历史栈管理(委托 HistoryManager):
    // - 默认:每次 run() 重置历史(重跑语义),并通过 onEvict 回收旧 outputs 资产
    // - appendHistory:true:保留已有历史栈,支持跨次 undo/redo 链(如连续滤镜)
    const inputIds = await this.collectInputAssetIds(inputs);
    this.historyManager.prepareForRun(
      workflow.id,
      inputIds,
      options?.appendHistory ?? false
    );

    try {
      const result = await this.executor.execute(workflow, inputs);
      this._status = result.status === 'failed' ? 'error' : 'idle';
      // 成功完成后,记录最终输出为当前
      if (result.status === 'completed') {
        this.historyManager.recordRunResult(workflow.id, result.outputs);
      }
      return result;
    } catch (error) {
      this._status = 'error';
      throw error;
    }
  }

  async cancel(workflowId: string): Promise<void> {
    return this.executor.cancel(workflowId);
  }

  async pause(workflowId: string): Promise<void> {
    return this.executor.pause(workflowId);
  }

  async resume(workflowId: string): Promise<void> {
    return this.executor.resume(workflowId);
  }

  /**
   * 销毁指定工作流的运行时状态（W2.8 内存治理）。
   *
   * 调用时机：
   *   - ui-react 卸载 Workspace 组件时
   *   - 用户主动关闭工作流标签页时
   *
   * 行为：
   *   - 调用 stack.reset() 触发 onEvict → assetStore.remove 回收历史 outputs 资产
   *   - 从 historyStacks / initialInputsMap / currentOutputsMap 三 Map 中删除 entry
   *   - 调用 executor.cancel 取消运行中的执行（若有）
   *
   * 修复 review 报告：原实现无清理入口,Workflow 组件卸载后 Map 中残留 entry,
   * 长会话累积导致内存与 OPFS 空间双泄漏。
   */
  async disposeWorkflow(workflowId: string): Promise<void> {
    await this.cancel(workflowId).catch((err) => {
      // 工作流可能未在运行(常见情况,不抛错);其他真实错误(Worker 崩溃 /
      // executor 异常)只 warn 不阻断 dispose 流程,避免清理路径被卡住
      console.warn(
        `[lokvis] disposeWorkflow: cancel(${workflowId}) failed:`,
        err
      );
    });
    // 历史栈清理委托 HistoryManager(reset 触发 onEvict → assetStore.remove 回收资产)
    this.historyManager.disposeHistory(workflowId);
  }

  // ─── 历史与撤销(委托 HistoryManager) ──────────────────

  async history(workflowId: string): Promise<HistoryEntry[]> {
    return this.historyManager.history(workflowId);
  }

  async getHistoryState(
    workflowId: string
  ): Promise<{ entries: HistoryEntry[]; cursor: number }> {
    return this.historyManager.getHistoryState(workflowId);
  }

  async undo(workflowId: string): Promise<void> {
    return this.historyManager.undo(workflowId);
  }

  async redo(workflowId: string): Promise<void> {
    return this.historyManager.redo(workflowId);
  }

  async jumpTo(workflowId: string, index: number): Promise<void> {
    return this.historyManager.jumpTo(workflowId, index);
  }

  // ─── Asset 管理(委托给 AssetManager) ─────────────────

  async importAsset(source: AssetSource): Promise<AssetId> {
    return this.assetManager.importAsset(source);
  }

  async getAsset(id: AssetId): Promise<Asset> {
    return this.assetManager.getAsset(id);
  }

  async exportAsset(id: AssetId, format?: string): Promise<Blob> {
    return this.assetManager.exportAsset(id, format);
  }

  async readAssetExif(id: AssetId): Promise<ExifData | null> {
    return this.assetManager.readAssetExif(id);
  }

  async removeAsset(id: AssetId): Promise<void> {
    return this.assetManager.removeAsset(id);
  }

  async listAssets(): Promise<Asset[]> {
    return this.assetManager.listAssets();
  }

  async getStorageUsage(): Promise<{ usage: number; quota: number }> {
    return this.assetManager.getStorageUsage();
  }

  // ─── 能力查询 ────────────────────────────────────────

  async capabilities(): Promise<Capability[]> {
    return this.capabilityRegistry.list();
  }

  async hasCapability(name: string): Promise<boolean> {
    return this.capabilityRegistry.has(name);
  }

  async isStubOnly(name: string): Promise<boolean> {
    return this.capabilityRegistry.isStubOnly(name);
  }

  // ─── MCP 暴露(见 docs/AI生态冲击调整方案.md §6) ─────

  /**
   * 生成 MCP server manifest(不启动 server,仅描述当前可被 MCP 暴露的能力)。
   * - `mcpExposure='private'`:任何模式都不暴露
   * - `mcpExposure='batch-only'`:仅在 `options.batchMode=true` 时暴露
   *   (避免单文件误用)
   * - 其余(默认 'public'):总是暴露
   * - tool 名取 capability.mcpToolName 或 `lokvis_${name.replace(/\./g, '_')}`
   * - resource 固定为 capabilities 与 workflows 两个清单
   */
  toMcpManifest(options: ToMcpManifestOptions = {}): McpManifest {
    const { batchMode = false } = options;
    const tools: McpToolManifest[] = [];
    const capabilities = this.capabilityRegistry.list();

    for (const cap of capabilities) {
      // private 任何模式都不暴露
      if (cap.mcpExposure === 'private') continue;
      // batch-only 仅在 batch 模式暴露(避免单文件误用)
      if (cap.mcpExposure === 'batch-only' && !batchMode) continue;
      const toolName =
        cap.mcpToolName ?? `lokvis_${cap.name.replace(/\./g, '_')}`;
      tools.push({
        name: toolName,
        description: cap.description,
        inputSchema: capabilityParamsToJsonSchema(cap.params),
        capabilities: [cap.name],
      });
    }

    return {
      serverName: 'lokvis',
      version: RUNTIME_VERSION,
      tools,
      resources: [
        {
          uri: 'lokvis://capabilities',
          name: 'Capabilities',
          description: 'List all available Lokvis capabilities',
          mimeType: 'application/json',
        },
        {
          uri: 'lokvis://workflows',
          name: 'Workflows',
          description: 'List saved workflows',
          mimeType: 'application/json',
        },
      ],
    };
  }

  // ─── 插件安装 ────────────────────────────────────────

  /**
   * 在本 Runtime 上安装一个插件(实现 LokvisRuntime.installPlugin 接口)。
   *
   * 步骤:
   * 1. 注册能力声明(plugin.config.capabilities → CapabilityRegistry)
   * 2. 构造受限 PluginContext(只暴露受限 Runtime API + 注册器 + 日志)
   * 3. 调用 plugin.install(ctx),让插件注册 CapabilityImplementation
   * 4. 发射 `plugin:loaded` 事件
   *
   * 不吞错:plugin.install 抛出的错误原样上抛,由 SDK 包成 PluginLoadError。
   *
   * 此前 SDK 通过 `instanceof LokvisRuntimeImpl` + `_getAssetStore()` /
   * `_getCapabilityRegistry()` 反向访问内部依赖,现改为公共接口调用,
   * SDK 不再依赖具体实现类。
   */
  async installPlugin(plugin: PluginInstallEntry): Promise<void> {
    for (const capability of plugin.config.capabilities) {
      this.capabilityRegistry.registerCapability(capability);
    }
    const ctx = createPluginContext(plugin.config.name, this);
    await plugin.install(ctx);
    this.eventBus.emit({
      type: 'plugin:loaded',
      name: plugin.config.name,
      version: plugin.config.version,
    });
  }

  // ─── 内部 API（供测试使用,SDK 不再调用） ──────────────

  /** 获取 AssetStore(仅测试用,SDK 通过 installPlugin 间接访问) */
  _getAssetStore(): AssetStore {
    return this.assetStore;
  }

  /** 获取 CapabilityRegistry(仅测试用,SDK 通过 installPlugin 间接访问) */
  _getCapabilityRegistry(): CapabilityRegistry {
    return this.capabilityRegistry;
  }

  /**
   * 获取 MemoryGuard(内部用,供集成测试驱动内存压力验证 BatchProcessor 收缩)。
   */
  _getMemoryGuard(): MemoryGuard {
    return this.memoryGuard;
  }

  /** 获取工作流当前输出 AssetId（undo/redo 后的"当前"状态,内部用） */
  _getCurrentOutputs(workflowId: string): AssetId[] {
    return this.historyManager.getCurrentOutputs(workflowId);
  }

  /** 获取工作流当前输出 AssetId（公开 API，供 UI / MCP 查询） */
  async getCurrentOutputs(workflowId: string): Promise<AssetId[]> {
    return this._getCurrentOutputs(workflowId);
  }

  // ─── 私有:工作流辅助 ──────────────────────────────

  /** 将输入归一化为 AssetId[]（run() 入参可为 AssetId[] 或 Asset[]） */
  private async collectInputAssetIds(
    inputs: AssetId[] | Asset[]
  ): Promise<AssetId[]> {
    if (inputs.length === 0) return [];
    if (typeof inputs[0] === 'string') {
      return inputs as AssetId[];
    }
    return (inputs as Asset[]).map((a) => a.id);
  }

  /**
   * 从 historyStore 预加载所有持久化的历史快照,恢复到内存(委托 HistoryManager)。
   *
   * 由 createRuntime 工厂在构造完 impl 后调用一次。非 LokvisRuntime 接口的
   * 一部分,仅为 impl 的初始化钩子(工厂调用)。
   */
  async loadPersistedHistory(): Promise<void> {
    return this.historyManager.loadPersistedHistory();
  }
}

/**
 * 创建 Runtime 实例(W2.8 + W2.9)。
 *
 * 默认通过 createAssetStore 工厂按 OPFS → IndexedDB → Memory 降级创建 AssetStore,
 * 并用配额校验包裹。也可通过 config.assetStore 注入自定义 store。
 *
 * 注:此函数为 async(工厂需异步探测环境)。SDK 的 createLokvis 已是 async。
 */
export async function createRuntime(
  config?: RuntimeConfig
): Promise<LokvisRuntime> {
  const assetStore =
    config?.assetStore ??
    (await createAssetStore({ preferOpfs: config?.enableOpfs ?? true }));
  // W7.2:历史持久化 —— 优先用注入的 historyStore;否则在 enableIndexedDB 时
  // 通过 createHistoryStore 自动创建(IDB 不可用时返回 undefined,退化仅内存)
  const historyStore =
    config?.historyStore ??
    ((config?.enableIndexedDB ?? true)
      ? createHistoryStore(config?.historyStoreOptions)
      : undefined);
  const impl = new LokvisRuntimeImpl({ ...config, assetStore, historyStore });
  // 预加载持久化的历史快照(跨会话恢复 undo/redo 链)
  await impl.loadPersistedHistory();
  return impl;
}

/**
 * 构造受限 PluginContext(模块级 helper,供 installPlugin 使用)。
 *
 * Plugin 只看到受限的 Runtime API:
 * - getAsset / importAsset / getAssetBlob / createAsset / listCapabilities
 * - 看不到 React / Redux / Cloud
 *
 * registerMetadataReader 把读取函数转发给 runtime._registerMetadataReader
 * (依赖反转:Plugin 提供实现,Runtime 持有引用)。
 *
 * 错误契约:getAsset 在资产不存在时抛 plain Error,message 以 "Asset not found"
 * 开头。SDK 的 fromLokvisError 据此模式匹配转换为 AssetNotFoundError,
 * 保持 SDK 消费者的错误类型契约不变。
 */
function createPluginContext(
  pluginName: string,
  runtime: LokvisRuntimeImpl
): PluginContext {
  const assetStore = runtime._getAssetStore();
  const capabilityRegistry = runtime._getCapabilityRegistry();
  return {
    runtime: {
      getAsset: async (id) => {
        const asset = await assetStore.get(id);
        if (!asset) throw new Error(`Asset not found: ${id}`);
        return asset;
      },
      importAsset: async (file) => {
        // PluginContext.importAsset 接受 File | Blob,统一转为 AssetSource
        if (file instanceof File) {
          const asset = await assetStore.import({ kind: 'file', file });
          return asset.id;
        }
        const asset = await assetStore.import({
          kind: 'blob',
          blob: file,
          name: `blob_${Date.now()}`,
        });
        return asset.id;
      },
      getAssetBlob: (asset) => assetStore.getBlob(asset.blob),
      createAsset: (blob, metadata, type) =>
        assetStore.create(blob, metadata, type),
      listCapabilities: async () => capabilityRegistry.list(),
    },
    eventBus: runtime.eventBus,
    registerCapability: (impl) =>
      capabilityRegistry.registerImplementation(impl),
    registerMetadataReader: <T>(name: string, reader: MetadataReader<T>) => {
      runtime._registerMetadataReader(name, reader as MetadataReader);
    },
    registerPanel: (panel: PanelDefinition) => {
      // Panel 注册由 UI 层处理,这里仅记录日志
      void panel;
    },
    log: (level, message) => {
      const prefix = `[${pluginName}]`;
      if (level === 'error') console.error(`${prefix} ${message}`);
      else if (level === 'warn') console.warn(`${prefix} ${message}`);
      else console.log(`${prefix} ${message}`);
    },
  };
}

/**
 * 把 Capability.params(CapabilityParam[])转换为 JSON Schema 对象,
 * 供 MCP tool manifest 的 inputSchema 字段使用。
 *
 * 手写转换而非用 zod-to-json-schema:Capability.params 是数组形式
 * (非 ZodSchema),直接映射即可,无需引入额外依赖。
 * (见 docs/AI生态冲击调整方案.md §6.3 的依赖决策)
 */
function capabilityParamsToJsonSchema(params: CapabilityParam[]): object {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const p of params) {
    const prop = capabilityParamToJsonSchemaProperty(p);
    properties[p.name] = prop;
    if (p.required) required.push(p.name);
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

/**
 * 把 CapabilityParamType 映射为合法的 JSON Schema 类型片段。
 *
 * CapabilityParamType 含 `color` / `file` / `enum` 等 Lokvis 专属类型,
 * 它们都不是合法 JSON Schema 类型,必须映射到标准类型:
 *   - `color` → `{ type: 'string', format: 'color' }`
 *   - `file`  → `{ type: 'string' }`(描述里说明是文件路径)
 *   - `enum`  → `{ type: 'string' }`(枚举值由外层追加 `enum` 字段)
 *   - `object`/`array`/`number`/`string`/`boolean` → 同名 JSON Schema 类型
 */
function capabilityParamTypeToJsonType(
  type: CapabilityParamType
): { type: string; format?: string } {
  switch (type) {
    case 'color':
      return { type: 'string', format: 'color' };
    case 'file':
    case 'enum':
      return { type: 'string' };
    case 'number':
    case 'string':
    case 'boolean':
    case 'object':
    case 'array':
      return { type };
    default:
      // 未知类型降级为 string,避免生成非法 JSON Schema
      return { type: 'string' };
  }
}

/** 单个 CapabilityParam → JSON Schema property */
function capabilityParamToJsonSchemaProperty(p: CapabilityParam): Record<string, unknown> {
  const { type: jsonType, format } = capabilityParamTypeToJsonType(p.type);
  const prop: Record<string, unknown> = { type: jsonType };
  if (format) prop.format = format;
  if (p.description) prop.description = p.description;
  if (p.default !== undefined) prop.default = p.default;
  // minimum/maximum 仅对 number 合法;string 应使用 minLength/maxLength
  // (CapabilityParam 仅定义了数值语义的 min/max,故只对 number 类型应用)
  if (p.type === 'number') {
    if (typeof p.min === 'number') prop.minimum = p.min;
    if (typeof p.max === 'number') prop.maximum = p.max;
  }
  if (p.type === 'enum' && p.values) {
    prop.enum = p.values;
  }
  if (p.type === 'array' && p.items) {
    // 递归映射 items 类型,避免 items 为 color/file/enum 时仍是非法类型
    prop.items = capabilityParamTypeToJsonType(p.items);
  }
  return prop;
}
