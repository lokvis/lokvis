/**
 * IndexedDB Asset Store
 *
 * 元数据 + Blob 全部存 IndexedDB(通过 Dexie)。
 * 当 OPFS 不可用时作为降级方案,数据持久化且支持跨刷新恢复。
 *
 * 降级链(W2.8 工厂):OPFS → IndexedDB(本实现) → Memory
 */

import Dexie, { type Table } from 'dexie';
import type { Asset, AssetId } from '@lokvis/schema';
import type { AssetStore } from './asset-store.js';
import {
  buildAsset,
  generateId,
  parseBlobPath,
  prepareImport,
} from './asset-store.js';
import { AssetBlobNotFoundError } from './errors.js';

/** IndexedDB 不可用时抛出 */
export class IdbUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdbUnavailableError';
  }
}

/** IDB 文件存储路径前缀(出现在 BlobHandle.path 中) */
export const IDB_PATH_PREFIX = 'idb';

/** IDB AssetStore 配置 */
export interface IdbAssetStoreOptions {
  /** 数据库名(默认 'lokvis-assets') */
  dbName?: string;
  /**
   * 测试注入:自定义 Dexie 实例。
   * 默认创建新实例。
   */
  dbInstance?: AssetDatabase;
}

/** IndexedDB 中的资产记录(Asset 元数据 + Blob 数据) */
export interface AssetRecord {
  /** 主键 = Asset.id */
  id: AssetId;
  /** 资产元数据 */
  asset: Asset;
  /** 原始 Blob 数据(结构化克隆存储) */
  blob: Blob;
}

/** Dexie 数据库封装 */
export class AssetDatabase extends Dexie {
  assets!: Table<AssetRecord, string>;

  constructor(name = 'lokvis-assets') {
    super(name);
    this.version(1).stores({
      // 仅主键 id;按 type 查询由上层过滤 list() 实现,无需二级索引
      assets: 'id',
    });
  }
}

/** 检测当前环境是否支持 IndexedDB */
export function isIdbSupported(): boolean {
  // Dexie 始终可 import,但实际使用需要全局 indexedDB
  return typeof indexedDB !== 'undefined';
}

/** 创建 IndexedDB 版 AssetStore */
export async function createIdbAssetStore(
  options: IdbAssetStoreOptions = {}
): Promise<AssetStore> {
  if (!isIdbSupported() && !options.dbInstance) {
    throw new IdbUnavailableError(
      'IndexedDB is not available in this environment'
    );
  }

  const db = options.dbInstance ?? new AssetDatabase(options.dbName);

  return {
    async import(source) {
      const { id, blob, metadata, type } = await prepareImport(source);
      const asset = buildAsset(id, blob, metadata, type, IDB_PATH_PREFIX);
      await db.assets.put({ id, asset, blob });
      return asset;
    },

    async get(id) {
      const record = await db.assets.get(id);
      return record?.asset;
    },

    async getBlob(handle) {
      const id = parseBlobPath(handle.path, IDB_PATH_PREFIX);
      const record = await db.assets.get(id);
      if (!record) {
        throw new AssetBlobNotFoundError(`Blob not found in IndexedDB for path: ${handle.path}`);
      }
      return record.blob;
    },

    async remove(id) {
      await db.assets.delete(id);
    },

    async list() {
      const records = await db.assets.toArray();
      return records.map((r) => r.asset);
    },

    async create(blob, metadata, type) {
      const id = generateId();
      const asset = buildAsset(id, blob, metadata, type, IDB_PATH_PREFIX);
      await db.assets.put({ id, asset, blob });
      return asset;
    },

    // W21.6: 关闭 Dexie 连接(IDB 数据不删除,下次创建 store 时可恢复)。
    async dispose() {
      db.close();
    },
  };
}
