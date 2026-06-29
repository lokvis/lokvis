/**
 * Lokvis Asset Store
 *
 * 资产存储管理。元数据存 IndexedDB，大文件存 OPFS。
 * Runtime 只操作 AssetId，不直接持有 File 或 Blob。
 */

import type { Asset, AssetId, AssetMetadata, AssetSource, BlobHandle } from '@lokvis/schema';

/** Asset Store 配置 */
export interface AssetStoreConfig {
  enableOpfs: boolean;
  storageQuota: number;
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
