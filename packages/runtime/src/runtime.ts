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
  HistoryEntry,
} from '@lokvis/schema';
import type { Workflow, WorkflowResult } from '@lokvis/schema';
import type { LokvisRuntime, RuntimeConfig, RuntimeStatus } from './types.js';
import type { EventBus } from '@lokvis/schema';
import { createEventBus } from './event-bus.js';
import {
  createAssetStore,
  createMemoryAssetStore,
  checkStorageQuota,
  type AssetStore,
} from './asset-store.js';
import { HistoryStack } from './history.js';
import { CapabilityRegistry } from './capability-registry.js';
import { WorkflowExecutor } from './executor.js';

export const RUNTIME_VERSION = '0.1.0';

/** Runtime 实现类 */
export class LokvisRuntimeImpl implements LokvisRuntime {
  readonly version = RUNTIME_VERSION;
  readonly eventBus: EventBus;

  private config: Required<RuntimeConfig>;
  private _status: RuntimeStatus = 'idle';
  private assetStore: AssetStore;
  private capabilityRegistry: CapabilityRegistry;
  private executor: WorkflowExecutor;
  private historyStacks = new Map<string, HistoryStack>();

  constructor(config: RuntimeConfig = {}) {
    this.config = {
      enableOpfs: config.enableOpfs ?? true,
      enableIndexedDB: config.enableIndexedDB ?? true,
      storageQuota: config.storageQuota ?? 1024 * 1024 * 1024, // 1GB
      enableLog: config.enableLog ?? true,
    };

    this.eventBus = createEventBus();

    // 使用工厂自动探测最佳存储后端(OPFS → IDB → 内存)
    this.assetStore = this.config.enableOpfs
      ? createAssetStore({ preferOpfs: true, storageQuota: this.config.storageQuota })
      : createMemoryAssetStore();

    this.capabilityRegistry = new CapabilityRegistry();

    this.executor = new WorkflowExecutor({
      assetStore: this.assetStore,
      capabilityRegistry: this.capabilityRegistry,
      eventBus: this.eventBus,
      enableLog: this.config.enableLog,
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
    // 存储配额校验
    await checkStorageQuota(this.config.storageQuota);

    this._status = 'running';
    try {
      const result = await this.executor.execute(workflow, inputs);
      this._status = result.status === 'failed' ? 'error' : 'idle';

      // 成功完成后记录历史
      if (result.status === 'completed') {
        this.recordHistory(workflow, inputs, result);
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
    const stack = this.historyStacks.get(workflowId);
    return stack ? stack.getAll() : [];
  }

  async undo(workflowId: string): Promise<void> {
    const stack = this.getOrCreateHistoryStack(workflowId);
    stack.undo();
  }

  async redo(workflowId: string): Promise<void> {
    const stack = this.getOrCreateHistoryStack(workflowId);
    stack.redo();
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

  // ─── 内部 API（供 Plugin SDK 使用） ──────────────────

  /** 获取 AssetStore（内部用） */
  _getAssetStore(): AssetStore {
    return this.assetStore;
  }

  /** 获取 CapabilityRegistry（内部用） */
  _getCapabilityRegistry(): CapabilityRegistry {
    return this.capabilityRegistry;
  }

  // ─── 历史记录内部实现 ──────────────────────────────────

  /** 获取或创建工作流对应的 HistoryStack */
  private getOrCreateHistoryStack(workflowId: string): HistoryStack {
    let stack = this.historyStacks.get(workflowId);
    if (!stack) {
      stack = new HistoryStack({
        eventBus: this.eventBus,
        workflowId,
        onEvict: (evicted) => {
          // LRU 淘汰时清理不再引用的输出资产
          for (const entry of evicted) {
            for (const outputId of entry.outputs) {
              this.assetStore.remove(outputId).catch(() => {});
            }
          }
        },
      });
      this.historyStacks.set(workflowId, stack);
    }
    return stack;
  }

  /** 工作流执行成功后记录历史 */
  private recordHistory(
    workflow: Workflow,
    inputs: AssetId[] | Asset[],
    result: WorkflowResult,
  ): void {
    const workflowId = workflow.id;
    const stack = this.getOrCreateHistoryStack(workflowId);

    // 将输入统一为 AssetId[]
    const inputIds: AssetId[] = inputs.length > 0 && typeof inputs[0] === 'string'
      ? (inputs as AssetId[])
      : (inputs as Asset[]).map((a) => a.id);

    // 为工作流的每个 transform 节点记录一条历史
    const transformNodes = workflow.nodes.filter((n) => n.type === 'transform');
    const outputIds = result.outputs;

    for (let i = 0; i < transformNodes.length; i++) {
      const node = transformNodes[i]!;
      const entry: HistoryEntry = {
        id: `${workflowId}:${node.id}:${Date.now()}:${i}`,
        workflowId,
        nodeId: node.id,
        capability: node.capability,
        params: node.params ?? {},
        inputs: inputIds,
        outputs: outputIds,
        timestamp: Date.now(),
      };
      stack.append(entry);
    }
  }
}

/** 创建 Runtime 实例 */
export function createRuntime(config?: RuntimeConfig): LokvisRuntime {
  return new LokvisRuntimeImpl(config);
}
