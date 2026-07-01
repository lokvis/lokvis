/**
 * OPFS Asset Store
 *
 * 大文件存 OPFS(Origin Private File System),元数据存内存 Map。
 * OPFS 是浏览器私有文件系统,数据持久化但不可被用户直接访问,适合中间产物。
 *
 * 注:任务规格提及 FileSystemSyncAccessHandle(Worker 内同步句柄),
 * 但 AssetStore 接口本身为 async,主线程仅可使用 FileSystemFileHandle 异步 API,
 * 因此本实现采用异步文件句柄,语义等价且兼容主线程与 Worker。
 *
 * 降级链(W2.8 工厂):OPFS → IndexedDB → Memory
 */

import type {
  Asset,
  AssetId,
  AssetMetadata,
} from '@lokvis/schema';
import type { AssetStore } from './asset-store.js';
import {
  buildAsset,
  extractBlobFromSource,
  generateId,
  getFormatFromMime,
  inferAssetType,
} from './asset-store.js';

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

/** 创建 OPFS 版 AssetStore */
export async function createOpfsAssetStore(
  options: OpfsAssetStoreOptions = {}
): Promise<AssetStore> {
  const assetsDir = await resolveAssetsDir(options);
  /** 元数据缓存(内存中;持久化由 IdbAssetStore 负责) */
  const assets = new Map<AssetId, Asset>();
  /** id → 文件句柄(用于 getBlob/remove) */
  const fileHandles = new Map<AssetId, FileSystemFileHandle>();

  /** 从 id 派生 OPFS 文件名 */
  const fileName = (id: AssetId) => `${id}${OPFS_FILE_SUFFIX}`;

  return {
    async import(source) {
      const { blob, mimeType: rawMime } = extractBlobFromSource(source);
      const id = generateId();
      const mimeType = rawMime || 'application/octet-stream';
      const type = inferAssetType(mimeType);
      const metadata: AssetMetadata = {
        mimeType,
        size: blob.size,
        format: getFormatFromMime(mimeType),
      };

      const handle = await writeOpfsFile(assetsDir, fileName(id), blob);
      fileHandles.set(id, handle);
      const asset = buildAsset(id, blob, metadata, type, OPFS_PATH_PREFIX);
      assets.set(id, asset);
      return asset;
    },

    async get(id) {
      return assets.get(id);
    },

    async getBlob(handle) {
      const id = parseOpfsPath(handle.path);
      let fileHandle = fileHandles.get(id);
      if (!fileHandle) {
        // 可能是进程重启后元数据丢失但句柄仍可恢复
        try {
          fileHandle = await assetsDir.getFileHandle(fileName(id));
          fileHandles.set(id, fileHandle);
        } catch {
          throw new Error(`Blob not found in OPFS for path: ${handle.path}`);
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
      } catch {
        // 文件不存在视为已删除,静默忽略
      }
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
      return asset;
    },
  };
}

/** 从 BlobHandle.path 解析出 AssetId */
function parseOpfsPath(path: string): AssetId {
  // path 形如 `opfs://{id}` 或直接是文件名
  const prefix = `${OPFS_PATH_PREFIX}://`;
  if (path.startsWith(prefix)) {
    return path.slice(prefix.length);
  }
  return path.replace(new RegExp(`${OPFS_FILE_SUFFIX}$`), '');
}
