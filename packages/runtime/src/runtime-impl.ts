/**
 * Lokvis Runtime Implementation(W1.7 从 runtime.ts 拆出)
 *
 * 实现 LokvisRuntime 接口,持有 5 个 managers + plugin-context,所有方法转发到
 * 对应 manager。runtime.ts 仅 re-export 本模块,保持外部导入路径不变。
 */

import type {
  Asset, AssetId, AssetSource, Capability, ExifData,
  HistoryEntry, McpManifest, MetadataReader,
} from '@lokvis/schema';
import type { Workflow, WorkflowResult } from '@lokvis/schema';
import type { EventBus } from '@lokvis/schema';
import type {
  LokvisRuntime, PluginInstallEntry, RunOptions, RuntimeConfig,
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

  /** 注册元数据读取器(由 PluginContext.registerMetadataReader 转发,内部 API) */
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
    return this.workflowCoordinator.run(workflow, inputs, options);
  }
  async cancel(workflowId: string): Promise<void> { return this.workflowCoordinator.cancel(workflowId); }
  async pause(workflowId: string): Promise<void> { return this.workflowCoordinator.pause(workflowId); }
  async resume(workflowId: string): Promise<void> { return this.workflowCoordinator.resume(workflowId); }
  async disposeWorkflow(workflowId: string): Promise<void> { return this.workflowCoordinator.disposeWorkflow(workflowId); }

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
  /** 安装插件:① 注册能力声明 → ② 构造受限 PluginContext → ③ 调用 plugin.install(ctx) → ④ 发射 plugin:loaded 事件。不吞错。 */
  async installPlugin(plugin: PluginInstallEntry): Promise<void> {
    for (const capability of plugin.config.capabilities) {
      this.capabilityRegistry.registerCapability(capability);
    }
    const ctx = createPluginContext(plugin.config.name, {
      eventBus: this.eventBus, assetStore: this.assetStore,
      capabilityRegistry: this.capabilityRegistry,
      registerMetadataReader: (name, reader) => this._registerMetadataReader(name, reader),
    });
    await plugin.install(ctx);
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
  const assetStore =
    config?.assetStore ??
    (await createAssetStore({ preferOpfs: config?.enableOpfs ?? true }));
  // W7.2 历史持久化:优先用注入的 historyStore;否则在 enableIndexedDB 时
  // 通过 createHistoryStore 自动创建(IDB 不可用时返回 undefined,退化仅内存)
  const historyStore =
    config?.historyStore ??
    ((config?.enableIndexedDB ?? true)
      ? createHistoryStore(config?.historyStoreOptions)
      : undefined);
  const impl = new LokvisRuntimeImpl({ ...config, assetStore, historyStore });
  await impl.loadPersistedHistory(); // 预加载持久化历史快照(跨会话恢复 undo/redo 链)
  return impl;
}
