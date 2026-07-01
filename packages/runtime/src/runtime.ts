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
  HistoryEntry,
  LokvisEvent,
  McpManifest,
  McpToolManifest,
} from '@lokvis/schema';
import type { Workflow, WorkflowResult } from '@lokvis/schema';
import type {
  LokvisRuntime,
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
import { HistoryStack, type HistoryStackConfig } from './history.js';

export const RUNTIME_VERSION = '0.1.0';

/** 默认历史记录上限 */
const DEFAULT_MAX_HISTORY = 10;

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
function wrapAssetStoreWithQuota(inner: AssetStore, quota: number): AssetStore {
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
        assertQuota(blob.size);
        const asset = await inner.create(blob, metadata, type);
        usage += asset.metadata.size;
        return asset;
      });
    },
  };
}

/** Runtime 实现类 */
export class LokvisRuntimeImpl implements LokvisRuntime {
  readonly version = RUNTIME_VERSION;
  readonly eventBus: EventBus;

  private config: Required<Omit<RuntimeConfig, 'assetStore'>>;
  private _status: RuntimeStatus = 'idle';
  private assetStore: AssetStore;
  private capabilityRegistry: CapabilityRegistry;
  private executor: WorkflowExecutor;
  /**
   * 每个工作流独立的 HistoryStack。
   * 注意:历史栈仅在内存中,刷新页面后丢失(资产可能仍存于 OPFS/IDB,
   * 但因元数据/索引未持久化而无法恢复)—— 跨会话恢复属 W3 范畴。
   */
  private historyStacks = new Map<string, HistoryStack>();
  /** 记录每个工作流的初始输入 AssetId(undo 回到初始时使用) */
  private initialInputsMap = new Map<string, AssetId[]>();
  /** 记录每个工作流当前的输出 AssetId(undo/redo 后切换"当前") */
  private currentOutputsMap = new Map<string, AssetId[]>();

  constructor(config: RuntimeConfig = {}) {
    this.config = {
      enableOpfs: config.enableOpfs ?? true,
      enableIndexedDB: config.enableIndexedDB ?? true,
      storageQuota: config.storageQuota ?? 1024 * 1024 * 1024, // 1GB
      enableLog: config.enableLog ?? true,
      engineStrategy: config.engineStrategy ?? 'first',
    };

    this.eventBus = createEventBus();

    // 注入或降级到内存 store;随后用配额校验包裹(W2.9)
    const rawStore = config.assetStore ?? createMemoryAssetStore();
    this.assetStore = wrapAssetStoreWithQuota(rawStore, this.config.storageQuota);

    this.capabilityRegistry = new CapabilityRegistry(this.config.engineStrategy);

    this.executor = new WorkflowExecutor({
      assetStore: this.assetStore,
      capabilityRegistry: this.capabilityRegistry,
      eventBus: this.eventBus,
      enableLog: this.config.enableLog,
    });

    // 监听 node:finished 事件,自动 append 到 HistoryStack
    this.eventBus.on('node:finished', (event) => {
      this.recordHistoryFromNodeEvent(event as Extract<LokvisEvent, { type: 'node:finished' }>);
    });
  }

  get status(): RuntimeStatus {
    return this._status;
  }

  // ─── 工作流执行 ──────────────────────────────────────

  async run(
    workflow: Workflow,
    inputs: AssetId[] | Asset[]
  ): Promise<WorkflowResult> {
    this._status = 'running';

    // 重新执行同一工作流时,丢弃上一次的历史(含失败后重跑的残留条目),
    // 并通过 onEvict 回收其 outputs 资产,避免 OPFS/IDB 泄漏。
    // 初始输入 Asset 不在历史栈中,不受影响。
    const existingStack = this.historyStacks.get(workflow.id);
    if (existingStack) {
      existingStack.reset();
    }

    // 记录初始输入 AssetId(用于 undo 回到初始状态)
    const inputIds = await this.collectInputAssetIds(inputs);
    this.initialInputsMap.set(workflow.id, inputIds);
    // 初始当前输出 = 初始输入
    this.currentOutputsMap.set(workflow.id, inputIds);

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

  // ─── 历史与撤销 ──────────────────────────────────────

  async history(workflowId: string): Promise<HistoryEntry[]> {
    // 避免对从未运行过的工作流创建空栈:先查 Map,无则直接返回空数组
    return this.historyStacks.get(workflowId)?.list() ?? [];
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

  // ─── Asset 管理 ──────────────────────────────────────

  async importAsset(source: AssetSource): Promise<AssetId> {
    const asset = await this.assetStore.import(source);
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
    this.eventBus.emit({
      type: 'export:completed',
      assetId: id,
      format: format ?? asset.metadata.format,
      size: blob.size,
    });
    return blob;
  }

  async removeAsset(id: AssetId): Promise<void> {
    await this.assetStore.remove(id);
    this.eventBus.emit({ type: 'asset:removed', assetId: id });
  }

  async listAssets(): Promise<Asset[]> {
    return this.assetStore.list();
  }

  // ─── 能力查询 ────────────────────────────────────────

  async capabilities(): Promise<Capability[]> {
    return this.capabilityRegistry.list();
  }

  async hasCapability(name: string): Promise<boolean> {
    return this.capabilityRegistry.has(name);
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

  // ─── 内部 API（供 Plugin SDK 使用） ──────────────────

  /** 获取 AssetStore（内部用） */
  _getAssetStore(): AssetStore {
    return this.assetStore;
  }

  /** 获取 CapabilityRegistry（内部用） */
  _getCapabilityRegistry(): CapabilityRegistry {
    return this.capabilityRegistry;
  }

  /** 获取工作流当前输出 AssetId（undo/redo 后的"当前"状态,内部用） */
  _getCurrentOutputs(workflowId: string): AssetId[] {
    return this.currentOutputsMap.get(workflowId) ?? [];
  }

  // ─── 私有：历史栈管理 ──────────────────────────────

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
        onChanged: (wfId, entries) => {
          this.eventBus.emit({
            type: 'history:changed',
            workflowId: wfId,
            entries,
          });
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
  return new LokvisRuntimeImpl({ ...config, assetStore });
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
