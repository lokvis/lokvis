/**
 * IndexedDB 资产存储
 *
 * 基于 Dexie 实现 AssetStore 接口。
 * assets 表存储 Asset 元数据，blobs 表存储 Blob 数据（ArrayBuffer 形式）。
 * BlobHandle.path 格式为 `idb://<id>`，用于区分存储后端。
 */

import Dexie, { type Table } from 'dexie';
import type {
  Asset,
  AssetId,
  AssetMetadata,
  AssetSource,
  BlobHandle,
} from '@lokvis/schema';
import type { AssetStore } from './asset-store.js';

/** BlobHandle.path 的前缀，标识数据存放在 IndexedDB */
const IDB_PREFIX = 'idb://';

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

/** 从 BlobHandle.path 中解析资产 ID（去掉 `idb://` 前缀） */
function parseIdFromPath(path: string): AssetId {
  return path.startsWith(IDB_PREFIX) ? path.slice(IDB_PREFIX.length) : path;
}

/** blobs 表中的记录结构 */
interface BlobRecord {
  /** 资产 ID（同时作为主键） */
  id: AssetId;
  /** Blob 原始数据 */
  data: ArrayBuffer;
}

/** Asset 存储使用的 Dexie 数据库 */
class AssetDatabase extends Dexie {
  /** 资产元数据表 */
  assets!: Table<Asset, AssetId>;
  /** Blob 数据表 */
  blobs!: Table<BlobRecord, AssetId>;

  constructor() {
    super('lokvis-asset-store');
    this.version(1).stores({
      assets: 'id',
      blobs: 'id',
    });
  }
}

/**
 * 创建基于 IndexedDB（Dexie）的 AssetStore。
 *
 * 与内存版逻辑一致，但元数据与 Blob 数据均持久化到 IndexedDB，
 * 适合生产环境使用。BlobHandle.path 使用 `idb://` 前缀以区分存储后端。
 */
export function createIdbAssetStore(): AssetStore {
  const db = new AssetDatabase();

  return {
    async import(source: AssetSource): Promise<Asset> {
      let blob: Blob;

      // 与内存版一致，仅支持 file 与 blob 两种来源
      if (source.kind === 'file') {
        blob = source.file;
      } else if (source.kind === 'blob') {
        blob = source.blob;
      } else {
        throw new Error(
          `Asset source kind "${source.kind}" not supported in idb store`
        );
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

      // 持久化 Blob 数据（ArrayBuffer）与 Asset 元数据
      const buffer = await blob.arrayBuffer();
      await db.blobs.put({ id, data: buffer });

      const now = Date.now();
      const asset: Asset = {
        id,
        type,
        metadata,
        blob: {
          path: `${IDB_PREFIX}${id}`,
          size: blob.size,
          mimeType,
        },
        history: [],
        tags: [],
        createdAt: now,
        updatedAt: now,
      };
      await db.assets.put(asset);
      return asset;
    },

    async get(id: AssetId): Promise<Asset | undefined> {
      return db.assets.get(id);
    },

    async getBlob(handle: BlobHandle): Promise<Blob> {
      const id = parseIdFromPath(handle.path);
      const record = await db.blobs.get(id);
      if (!record) {
        throw new Error(`Blob not found for path: ${handle.path}`);
      }
      // 从 ArrayBuffer 重建 Blob，类型取自 handle
      return new Blob([record.data], { type: handle.mimeType });
    },

    async remove(id: AssetId): Promise<void> {
      // 在同一事务中删除两张表的记录，保证一致性
      await db.transaction('rw', db.assets, db.blobs, async () => {
        await db.assets.delete(id);
        await db.blobs.delete(id);
      });
    },

    async list(): Promise<Asset[]> {
      return db.assets.toArray();
    },

    async create(
      blob: Blob,
      metadata: AssetMetadata,
      type: Asset['type']
    ): Promise<Asset> {
      const id = generateId();
      const buffer = await blob.arrayBuffer();
      await db.blobs.put({ id, data: buffer });

      const now = Date.now();
      const asset: Asset = {
        id,
        type,
        metadata,
        blob: {
          path: `${IDB_PREFIX}${id}`,
          size: blob.size,
          mimeType: metadata.mimeType,
        },
        history: [],
        tags: [],
        createdAt: now,
        updatedAt: now,
      };
      await db.assets.put(asset);
      return asset;
    },
  };
}
