/**
 * OPFS Asset Store
 *
 * 大文件(blob)存 OPFS(Origin Private File System),元数据存内存 Map +
 * IndexedDB(Dexie)持久化。OPFS 是浏览器私有文件系统,blob 持久化(刷新后
 * 文件仍在);W6.6 起元数据也通过 Dexie 持久化,刷新后 list()/get() 能恢复。
 *
 * 持久化策略(W6.6):
 * - 启动时:db.metadata.toArray() 预加载内存 Map(后续 get/list 零 IO)
 * - import/create:写 OPFS 文件 + db.metadata.put + 内存 Map.set
 * - remove:删 OPFS 文件 + db.metadata.delete + 内存 Map.delete
 * - IndexedDB 不可用时降级为仅内存模式(刷新后丢失,与 W2 行为一致)
 *
 * 注:任务规格提及 FileSystemSyncAccessHandle(Worker 内同步句柄),
 * 但 AssetStore 接口本身为 async,主线程仅可使用 FileSystemFileHandle 异步 API,
 * 因此本实现采用异步文件句柄,语义等价且兼容主线程与 Worker。
 *
 * 降级链(W2.8 工厂):OPFS → IndexedDB → Memory
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
import { isIdbSupported } from './idb-asset-store.js';
import { AssetBlobNotFoundError } from './errors.js';

/** OPFS 不可用或初始化失败时抛出 */
export class OpfsUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpfsUnavailableError';
  }
}

/** OPFS 文件存储路径前缀(出现在 BlobHandle.path 中) */
export const OPFS_PATH_PREFIX = 'opfs';

/** OPFS 文件名后缀 */
const OPFS_FILE_SUFFIX = '.bin';

/**
 * OPFS 元数据持久化数据库(W6.6)。
 *
 * 仅存 { id, asset }(不含 blob,blob 在 OPFS 文件里),用于刷新后恢复内存 Map。
 * 数据库名独立于 IdbAssetStore 的 'lokvis-assets',避免与全持久化 store 冲突。
 */
export class OpfsMetadataDatabase extends Dexie {
  metadata!: Table<OpfsMetadataRecord, AssetId>;

  constructor(name = 'lokvis-opfs-metadata') {
    super(name);
    this.version(1).stores({
      metadata: 'id',
    });
  }
}

/** OPFS 元数据记录 */
export interface OpfsMetadataRecord {
  /** 主键 = Asset.id */
  id: AssetId;
  /** 资产元数据(blob 在 OPFS 文件,不在此存) */
  asset: Asset;
}

/** OPFS AssetStore 配置 */
export interface OpfsAssetStoreOptions {
  /** OPFS 根目录下的命名空间目录名(默认 'lokvis') */
  rootDirName?: string;
  /** 资产子目录名(默认 'assets') */
  assetsDirName?: string;
  /**
   * 测试注入:自定义 OPFS 根目录句柄。
   * 默认使用 navigator.storage.getDirectory()。
   */
  rootHandle?: FileSystemDirectoryHandle;
  /**
   * 测试注入:自定义元数据库实例(W6.6 持久化)。
   * 默认在 IndexedDB 可用时自动创建 OpfsMetadataDatabase。
   */
  metadataDb?: OpfsMetadataDatabase;
  /** 元数据库名(默认 'lokvis-opfs-metadata';仅 metadataDb 未注入时生效) */
  metadataDbName?: string;
}

/** 检测当前环境是否支持 OPFS */
export function isOpfsSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.storage !== 'undefined' &&
    typeof navigator.storage.getDirectory === 'function'
  );
}

/** 获取 OPFS 根目录句柄(自动创建命名空间目录) */
async function resolveAssetsDir(
  options: OpfsAssetStoreOptions
): Promise<FileSystemDirectoryHandle> {
  let root: FileSystemDirectoryHandle;
  if (options.rootHandle) {
    root = options.rootHandle;
  } else {
    if (!isOpfsSupported()) {
      throw new OpfsUnavailableError(
        'OPFS is not available: navigator.storage.getDirectory is undefined'
      );
    }
    root = await navigator.storage.getDirectory();
  }
  const lokvisDir = await root.getDirectoryHandle(
    options.rootDirName ?? 'lokvis',
    { create: true }
  );
  return lokvisDir.getDirectoryHandle(options.assetsDirName ?? 'assets', {
    create: true,
  });
}

/** 将 Blob 写入 OPFS 文件 */
async function writeOpfsFile(
  dir: FileSystemDirectoryHandle,
  fileName: string,
  blob: Blob
): Promise<FileSystemFileHandle> {
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(blob);
  } finally {
    await writable.close();
  }
  return fileHandle;
}

/**
 * 初始化元数据库(W6.6)。
 *
 * 优先用 options.metadataDb(测试注入);否则在 IndexedDB 可用时创建新实例。
 * IndexedDB 不可用时返回 undefined,调用方降级为仅内存模式。
 */
function resolveMetadataDb(
  options: OpfsAssetStoreOptions
): OpfsMetadataDatabase | undefined {
  if (options.metadataDb) return options.metadataDb;
  if (!isIdbSupported()) return undefined;
  try {
    return new OpfsMetadataDatabase(options.metadataDbName);
  } catch (err) {
    console.warn('[lokvis] OPFS metadata db init failed, falling back to memory-only:', err);
    return undefined;
  }
}

/** 安全写入元数据库(失败仅 warn,不阻断主流程) */
async function persistMetadata(
  db: OpfsMetadataDatabase | undefined,
  id: AssetId,
  asset: Asset
): Promise<void> {
  if (!db) return;
  try {
    await db.metadata.put({ id, asset });
  } catch (err) {
    console.warn(`[lokvis] OPFS metadata persist failed for ${id}:`, err);
  }
}

/** 安全删除元数据(失败仅 warn) */
async function deleteMetadata(
  db: OpfsMetadataDatabase | undefined,
  id: AssetId
): Promise<void> {
  if (!db) return;
  try {
    await db.metadata.delete(id);
  } catch (err) {
    console.warn(`[lokvis] OPFS metadata delete failed for ${id}:`, err);
  }
}

/** 创建 OPFS 版 AssetStore */
export async function createOpfsAssetStore(
  options: OpfsAssetStoreOptions = {}
): Promise<AssetStore> {
  const assetsDir = await resolveAssetsDir(options);
  /** 元数据缓存(内存中;W6.6 起启动时从 Dexie 预加载) */
  const assets = new Map<AssetId, Asset>();
  /** id → 文件句柄(用于 getBlob/remove;刷新后丢失,按需重建) */
  const fileHandles = new Map<AssetId, FileSystemFileHandle>();
  /** 元数据库(W6.6 持久化;undefined 时仅内存模式) */
  const db = resolveMetadataDb(options);

  // 启动时预加载已持久化的元数据(刷新后恢复 list/get)
  if (db) {
    try {
      const records = await db.metadata.toArray();
      for (const r of records) assets.set(r.id, r.asset);
    } catch (err) {
      console.warn('[lokvis] OPFS metadata preload failed:', err);
    }
  }

  /** 从 id 派生 OPFS 文件名 */
  const fileName = (id: AssetId) => `${id}${OPFS_FILE_SUFFIX}`;

  return {
    async import(source) {
      const { id, blob, metadata, type } = await prepareImport(source);
      const handle = await writeOpfsFile(assetsDir, fileName(id), blob);
      fileHandles.set(id, handle);
      const asset = buildAsset(id, blob, metadata, type, OPFS_PATH_PREFIX);
      assets.set(id, asset);
      await persistMetadata(db, id, asset);
      return asset;
    },

    async get(id) {
      return assets.get(id);
    },

    async getBlob(handle) {
      const id = parseBlobPath(handle.path, OPFS_PATH_PREFIX);
      let fileHandle = fileHandles.get(id);
      if (!fileHandle) {
        // 可能是进程重启后内存句柄丢失,从 OPFS 重新获取
        try {
          fileHandle = await assetsDir.getFileHandle(fileName(id));
          fileHandles.set(id, fileHandle);
        } catch {
          throw new AssetBlobNotFoundError(`Blob not found in OPFS for path: ${handle.path}`);
        }
      }
      const file = await fileHandle.getFile();
      return file;
    },

    async remove(id) {
      assets.delete(id);
      fileHandles.delete(id);
      try {
        await assetsDir.removeEntry(fileName(id));
      } catch (err) {
        // NotFoundError 是幂等删除的预期场景(文件已不存在),静默忽略;
        // 其他错误(权限/IO 等)记录 warn,便于排查孤儿 OPFS 文件长期累积
        // 无论文件删除是否成功,都继续清理 IDB metadata(见下方)
        if (!(err instanceof DOMException && err.name === 'NotFoundError')) {
          console.warn(
            `[lokvis] OPFS removeEntry unexpected failure for asset ${id}:`,
            err
          );
        }
      }
      await deleteMetadata(db, id);
    },

    async list() {
      return Array.from(assets.values());
    },

    async create(blob, metadata, type) {
      const id = generateId();
      const handle = await writeOpfsFile(assetsDir, fileName(id), blob);
      fileHandles.set(id, handle);
      const asset = buildAsset(id, blob, metadata, type, OPFS_PATH_PREFIX);
      assets.set(id, asset);
      await persistMetadata(db, id, asset);
      return asset;
    },

    // W21.6: 清空内存 Map + 关闭 Dexie 连接。
    // OPFS 文件不删除(下次创建 store 时从 IndexedDB metadata 预加载恢复)。
    async dispose() {
      assets.clear();
      fileHandles.clear();
      db?.close();
    },
  };
}
