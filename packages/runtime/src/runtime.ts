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
  LokvisEvent,
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
  generateId,
  type AssetStore,
} from './asset-store.js';
import { CapabilityRegistry } from './capability-registry.js';
import { WorkflowExecutor } from './executor.js';
import { MAX_WORKFLOW_STEPS } from './workflow-builder.js';
import { HistoryStack, type HistoryStackConfig } from './history.js';
import {
  createHistoryStore,
  type HistoryStore,
} from './history-store.js';
import { BatchProcessor } from './batch-processor.js';
import { MemoryGuard, DEFAULT_MEMORY_BUDGET } from './memory-guard.js';

export const RUNTIME_VERSION = '0.1.0';

/** 默认历史记录上限 */
const DEFAULT_MAX_HISTORY = 10;

/**
 * 同时持有的工作流历史栈上限（W2.8 内存治理）。
 *
 * 修复 review 报告：原实现 historyStacks 是无限增长 Map，每次 run() 都加入新
 * workflow.id（ui-react buildLinearWorkflow 用 `wf_${Date.now()}` 每次唯一），
 * 长会话累积导致 Map 引用的 AssetId 无法回收 → 内存泄漏。
 *
 * 32 是经验值：覆盖用户常见使用（多 tab 切换 + undo 范围），超限按 FIFO
 * 清理最旧 stack（reset 触发 onEvict → assetStore.remove 回收资产）。
 */
const MAX_CONCURRENT_WORKFLOW_STACKS = 32;

/** 存储配额超限时抛出(W2.9) */
export class QuotaExceededError extends Error {
  readonly usage: number;
  readonly delta: number;
  readonly quota: number;
  constructor(usage: number, delta: number, quota: number) {
    super(
      `Storage quota exceeded: usage=${usage} + delta=${delta} > quota=${quota}`
    );
    this.name = 'QuotaExceededError';
    this.usage = usage;
    this.delta = delta;
    this.quota = quota;
  }
}

/**
 * 从 AssetSource 估算导入字节数用于配额预检。
 * url/opfs 源大小未知,返回 0 跳过预检 —— 真实大小在 import 完成后
 * 通过 `usage += asset.metadata.size` 补记到账面,后续操作仍受配额约束。
 */
function estimateSourceSize(source: AssetSource): number {
  if (source.kind === 'file') return source.file.size;
  if (source.kind === 'blob') return source.blob.size;
  return 0;
}

/**
 * 用配额校验包裹 AssetStore:import/create 超限抛 QuotaExceededError(W2.9)。
 * 内部维护运行中的已用字节数,remove 时回退。
 *
 * 并发安全:import/create/remove 通过 promise 链串行化,避免 check 与 update
 * 之间的 TOCTOU 窗口导致两个并发操作都基于旧 usage 通过校验或回退。
 */
/**
 * 配额感知的 AssetStore:在 AssetStore 接口之上扩展 _getQuotaUsage,
 * 供 runtime.getStorageUsage O(1) 读取内部 usage(下划线表"内部 API")。
 */
type QuotaAwareAssetStore = AssetStore & {
  _getQuotaUsage: () => number;
};

function wrapAssetStoreWithQuota(
  inner: AssetStore,
  quota: number
): QuotaAwareAssetStore {
  let usage = 0;
  let initialized = false;
  /** 串行化 import/create/remove 的 chain tail,确保 check-update 原子性 */
  let chain: Promise<unknown> = Promise.resolve();

  async function ensureInit(): Promise<void> {
    if (initialized) return;
    const all = await inner.list();
    usage = all.reduce((sum, a) => sum + a.metadata.size, 0);
    initialized = true;
  }

  function assertQuota(delta: number): void {
    if (usage + delta > quota) {
      throw new QuotaExceededError(usage, delta, quota);
    }
  }

  /** 将 import/create/remove 串行化:依次 await init → assert → inner op → update usage */
  function runExclusive<T>(op: () => Promise<T>): Promise<T> {
    const run = chain.then(op, op);
    // chain 仅用于排队,不传播 rejection(避免一次失败阻塞后续)
    chain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  return {
    async import(source) {
      return runExclusive(async () => {
        await ensureInit();
        assertQuota(estimateSourceSize(source));
        const asset = await inner.import(source);
        usage += asset.metadata.size;
        return asset;
      });
    },
    async get(id) {
      return inner.get(id);
    },
    async getBlob(handle) {
      return inner.getBlob(handle);
    },
    async remove(id) {
      return runExclusive(async () => {
        const existing = await inner.get(id);
        await inner.remove(id);
        if (existing) {
          usage = Math.max(0, usage - existing.metadata.size);
        }
      });
    },
    async list() {
      return inner.list();
    },
    async create(blob, metadata, type) {
      return runExclusive(async () => {
        await ensureInit();
        // m8 修复:配额预检与累加使用同一口径(metadata.size),
        // 避免 blob.size 与 metadata.size 漂移导致账面与预检不一致
        assertQuota(metadata.size);
        const asset = await inner.create(blob, metadata, type);
        usage += asset.metadata.size;
        return asset;
      });
    },
    /**
     * m6 优化:暴露配额包装器内部维护的 usage(O(1)),
     * 供 runtime.getStorageUsage 优先使用,避免每次 O(n) 全量 listAssets。
     * 下划线前缀表"内部 API",非 AssetStore 接口一部分。
     * 若 ensureInit 未完成,返回 -1 表示"未就绪",调用方 fallback 到 listAssets。
     */
    _getQuotaUsage(): number {
      return initialized ? usage : -1;
    },
  };
}

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
  private capabilityRegistry: CapabilityRegistry;
  private executor: WorkflowExecutor;
  private memoryGuard: MemoryGuard;
  private batchProcessor: BatchProcessor;
  /**
   * 每个工作流独立的 HistoryStack。
   * W7.2 起,栈快照(entries + cursor)连同 initialInputs / currentOutputs
   * 通过 historyStore 持久化到 IndexedDB,刷新后可恢复。
   */
  private historyStacks = new Map<string, HistoryStack>();
  /** 记录每个工作流的初始输入 AssetId(undo 回到初始时使用) */
  private initialInputsMap = new Map<string, AssetId[]>();
  /** 记录每个工作流当前的输出 AssetId(undo/redo 后切换"当前") */
  private currentOutputsMap = new Map<string, AssetId[]>();
  /**
   * 历史持久化存储(W7.2)。undefined 时退化为仅内存历史(刷新后丢失)。
   * 由 createRuntime 在 enableIndexedDB 时自动创建,或通过 config 注入。
   */
  private historyStore: HistoryStore | undefined;
  /**
   * 加载持久化历史快照期间的守卫标志。
   * restore() 会触发 onChanged → persistHistory,此时跳过写回,
   * 避免把刚读出的数据又重复写入(冗余 IO + 潜在覆盖竞态)。
   */
  private isLoadingHistory = false;
  /**
   * 加载期间被 onChanged 标记为"dirty"的工作流 ID 集合(W7.2 review 修复)。
   *
   * 原实现:isLoadingHistory 期间所有 persistHistory 调用直接 return,
   * 若加载期间有其他来源(run / undo / 外部事件)触发 onChanged,
   * 这些变更会被永久丢弃(加载结束后不会重发 persist)。
   *
   * 现策略:加载期间被跳过的 persistHistory 把 workflowId 加入此 Set,
   * loadPersistedHistory 结束后逐个补 persist,确保不丢变更。
   * (restore() 自身触发的 onChanged 也加入,但其内容与刚读出的相同,
   *  补 persist 仅多一次等价写回,幂等无害。)
   */
  private dirtyDuringLoad = new Set<string>();

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

    // W7.2 历史持久化:优先用注入的 historyStore;否则在 createRuntime 工厂中
    // 由 createHistoryStore 自动创建并注入。直接 new Impl 时为 undefined,
    // 历史退化为仅内存模式(与 W2 行为一致)。
    this.historyStore = config.historyStore;

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

    // 监听 node:finished 事件,自动 append 到 HistoryStack
    this.eventBus.on('node:finished', (event) => {
      this.recordHistoryFromNodeEvent(event as Extract<LokvisEvent, { type: 'node:finished' }>);
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

    // 历史栈管理：
    // - 默认:每次 run() 重置历史(重跑语义),并通过 onEvict 回收旧 outputs 资产
    // - appendHistory:true:保留已有历史栈,支持跨次 undo/redo 链(如连续滤镜)
    const inputIds = await this.collectInputAssetIds(inputs);
    if (options?.appendHistory && this.historyStacks.has(workflow.id)) {
      // 追加模式:保留历史栈与 currentOutputs,仅确保初始输入已记录
      if (!this.initialInputsMap.has(workflow.id)) {
        this.initialInputsMap.set(workflow.id, inputIds);
      }
    } else {
      // 重置模式(默认):丢弃旧历史,重新初始化
      const existingStack = this.historyStacks.get(workflow.id);
      if (existingStack) {
        existingStack.reset();
      }
      this.initialInputsMap.set(workflow.id, inputIds);
      this.currentOutputsMap.set(workflow.id, inputIds);
    }
    this.enforceHistoryStacksLimit();

    try {
      const result = await this.executor.execute(workflow, inputs);
      this._status = result.status === 'failed' ? 'error' : 'idle';
      // 成功完成后,记录最终输出为当前
      if (result.status === 'completed' && result.outputs.length > 0) {
        this.currentOutputsMap.set(workflow.id, result.outputs);
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
    await this.cancel(workflowId).catch(() => {
      /* 工作流可能未在运行 */
    });
    const stack = this.historyStacks.get(workflowId);
    if (stack) {
      stack.reset();
      this.historyStacks.delete(workflowId);
    }
    this.initialInputsMap.delete(workflowId);
    this.currentOutputsMap.delete(workflowId);
  }

  // ─── 历史与撤销 ──────────────────────────────────────

  async history(workflowId: string): Promise<HistoryEntry[]> {
    // 避免对从未运行过的工作流创建空栈:先查 Map,无则直接返回空数组
    return this.historyStacks.get(workflowId)?.list() ?? [];
  }

  async getHistoryState(
    workflowId: string
  ): Promise<{ entries: HistoryEntry[]; cursor: number }> {
    const stack = this.historyStacks.get(workflowId);
    if (!stack) return { entries: [], cursor: -1 };
    const snap = stack.snapshot();
    return { entries: snap.entries, cursor: snap.cursor };
  }

  async undo(workflowId: string): Promise<void> {
    const stack = this.getOrCreateHistoryStack(workflowId);
    const result = stack.undo();
    if (result === undefined) return; // 无可 undo

    // 更新当前输出:
    //   - null 表示回到初始状态,使用 initialInputs
    //   - entry 表示回退到该条目的 outputs
    const newCurrent = result === null
      ? (this.initialInputsMap.get(workflowId) ?? [])
      : result.outputs;
    this.currentOutputsMap.set(workflowId, newCurrent);
    // history:changed 事件由 stack 的 onChanged 回调统一发射,避免双发
  }

  async redo(workflowId: string): Promise<void> {
    const stack = this.getOrCreateHistoryStack(workflowId);
    const entry = stack.redo();
    if (entry === undefined) return; // 无可 redo

    this.currentOutputsMap.set(workflowId, entry.outputs);
    // history:changed 事件由 stack 的 onChanged 回调统一发射,避免双发
  }

  async jumpTo(workflowId: string, index: number): Promise<void> {
    const stack = this.getOrCreateHistoryStack(workflowId);
    const result = stack.jumpTo(index);
    if (result === undefined) return; // 越界或游标未变,无操作

    // 同 undo/redo:更新当前输出
    const newCurrent = result === null
      ? (this.initialInputsMap.get(workflowId) ?? [])
      : result.outputs;
    this.currentOutputsMap.set(workflowId, newCurrent);
    // history:changed 事件由 stack 的 onChanged 回调统一发射
  }

  // ─── Asset 管理 ──────────────────────────────────────

  async importAsset(source: AssetSource): Promise<AssetId> {
    // 修复 review 报告：原实现直接透传 source 给 assetStore.import，
    // 但 MemoryAssetStore/OpfsAssetStore/IdbAssetStore 的 extractBlobFromSource
    // 仅支持 file/blob 两种 kind，url/opfs 会抛 "not supported"。
    // 这里在 runtime 层兜底处理 url（fetch → blob），opfs 暂不支持（OPFS
    // 路径访问需要 filesystem access permission，未来单独实现）
    let effectiveSource = source;
    if (source.kind === 'url') {
      const resp = await fetch(source.url);
      if (!resp.ok) {
        throw new Error(`Failed to fetch asset from ${source.url}: ${resp.status}`);
      }
      const blob = await resp.blob();
      const name = source.url.split('/').pop()?.split('?')[0] ?? 'asset';
      effectiveSource = { kind: 'blob', blob, name };
    } else if (source.kind === 'opfs') {
      throw new Error(
        "AssetSource kind 'opfs' is not yet supported by importAsset; " +
          'use the OPFS-aware AssetStore directly or convert to blob first'
      );
    }

    const asset = await this.assetStore.import(effectiveSource);
    this.eventBus.emit({
      type: 'asset:imported',
      assetId: asset.id,
      metadata: asset.metadata,
    });
    return asset.id;
  }

  async getAsset(id: AssetId): Promise<Asset> {
    const asset = await this.assetStore.get(id);
    if (!asset) throw new Error(`Asset not found: ${id}`);
    return asset;
  }

  async exportAsset(id: AssetId, format?: string): Promise<Blob> {
    const asset = await this.getAsset(id);
    const blob = await this.assetStore.getBlob(asset.blob);
    // OPFS 存储后端用 .bin 扩展名存储,读取时 fileHandle.getFile() 返回的
    // File.type 可能为空字符串或 'application/octet-stream'(浏览器对未知扩展名
    // 的默认兜底 MIME)。这两种情况都会导致 Object URL 的 Content-Type 退化,
    // 下载时文件扩展名变成 .octet-stream。
    // 用 asset metadata 的 mimeType 补全 Blob type(IDB/Memory 后端不受影响)。
    const OPFS_FALLBACK_MIME = 'application/octet-stream';
    const mimeType =
      !blob.type || blob.type === OPFS_FALLBACK_MIME
        ? asset.metadata.mimeType
        : blob.type;
    // 关键:用 arrayBuffer() 显式读取数据到内存,再构造新 Blob。
    // 不能用 new Blob([blob]) —— 浏览器实现中它可能延迟引用底层 OPFS 文件,
    // WatermarkBatchTool 在 export 后立即 removeAsset 删除 OPFS 文件,
    // 导致后续 downloadBlob 读取悬空引用失败("check internet connection")。
    // arrayBuffer() 立即拉取数据,确保返回的 Blob 完全独立于底层存储。
    const buffer = await blob.arrayBuffer();
    const exported = new Blob([buffer], { type: mimeType });
    this.eventBus.emit({
      type: 'export:completed',
      assetId: id,
      format: format ?? asset.metadata.format,
      size: blob.size,
    });
    return exported;
  }

  /**
   * 读取 image 资产的 EXIF 元数据(W7.3/7.4 长期方案:MetadataReader 依赖反转)。
   *
   * Runtime 持有 plugin-image 通过 ctx.registerMetadataReader('image.read-exif', fn)
   * 注册的 reader 引用,按名调用。reader 内部调 readExifFromBlob(exifr)。
   * Plugin 未安装时优雅降级返回 null(不抛错)。
   *
   * 架构决策:readExif 是 Blob→ExifData 查询,不符合 Engine 层 Blob↔Blob 纯函数
   * 约束,也不符合 Capability Asset[]→Asset[] 契约,故走 MetadataReader 机制,
   * 不进 engine-image、不走 Capability execute。
   */
  async readAssetExif(id: AssetId): Promise<ExifData | null> {
    const asset = await this.getAsset(id);
    if (asset.type !== 'image') return null;
    const reader = this.metadataReaders.get('image.read-exif');
    if (!reader) return null; // Plugin 未安装,优雅降级
    return reader(asset) as Promise<ExifData | null>;
  }

  async removeAsset(id: AssetId): Promise<void> {
    await this.assetStore.remove(id);
    this.eventBus.emit({ type: 'asset:removed', assetId: id });
  }

  async listAssets(): Promise<Asset[]> {
    return this.assetStore.list();
  }

  async getStorageUsage(): Promise<{ usage: number; quota: number }> {
    // m6 优化:优先用配额包装器内部维护的 usage(O(1),import/create/remove
    // 时增量更新),避免每次 O(n) 全量 listAssets 影响 StatusBar 刷新。
    // 包装器未就绪(ensureInit 未完成)返回 -1 时,fallback 到 listAssets
    // 实时计算(source of truth,与 W6.4 富元数据一致)。
    //
    // 类型说明:assetStore 字段类型为 QuotaAwareAssetStore(含 _getQuotaUsage),
    // 由 wrapAssetStoreWithQuota 返回。无需重新断言 —— 类型信息未丢失。
    const cached = this.assetStore._getQuotaUsage();
    if (cached >= 0) {
      return { usage: cached, quota: this.config.storageQuota };
    }
    const all = await this.assetStore.list();
    const usage = all.reduce((sum, a) => sum + a.metadata.size, 0);
    return { usage, quota: this.config.storageQuota };
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
    return this.currentOutputsMap.get(workflowId) ?? [];
  }

  /** 获取工作流当前输出 AssetId（公开 API，供 UI / MCP 查询） */
  async getCurrentOutputs(workflowId: string): Promise<AssetId[]> {
    return this._getCurrentOutputs(workflowId);
  }

  // ─── 私有：历史栈管理 ──────────────────────────────

  /**
   * LRU 上限清理：historyStacks 超过 MAX_CONCURRENT_WORKFLOW_STACKS 时
   * 按 FIFO 删除最旧 stack（reset 触发 onEvict → assetStore.remove 回收资产）。
   *
   * Map 的迭代顺序是插入顺序（ES2015+ 规范），所以第一个 entry 即最旧。
   * 注意：当前 run() 的工作流尚未插入 Map（getOrCreateHistoryStack 才会插入），
   * 所以这里清理不会误删当前工作流。
   */
  private enforceHistoryStacksLimit(): void {
    while (this.historyStacks.size >= MAX_CONCURRENT_WORKFLOW_STACKS) {
      // 取最旧 workflowId（Map 第一个 key）
      const oldestId = this.historyStacks.keys().next().value;
      if (oldestId === undefined) break;
      const stack = this.historyStacks.get(oldestId);
      if (stack) {
        // reset 触发 onEvict，回收历史 outputs 资产
        stack.reset();
      }
      this.historyStacks.delete(oldestId);
      this.initialInputsMap.delete(oldestId);
      this.currentOutputsMap.delete(oldestId);
    }
  }

  /** 获取或创建工作流对应的 HistoryStack */
  private getOrCreateHistoryStack(workflowId: string): HistoryStack {
    let stack = this.historyStacks.get(workflowId);
    if (!stack) {
      const stackConfig: Partial<HistoryStackConfig> = {
        maxEntries: DEFAULT_MAX_HISTORY,
        onEvict: (entry) => {
          // 淘汰条目时清理其 outputs 资产(避免 OPFS 泄漏)
          // 注意:此时条目已从栈中移除,且 undo 不会再回到它
          for (const assetId of entry.outputs) {
            // 静默移除,忽略不存在的情况
            this.assetStore.remove(assetId).catch(() => {});
          }
        },
        onChanged: (wfId, entries, currentIndex) => {
          this.eventBus.emit({
            type: 'history:changed',
            workflowId: wfId,
            entries,
            currentIndex,
          });
          // W7.2:持久化快照到 IndexedDB(加载期间跳过,避免冗余写回)
          void this.persistHistory(wfId);
        },
      };
      stack = new HistoryStack(workflowId, stackConfig);
      this.historyStacks.set(workflowId, stack);
    }
    return stack;
  }

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

  /** 监听 node:finished 事件,自动 append 到对应工作流的 HistoryStack */
  private recordHistoryFromNodeEvent(
    event: Extract<LokvisEvent, { type: 'node:finished' }>
  ): void {
    if (!event.outputs || event.outputs.length === 0) return;

    const stack = this.getOrCreateHistoryStack(event.workflowId);
    const outputs = event.outputs.map((a) => a.id);
    const now = Date.now();

    // node 的 inputs = 上一步的 outputs(或初始输入)
    const inputs = this.currentOutputsMap.get(event.workflowId) ?? [];

    const entry: HistoryEntry = {
      id: generateId(),
      workflowId: event.workflowId,
      nodeId: event.nodeId,
      capability: event.capability,
      params: event.params,
      inputs,
      outputs,
      timestamp: now,
    };

    stack.append(entry);
    // 更新当前输出为该 node 的 outputs
    this.currentOutputsMap.set(event.workflowId, outputs);
  }

  // ─── 私有:历史持久化(W7.2) ────────────────────────

  /**
   * 把指定工作流的当前历史状态快照写入 historyStore。
   *
   * 时序修复:currentOutputs 从 stack snapshot 派生(cursor === -1 用
   * initialInputs,否则用 entries[cursor].outputs),而非读 currentOutputsMap。
   * 原因:onChanged 在 undo/redo/jumpTo/run 内部同步触发时,map 尚未更新,
   * 会读到旧值(例如 run 后 append 触发 onChanged,但 currentOutputsMap 在
   * append 返回后才 set)。
   *
   * 竞态安全:多个 fire-and-forget save 的 IDB readwrite 事务由 IndexedDB
   * 引擎按发起顺序串行化(同 object store 不重叠),无需应用层加链。
   *
   * - entries 为空时改为 delete,避免残留空记录(reset/clear 后自然清理)
   * - 加载期间(isLoadingHistory=true)跳过写回,但把 workflowId 加入
   *   dirtyDuringLoad,loadPersistedHistory 结束后补 persist(避免丢变更)
   */
  private async persistHistory(workflowId: string): Promise<void> {
    if (!this.historyStore) return;
    if (this.isLoadingHistory) {
      this.dirtyDuringLoad.add(workflowId);
      return;
    }
    // fire-and-forget 调用方用 `void this.persistHistory(...)`,故内部必须
    // try/catch,否则 IDB 故障(数据库关闭 / quota exceeded)会变成 unhandled
    // promise rejection。历史持久化是非关键路径,失败只 warn 不抛。
    try {
      const stack = this.historyStacks.get(workflowId);
      // 栈已从内存移除(disposeWorkflow / enforceHistoryStacksLimit 的 reset+delete
      // 后异步到达此处)→ 删除持久化记录,避免孤儿数据跨会话残留
      if (!stack) {
        await this.historyStore.delete(workflowId);
        return;
      }
      const { entries, cursor } = stack.snapshot();
      if (entries.length === 0) {
        await this.historyStore.delete(workflowId);
        return;
      }
      // 从 snapshot 派生 currentOutputs,而非读 currentOutputsMap —— 后者在
      // onChanged 触发时尚未更新(见方法文档注释)
      const initialInputs = this.initialInputsMap.get(workflowId) ?? [];
      const currentOutputs = cursor === -1
        ? initialInputs
        : (entries[cursor]?.outputs ?? initialInputs);
      await this.historyStore.save({
        workflowId,
        entries,
        cursor,
        initialInputs,
        currentOutputs,
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.warn(
        `[lokvis] persistHistory failed for workflow ${workflowId}:`,
        err
      );
    }
  }

  /**
   * 从 historyStore 预加载所有持久化的历史快照,恢复到内存。
   *
   * 由 createRuntime 工厂在构造完 impl 后调用一次。加载期间置 isLoadingHistory
   * 守卫,使 restore() 触发的 onChanged → persistHistory 跳过冗余写回;
   * 但被跳过的 workflowId 记入 dirtyDuringLoad,加载结束后补 persist,
   * 避免加载期间其他来源(run / undo / 外部事件)的变更被永久丢弃。
   *
   * 注意:restore 会 emit history:changed 事件,但此时 UI 尚未订阅
   * (runtime-slice.init 在 createRuntime resolve 后才订阅),故无副作用。
   *
   * 非 LokvisRuntime 接口的一部分,仅为 impl 的初始化钩子(工厂调用)。
   */
  async loadPersistedHistory(): Promise<void> {
    if (!this.historyStore) return;
    let records: Awaited<ReturnType<HistoryStore['loadAll']>> = [];
    this.isLoadingHistory = true;
    try {
      records = await this.historyStore.loadAll();
      for (const record of records) {
        // 跳过空记录(理论上 save 已删除,双重防御)
        if (record.entries.length === 0) continue;
        const stack = this.getOrCreateHistoryStack(record.workflowId);
        stack.restore({ entries: record.entries, cursor: record.cursor });
        this.initialInputsMap.set(record.workflowId, record.initialInputs);
        this.currentOutputsMap.set(record.workflowId, record.currentOutputs);
      }
    } finally {
      this.isLoadingHistory = false;
      // 加载期间被跳过的 persist 补发:逐个 await 保证顺序
      // 复制一份避免补 persist 过程中新触发 onChanged → dirtyDuringLoad 死循环
      const pending = [...this.dirtyDuringLoad];
      this.dirtyDuringLoad.clear();
      for (const wfId of pending) {
        await this.persistHistory(wfId);
      }
    }
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
