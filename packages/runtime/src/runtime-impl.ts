/**
 * Lokvis Runtime Implementation(W1.7 从 runtime.ts 拆出)
 *
 * 实现 LokvisRuntime 接口,持有 5 个 managers + plugin-context,所有方法转发到
 * 对应 manager。runtime.ts 仅 re-export 本模块,保持外部导入路径不变。
 */

import type {
  Asset, AssetId, AssetSource, Capability, ExifData,
  HistoryEntry, ImageMetadata, McpManifest, MetadataReader, PdfInfo,
} from '@lokvis/schema';
import type { Workflow, WorkflowResult } from '@lokvis/schema';
import type { EventBus } from '@lokvis/schema';
import type {
  InternalRuntimeInit, LokvisRuntime, PluginInstallEntry, RunOptions, RuntimeConfig,
  RuntimeStatus, ToMcpManifestOptions,
} from './types.js';
import { createEventBus } from './event-bus.js';
import {
  createAssetStore, createMemoryAssetStore, type AssetStore,
} from './asset-store.js';
import { CapabilityRegistry } from './capability-registry.js';
import { WorkflowExecutor } from './executor.js';
import { createHistoryStore, type HistoryStore } from './history-store.js';
import { BatchProcessor } from './batch-processor.js';
import { MemoryGuard, DEFAULT_MEMORY_BUDGET } from './memory-guard.js';
import {
  wrapAssetStoreWithQuota, type QuotaAwareAssetStore,
} from './managers/quota-manager.js';
import { AssetManager } from './managers/asset-manager.js';
import { HistoryManager } from './managers/history-manager.js';
import { WorkflowCoordinator } from './managers/workflow-coordinator.js';
import { toMcpManifest as buildMcpManifest } from './managers/mcp-manifest-builder.js';
import { createPluginContext } from './plugin-context.js';
import { PluginPermissionSandbox } from './plugin-permissions.js';

export const RUNTIME_VERSION = '0.1.0';

/** Runtime 实现类,持有 5 个 managers 并委托方法 */
export class LokvisRuntimeImpl implements LokvisRuntime {
  readonly version = RUNTIME_VERSION;
  readonly eventBus: EventBus;
  private config: Required<Omit<RuntimeConfig, 'assetStore' | 'historyStore' | 'historyStoreOptions'>>;
  private assetStore: QuotaAwareAssetStore; // wrapAssetStoreWithQuota 无条件包裹(含注入路径)
  private assetManager: AssetManager;
  private capabilityRegistry: CapabilityRegistry;
  private executor: WorkflowExecutor;
  private memoryGuard: MemoryGuard;
  private batchProcessor: BatchProcessor;
  private historyManager: HistoryManager; // W1.3:历史栈/initialInputs/currentOutputs/持久化守卫
  private workflowCoordinator: WorkflowCoordinator; // W1.4:status 状态机 + run/cancel/pause/resume/disposeWorkflow
  private historyStore: HistoryStore | undefined; // W7.2 历史持久化;undefined 时退化为仅内存历史
  private metadataReaders = new Map<string, MetadataReader>(); // W7.3/7.4 MetadataReader 依赖反转
  // W21.6: dispose 守卫,防止重复 dispose + 阻止后续 run/cancel 调用
  private disposed = false;
  // W21.6: 标记 assetStore 是否由 Runtime 拥有(工厂创建而非注入)。
  // 仅在 ownsAssetStore=true 时 dispose() 才会调用 assetStore.dispose?.()。
  private readonly ownsAssetStore: boolean;

  /** 注册元数据读取器(由 PluginContext.registerMetadataReader 转发,内部 API) */
  _registerMetadataReader(name: string, reader: MetadataReader): void {
    this.metadataReaders.set(name, reader);
  }

  constructor(config: RuntimeConfig & InternalRuntimeInit = {}) {
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
    // enableOpfs/enableIndexedDB 仅在 createLokvis()/createRuntime 工厂中生效
    // (工厂按 flag 调 createAssetStore 选择 OPFS→IDB→Memory)。直接 new Impl
    // 且未传 assetStore 时,无法同步等待 createAssetStore,兜底用 Memory store。
    if (!config.assetStore && (this.config.enableOpfs || this.config.enableIndexedDB)) {
      console.warn(
        '[lokvis] LokvisRuntimeImpl constructed without assetStore: ' +
          'enableOpfs/enableIndexedDB flags are ignored. ' +
          'Use createLokvis() to respect these flags, or pass an assetStore explicitly.'
      );
    }
    const rawStore = config.assetStore ?? createMemoryAssetStore();
    // W21.6 + review fix: ownsAssetStore 已从公共 RuntimeConfig 移到
    // InternalRuntimeInit,SDK 用户类型层面无法传此字段。工厂 createRuntime
    // 在工厂创建路径下显式传 ownsAssetStore: true,注入路径下显式传 false,
    // 并用 `ownsAssetStore: !injectedAssetStore` 覆盖用户传入的值(防止 JS
    // 用户绕过类型系统)。Impl 信任工厂传入的 ownsAssetStore,不再做冗余守卫。
    this.ownsAssetStore = config.ownsAssetStore ?? !config.assetStore;
    this.assetStore = wrapAssetStoreWithQuota(rawStore, this.config.storageQuota);
    // AssetManager:metadataReaders 由 Runtime 持有,Plugin 注册后立即可见
    this.assetManager = new AssetManager({
      assetStore: this.assetStore, eventBus: this.eventBus,
      metadataReaders: this.metadataReaders,
      storageQuota: this.config.storageQuota,
    });
    this.historyStore = config.historyStore;
    this.historyManager = new HistoryManager({
      eventBus: this.eventBus, assetStore: this.assetStore,
      historyStore: this.historyStore,
    });
    this.capabilityRegistry = new CapabilityRegistry(this.config.engineStrategy);
    this.executor = new WorkflowExecutor({
      assetStore: this.assetStore, capabilityRegistry: this.capabilityRegistry,
      eventBus: this.eventBus, enableLog: this.config.enableLog,
    });
    this.workflowCoordinator = new WorkflowCoordinator({
      executor: this.executor, capabilityRegistry: this.capabilityRegistry,
      eventBus: this.eventBus, historyManager: this.historyManager,
    });
    this.memoryGuard = new MemoryGuard({
      budget: this.config.memoryBudget, assetStore: this.assetStore,
    });
    this.batchProcessor = new BatchProcessor({
      runtime: this, eventBus: this.eventBus,
      isPro: this.config.isPro, memoryGuard: this.memoryGuard,
    });
  }

  get status(): RuntimeStatus { return this.workflowCoordinator.status; }
  get isPro(): boolean { return this.config.isPro; }
  get batch(): BatchProcessor { return this.batchProcessor; }

  // ─── 工作流执行(委托 WorkflowCoordinator) ──────────────
  async run(workflow: Workflow, inputs: AssetId[] | Asset[], options?: RunOptions): Promise<WorkflowResult> {
    if (this.disposed) throw new Error('LokvisRuntime is disposed');
    return this.workflowCoordinator.run(workflow, inputs, options);
  }
  async cancel(workflowId: string): Promise<void> {
    if (this.disposed) throw new Error('LokvisRuntime is disposed');
    return this.workflowCoordinator.cancel(workflowId);
  }
  async pause(workflowId: string): Promise<void> {
    if (this.disposed) throw new Error('LokvisRuntime is disposed');
    return this.workflowCoordinator.pause(workflowId);
  }
  async resume(workflowId: string): Promise<void> {
    if (this.disposed) throw new Error('LokvisRuntime is disposed');
    return this.workflowCoordinator.resume(workflowId);
  }
  async disposeWorkflow(workflowId: string): Promise<void> {
    if (this.disposed) throw new Error('LokvisRuntime is disposed');
    return this.workflowCoordinator.disposeWorkflow(workflowId);
  }

  /**
   * 销毁整个 Runtime(W21.6)。
   *
   * 顺序:
   * 1. 标记 disposed(阻止后续 run/cancel,防止清理期间新请求进入)
   * 2. executor.cancelAll() —— 取消所有运行中 workflow 的 AbortController
   * 3. batchProcessor.dispose() —— 标记所有非终态 job 为 cancelled + 清理订阅
   * 4. historyManager.disposeAll() —— 清空所有历史栈(reset 触发 onEvict
   *    → assetStore.remove 回收 outputs 资产);TD-2.1 改为 await 等待
   *    persistHistory 删除 IDB 记录落地
   * 5. 清理 metadataReaders
   * 6. 若 ownsAssetStore(工厂创建而非注入):调用 assetStore.dispose?.()
   *    关闭 Dexie 连接 / 清空内存 Map。注入路径由消费方自行管理。
   *
   * 不清理:
   * - historyStore(由消费方注入或工厂创建,Dexie 连接由浏览器 GC 处理)
   * - eventBus listeners(允许外部已订阅的 listener 仍收到最后一批
   *   workflow:cancelled 等事件;若需要清空可单独调 eventBus.clear)
   *
   * 幂等:重复调用为 no-op。
   */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    // 1. 取消所有运行中 workflow(同步 abort + 唤醒 resume resolver)
    this.executor.cancelAll();
    // 2. 取消所有非终态 batch job + 清理 progress 订阅
    await this.batchProcessor.dispose();
    // 3. 清空所有历史栈(触发 outputs 资产回收);TD-2.1: await 等待持久化删除落地
    await this.historyManager.disposeAll();
    // 4. 清理 metadataReaders(释放插件注册的 reader 引用)
    this.metadataReaders.clear();
    // 5. 若 Runtime 拥有 assetStore(工厂创建),释放底层资源
    //    (注入路径由消费方自行管理生命周期,避免越权清理)
    if (this.ownsAssetStore) {
      await this.assetStore.dispose?.();
    }
  }

  // ─── 历史与撤销(委托 HistoryManager) ──────────────────
  async history(workflowId: string): Promise<HistoryEntry[]> { return this.historyManager.history(workflowId); }
  async getHistoryState(workflowId: string): Promise<{ entries: HistoryEntry[]; cursor: number }> {
    return this.historyManager.getHistoryState(workflowId);
  }
  async undo(workflowId: string): Promise<void> { return this.historyManager.undo(workflowId); }
  async redo(workflowId: string): Promise<void> { return this.historyManager.redo(workflowId); }
  async jumpTo(workflowId: string, index: number): Promise<void> { return this.historyManager.jumpTo(workflowId, index); }

  // ─── Asset 管理(委托 AssetManager) ─────────────────
  async importAsset(source: AssetSource): Promise<AssetId> { return this.assetManager.importAsset(source); }
  async getAsset(id: AssetId): Promise<Asset> { return this.assetManager.getAsset(id); }
  async exportAsset(id: AssetId, format?: string): Promise<Blob> { return this.assetManager.exportAsset(id, format); }
  async readAssetExif(id: AssetId): Promise<ExifData | null> { return this.assetManager.readAssetExif(id); }
  async readAssetImageMetadata(id: AssetId): Promise<ImageMetadata | null> { return this.assetManager.readAssetImageMetadata(id); }
  async readAssetPdfInfo(id: AssetId): Promise<PdfInfo | null> { return this.assetManager.readAssetPdfInfo(id); }
  async removeAsset(id: AssetId): Promise<void> { return this.assetManager.removeAsset(id); }
  async listAssets(): Promise<Asset[]> { return this.assetManager.listAssets(); }
  async getStorageUsage(): Promise<{ usage: number; quota: number }> { return this.assetManager.getStorageUsage(); }

  // ─── 能力查询(委托 CapabilityRegistry) ────────────────
  async capabilities(): Promise<Capability[]> { return this.capabilityRegistry.list(); }
  async hasCapability(name: string): Promise<boolean> { return this.capabilityRegistry.has(name); }
  async isStubOnly(name: string): Promise<boolean> { return this.capabilityRegistry.isStubOnly(name); }

  // ─── MCP 暴露(委托 mcp-manifest-builder) ──────────────
  toMcpManifest(options: ToMcpManifestOptions = {}): McpManifest {
    return buildMcpManifest(this.capabilityRegistry.list(), options, RUNTIME_VERSION);
  }

  // ─── 插件安装 ────────────────────────────────────────
  /**
   * 安装插件:① 注册能力声明 → ② 构造权限沙箱 → ③ 构造受限 PluginContext
   *        → ④ 应用 network guard(声明 network:none 时 monkey-patch 全局
   *        fetch/XHR/WebSocket/EventSource)→ ⑤ 调用 plugin.install(ctx)
   *        → ⑥ restore 全局 API → ⑦ 发射 plugin:loaded 事件。不吞错。
   *
   * network guard 仅在 plugin.install() 期间生效;install 后插件若异步调用
   * 网络 API(如 setTimeout 回调)无法覆盖 —— plugin 作者应据 ctx.sandbox
   * 主动断言(best-effort 守卫,见 docs/PROJECT_PLAN.md W18.6)。
   */
  async installPlugin(plugin: PluginInstallEntry): Promise<void> {
    for (const capability of plugin.config.capabilities) {
      this.capabilityRegistry.registerCapability(capability);
    }
    const sandbox = new PluginPermissionSandbox(
      plugin.config.name, plugin.config.permissions
    );
    const ctx = createPluginContext(plugin.config.name, {
      eventBus: this.eventBus, assetStore: this.assetStore,
      capabilityRegistry: this.capabilityRegistry,
      registerMetadataReader: (name, reader) => this._registerMetadataReader(name, reader),
      sandbox,
    });
    const restore = sandbox.applyNetworkGuard();
    try {
      await plugin.install(ctx);
    } finally {
      restore();
    }
    this.eventBus.emit({
      type: 'plugin:loaded', name: plugin.config.name, version: plugin.config.version,
    });
  }

  // ─── 内部 API(供测试使用,SDK 不再调用) ──────────────
  _getAssetStore(): AssetStore { return this.assetStore; }
  _getCapabilityRegistry(): CapabilityRegistry { return this.capabilityRegistry; }
  _getMemoryGuard(): MemoryGuard { return this.memoryGuard; }
  _getCurrentOutputs(workflowId: string): AssetId[] { return this.historyManager.getCurrentOutputs(workflowId); }
  async getCurrentOutputs(workflowId: string): Promise<AssetId[]> { return this._getCurrentOutputs(workflowId); }

  /** 从 historyStore 预加载持久化历史快照(由 createRuntime 工厂在构造后调用一次,impl 初始化钩子)。 */
  async loadPersistedHistory(): Promise<void> { return this.historyManager.loadPersistedHistory(); }
}

/**
 * 创建 Runtime 实例(W2.8 + W2.9)。默认通过 createAssetStore 工厂按 OPFS →
 * IndexedDB → Memory 降级创建 AssetStore 并用配额校验包裹;也可通过
 * config.assetStore 注入自定义 store。async(工厂需异步探测环境)。
 */
export async function createRuntime(config?: RuntimeConfig): Promise<LokvisRuntime> {
  // W21.6 + review fix: 判断 assetStore 是否由工厂创建(未注入即工厂创建)。
  // 工厂创建的 store 由 Runtime 拥有,dispose() 时负责调用 assetStore.dispose?.()。
  //
  // 运行时守卫:此处的 `ownsAssetStore: !injectedAssetStore` 会覆盖 `...config`
  // 中可能存在的 ownsAssetStore 字段(虽然 TypeScript 层面 RuntimeConfig 已不含
  // 此字段,但 JS 用户可能绕过类型系统传入)。这样确保注入路径下 ownsAssetStore
  // 始终为 false,防止 Runtime 越权清理注入的 store。
  const injectedAssetStore = config?.assetStore;
  const assetStore =
    injectedAssetStore ??
    (await createAssetStore({ preferOpfs: config?.enableOpfs ?? true }));
  // W7.2 历史持久化:优先用注入的 historyStore;否则在 enableIndexedDB 时
  // 通过 createHistoryStore 自动创建(IDB 不可用时返回 undefined,退化仅内存)
  const historyStore =
    config?.historyStore ??
    ((config?.enableIndexedDB ?? true)
      ? createHistoryStore(config?.historyStoreOptions)
      : undefined);
  const impl = new LokvisRuntimeImpl({
    ...config,
    assetStore,
    historyStore,
    ownsAssetStore: !injectedAssetStore,
  });
  await impl.loadPersistedHistory(); // 预加载持久化历史快照(跨会话恢复 undo/redo 链)
  return impl;
}
