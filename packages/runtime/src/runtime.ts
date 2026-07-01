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
  createMemoryAssetStore,
  type AssetStore,
} from './asset-store.js';
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
  private historyMap = new Map<string, HistoryEntry[]>();

  constructor(config: RuntimeConfig = {}) {
    this.config = {
      enableOpfs: config.enableOpfs ?? true,
      enableIndexedDB: config.enableIndexedDB ?? true,
      storageQuota: config.storageQuota ?? 1024 * 1024 * 1024, // 1GB
      enableLog: config.enableLog ?? true,
    };

    this.eventBus = createEventBus();

    // 第一版使用内存 AssetStore，后续支持 OPFS
    this.assetStore = createMemoryAssetStore();

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
    this._status = 'running';
    try {
      const result = await this.executor.execute(workflow, inputs);
      this._status = result.status === 'failed' ? 'error' : 'idle';
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
    return this.historyMap.get(workflowId) ?? [];
  }

  async undo(workflowId: string): Promise<void> {
    // TODO: 实现基于历史记录的撤销
    void workflowId;
  }

  async redo(workflowId: string): Promise<void> {
    // TODO: 实现基于历史记录的重做
    void workflowId;
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
}

/** 创建 Runtime 实例 */
export function createRuntime(config?: RuntimeConfig): LokvisRuntime {
  return new LokvisRuntimeImpl(config);
}
