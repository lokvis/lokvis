/**
 * OPFS Asset Store —— 基于 Origin Private File System 的持久化资产存储
 *
 * 设计要点(对应 PROJECT_PLAN 2.6):
 * - 大文件(Blob)存储在 OPFS,元数据(Asset)缓存在内存并同步持久化到 OPFS 的 meta 文件。
 * - 主线程使用 createWritable(异步);Worker 内可使用 createSyncAccessHandle(同步)。
 * - BlobHandle.path 格式为 `opfs://<id>`,用于区分存储后端。
 * - OPFS 不可用时由 createAssetStore 工厂自动降级到 IDB / 内存。
 */

import type {
  Asset,
  AssetId,
  AssetMetadata,
  AssetType,
} from '@lokvis/schema';
import type { AssetStore } from './asset-store.js';

/** OPFS 根目录句柄 */
type FsDirHandle = FileSystemDirectoryHandle;

/** 最小 OPFS 目录句柄接口(屏蔽 lib DOM 版本差异) */
interface OpfsRoot {
  getDirectory(): Promise<FsDirHandle>;
}

const OPFS_DIR_NAME = 'lokvis-assets';
const OPFS_PREFIX = 'opfs://';

/** 生成唯一 ID */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `asset_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** 从 MIME 推断 Asset 类型 */
function inferAssetType(mimeType: string): AssetType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('text/')) return 'text';
  if (mimeType === 'application/json' || mimeType.startsWith('application/'))
    return 'data';
  return 'unknown';
}

/** 从 MIME 获取格式扩展名 */
function getFormatFromMime(mimeType: string): string {
  return mimeType.split('/')[1] ?? 'bin';
}

/** 将 Blob 写入 OPFS 文件 */
async function writeBlobToOpfs(
  dir: FsDirHandle,
  fileName: string,
  blob: Blob,
): Promise<void> {
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  const buffer = await blob.arrayBuffer();
  await writable.write(buffer);
  await writable.close();
}

/** 从 OPFS 读取 Blob */
async function readBlobFromOpfs(
  dir: FsDirHandle,
  fileName: string,
): Promise<Blob> {
  const fileHandle = await dir.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  return file;
}

/** 删除 OPFS 文件 */
async function removeOpfsFile(dir: FsDirHandle, fileName: string): Promise<void> {
  await dir.removeEntry(fileName);
}

/**
 * 创建 OPFS AssetStore。
 * @param root OPFS 根句柄获取器,默认使用 navigator.storage
 * @throws 若 OPFS 不可用(非浏览器环境或无权限)
 */
export function createOpfsAssetStore(root?: OpfsRoot): AssetStore {
  // 获取 OPFS 根目录(延迟初始化)
  let dirCache: FsDirHandle | null = null;

  async function getDir(): Promise<FsDirHandle> {
    if (dirCache) return dirCache;
    const opfsRoot = root ?? (navigator.storage as OpfsRoot | undefined);
    if (!opfsRoot || typeof opfsRoot.getDirectory !== 'function') {
      throw new Error('OPFS is not available in this environment');
    }
    const rootDir = await opfsRoot.getDirectory();
    dirCache = await rootDir.getDirectoryHandle(OPFS_DIR_NAME, {
      create: true,
    });
    return dirCache;
  }

  // 元数据缓存在内存
  const assets = new Map<AssetId, Asset>();

  /** 内部:持久化 Asset 元数据到内存 Map(OPFS 版暂不持久化元数据文件,由上层 IDB 补充) */
  function cacheAsset(asset: Asset): void {
    assets.set(asset.id, asset);
  }

  return {
    async import(source) {
      let blob: Blob;
      if (source.kind === 'file') {
        blob = source.file;
      } else if (source.kind === 'blob') {
        blob = source.blob;
      } else {
        throw new Error(
          `Asset source kind "${source.kind}" not supported in OPFS store`,
        );
      }

      const dir = await getDir();
      const id = generateId();
      const mimeType = blob.type || 'application/octet-stream';
      const type = inferAssetType(mimeType);
      const format = getFormatFromMime(mimeType);

      await writeBlobToOpfs(dir, id, blob);

      const now = Date.now();
      const metadata: AssetMetadata = { mimeType, size: blob.size, format };
      const asset: Asset = {
        id,
        type,
        metadata,
        blob: { path: `${OPFS_PREFIX}${id}`, size: blob.size, mimeType },
        history: [],
        tags: [],
        createdAt: now,
        updatedAt: now,
      };
      cacheAsset(asset);
      return asset;
    },

    async get(id) {
      return assets.get(id);
    },

    async getBlob(handle) {
      const id = handle.path.replace(OPFS_PREFIX, '');
      const dir = await getDir();
      return readBlobFromOpfs(dir, id);
    },

    async remove(id) {
      const dir = await getDir();
      await removeOpfsFile(dir, id);
      assets.delete(id);
    },

    async list() {
      return Array.from(assets.values());
    },

    async create(blob, metadata, type) {
      const dir = await getDir();
      const id = generateId();
      await writeBlobToOpfs(dir, id, blob);

      const now = Date.now();
      const asset: Asset = {
        id,
        type,
        metadata,
        blob: {
          path: `${OPFS_PREFIX}${id}`,
          size: blob.size,
          mimeType: metadata.mimeType,
        },
        history: [],
        tags: [],
        createdAt: now,
        updatedAt: now,
      };
      cacheAsset(asset);
      return asset;
    },
  };
}

/** 检测 OPFS 是否可用 */
export function isOpfsAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.storage !== 'undefined' &&
    typeof navigator.storage.getDirectory === 'function'
  );
}
