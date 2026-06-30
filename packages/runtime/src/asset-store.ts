/**
 * Lokvis Asset Store
 *
 * 资产存储管理。元数据存 IndexedDB，大文件存 OPFS。
 * Runtime 只操作 AssetId，不直接持有 File 或 Blob。
 */

import type { Asset, AssetId, AssetMetadata, AssetSource, BlobHandle } from '@lokvis/schema';
import { isOpfsAvailable, createOpfsAssetStore } from './opfs-asset-store.js';
import { createIdbAssetStore } from './idb-asset-store.js';

/** Asset Store 配置 */
export interface AssetStoreConfig {
  enableOpfs: boolean;
  storageQuota: number;
}

/** 资产存储配额超限错误 */
export class QuotaExceededError extends Error {
  readonly used: number;
  readonly quota: number;

  constructor(used: number, quota: number) {
    super(`Storage quota exceeded: used ${used} bytes, quota ${quota} bytes`);
    this.name = 'QuotaExceededError';
    this.used = used;
    this.quota = quota;
  }
}

/** Asset 存储接口 */
export interface AssetStore {
  /** 导入资产（从 File / Blob / URL） */
  import(source: AssetSource): Promise<Asset>;
  /** 获取资产元数据 */
  get(id: AssetId): Promise<Asset | undefined>;
  /** 获取资产的 Blob 数据 */
  getBlob(handle: BlobHandle): Promise<Blob>;
  /** 删除资产 */
  remove(id: AssetId): Promise<void>;
  /** 列出所有资产 */
  list(): Promise<Asset[]>;
  /** 创建新 Asset（内部用，由 Capability 产出） */
  create(blob: Blob, metadata: AssetMetadata, type: Asset['type']): Promise<Asset>;
}

/** createAssetStore 工厂选项 */
export interface CreateAssetStoreOptions {
  /** 是否优先使用 OPFS(默认 true) */
  preferOpfs?: boolean;
  /** 是否允许降级到 IndexedDB(默认 true) */
  allowIdbFallback?: boolean;
  /** 存储配额(字节,默认 1GB) */
  storageQuota?: number;
}

/** 生成唯一 ID */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `asset_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** 从 MIME 类型推断 Asset 类型 */
function inferAssetType(mimeType: string): Asset['type'] {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('text/')) return 'text';
  if (mimeType === 'application/json' || mimeType.startsWith('application/'))
    return 'data';
  return 'unknown';
}

/** 从 MIME 类型获取格式扩展名 */
function getFormatFromMime(mimeType: string): string {
  const parts = mimeType.split('/');
  return parts[1] ?? 'bin';
}

/** 创建内存版 AssetStore（降级方案，不持久化） */
export function createMemoryAssetStore(): AssetStore {
  const assets = new Map<AssetId, Asset>();
  const blobs = new Map<AssetId, Blob>();

  return {
    async import(source) {
      let blob: Blob;

      if (source.kind === 'file') {
        blob = source.file;
      } else if (source.kind === 'blob') {
        blob = source.blob;
      } else {
        throw new Error(`Asset source kind "${source.kind}" not supported in memory store`);
      }

      const id = generateId();
      const mimeType = blob.type || 'application/octet-stream';
      const type = inferAssetType(mimeType);
      const format = getFormatFromMime(mimeType);
      const metadata: AssetMetadata = {
        mimeType,
        size: blob.size,
        format,
      };

      blobs.set(id, blob);
      const now = Date.now();
      const asset: Asset = {
        id,
        type,
        metadata,
        blob: {
          path: `memory://${id}`,
          size: blob.size,
          mimeType,
        },
        history: [],
        tags: [],
        createdAt: now,
        updatedAt: now,
      };
      assets.set(id, asset);
      return asset;
    },

    async get(id) {
      return assets.get(id);
    },

    async getBlob(handle) {
      const id = handle.path.replace('memory://', '');
      const blob = blobs.get(id);
      if (!blob) throw new Error(`Blob not found for path: ${handle.path}`);
      return blob;
    },

    async remove(id) {
      assets.delete(id);
      blobs.delete(id);
    },

    async list() {
      return Array.from(assets.values());
    },

    async create(blob, metadata, type) {
      const id = generateId();
      blobs.set(id, blob);
      const now = Date.now();
      const asset: Asset = {
        id,
        type,
        metadata,
        blob: {
          path: `memory://${id}`,
          size: blob.size,
          mimeType: metadata.mimeType,
        },
        history: [],
        tags: [],
        createdAt: now,
        updatedAt: now,
      };
      assets.set(id, asset);
      return asset;
    },
  };
}

/**
 * 检测浏览器存储配额是否充足。
 * @param quota 配额上限(字节)
 * @throws QuotaExceededError 当已用量超过配额
 */
export async function checkStorageQuota(quota: number): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return;
  const estimate = await navigator.storage.estimate();
  if (estimate.usage !== undefined && estimate.usage > quota) {
    throw new QuotaExceededError(estimate.usage, quota);
  }
}

/**
 * AssetStore 工厂:按优先级自动探测并选择最佳存储后端。
 *
 * 探测顺序:OPFS → IndexedDB(Dexie) → 内存(最终降级)。
 *
 * @param options 工厂选项
 * @returns AssetStore 实例
 */
export function createAssetStore(options: CreateAssetStoreOptions = {}): AssetStore {
  const {
    preferOpfs = true,
    allowIdbFallback = true,
  } = options;

  // L1: OPFS(大文件最优,支持 FileSystemSyncAccessHandle)
  if (preferOpfs && isOpfsAvailable()) {
    try {
      return createOpfsAssetStore();
    } catch {
      // OPFS 初始化失败,继续降级
    }
  }

  // L2: IndexedDB(Dexie,持久化但无 OPFS 性能优势)
  if (allowIdbFallback && typeof indexedDB !== 'undefined') {
    try {
      return createIdbAssetStore();
    } catch {
      // IDB 初始化失败,继续降级
    }
  }

  // L3: 内存(最终降级,不持久化)
  return createMemoryAssetStore();
}
