/**
 * Lokvis Asset Store
 *
 * 资产存储管理。元数据存 IndexedDB，大文件存 OPFS。
 * Runtime 只操作 AssetId，不直接持有 File 或 Blob。
 *
 * 降级链(createAssetStore 工厂,W2.8):
 *   preferOpfs → OPFS → IndexedDB(Dexie) → Memory(始终可用,不持久化)
 */

import type { Asset, AssetId, AssetMetadata, AssetSource, BlobHandle } from '@lokvis/schema';
import { createOpfsAssetStore, isOpfsSupported } from './opfs-asset-store.js';
import { createIdbAssetStore, isIdbSupported } from './idb-asset-store.js';

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
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `asset_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** 从 MIME 类型推断 Asset 类型 */
export function inferAssetType(mimeType: string): Asset['type'] {
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
export function getFormatFromMime(mimeType: string): string {
  const parts = mimeType.split('/');
  return parts[1] ?? 'bin';
}

/** 从 AssetSource 提取 Blob 与 MIME(支持 file/blob,其余抛 not supported) */
export function extractBlobFromSource(source: AssetSource): {
  blob: Blob;
  mimeType: string;
} {
  if (source.kind === 'file') {
    return { blob: source.file, mimeType: source.file.type };
  }
  if (source.kind === 'blob') {
    return { blob: source.blob, mimeType: source.blob.type };
  }
  throw new Error(
    `Asset source kind "${source.kind}" not supported by this store`
  );
}

/** prepareImport 返回值:统一构造的导入数据(供三个 store 复用) */
export interface PreparedImport {
  id: AssetId;
  blob: Blob;
  metadata: AssetMetadata;
  type: Asset['type'];
}

/** 富元数据提取结果(基础 metadata 之外的可选字段) */
interface RichMetadata {
  dimensions?: { width: number; height: number };
  duration?: number;
  pages?: number;
}

/**
 * 从 Blob 提取富元数据(dimensions/duration/pages)。
 *
 * 提取策略:
 * - image: createImageBitmap → width/height
 * - video/audio: HTMLMediaElement + loadedmetadata → duration
 * - pdf: 暂不提取(需 pdf.js,Phase 2 补全)
 * - 其余: 返回空
 *
 * 所有提取均 try/catch:失败时返回空对象,不阻断 import。
 * Node.js / 测试环境可能无 createImageBitmap / document,自然降级为空。
 */
async function extractRichMetadata(
  blob: Blob,
  type: Asset['type']
): Promise<RichMetadata> {
  try {
    switch (type) {
      case 'image':
        return await extractImageDimensions(blob);
      case 'video':
      case 'audio':
        return await extractMediaDuration(blob, type);
      default:
        return {};
    }
  } catch {
    return {};
  }
}

/** 用 createImageBitmap 提取图片尺寸(浏览器原生 API,失败返回空) */
async function extractImageDimensions(blob: Blob): Promise<RichMetadata> {
  if (typeof createImageBitmap !== 'function') return {};
  const bitmap = await createImageBitmap(blob);
  try {
    return { dimensions: { width: bitmap.width, height: bitmap.height } };
  } finally {
    // 释放 ImageBitmap 资源,避免内存泄漏(浏览器 GC 不保证立即回收)
    if (typeof bitmap.close === 'function') bitmap.close();
  }
}

/** 用 HTMLMediaElement 提取视频/音频时长(浏览器环境,失败返回空) */
async function extractMediaDuration(
  blob: Blob,
  type: 'video' | 'audio'
): Promise<RichMetadata> {
  if (typeof document === 'undefined') return {};
  const url = URL.createObjectURL(blob);
  try {
    const el = document.createElement(type === 'video' ? 'video' : 'audio');
    el.preload = 'metadata';
    el.src = url;
    return await new Promise<RichMetadata>((resolve) => {
      const finish = (result: RichMetadata) => {
        el.onloadedmetadata = null;
        el.onerror = null;
        el.removeAttribute('src');
        resolve(result);
      };
      el.onloadedmetadata = () => {
        const duration = el.duration;
        finish(Number.isFinite(duration) ? { duration } : {});
      };
      el.onerror = () => finish({});
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * 从 AssetSource 准备导入数据(共享逻辑,供 Memory/OPFS/IDB store 复用):
 * 提取 blob + MIME、生成 id、推断 type、构造 metadata(含富元数据)。
 * 各 store 只需负责"写入 blob + 存元数据"。
 *
 * W6.4:异步提取 dimensions(image)/ duration(video/audio)/ pages(pdf,暂 stub)。
 * 富元数据提取失败时静默降级为 undefined,不阻断 import。
 */
export async function prepareImport(source: AssetSource): Promise<PreparedImport> {
  const { blob, mimeType: rawMime } = extractBlobFromSource(source);
  const id = generateId();
  const mimeType = rawMime || 'application/octet-stream';
  const type = inferAssetType(mimeType);

  const metadata: AssetMetadata = {
    mimeType,
    size: blob.size,
    format: getFormatFromMime(mimeType),
  };

  // 富元数据(异步,失败静默降级)
  const rich = await extractRichMetadata(blob, type);
  if (rich.dimensions) metadata.dimensions = rich.dimensions;
  if (rich.duration !== undefined) metadata.duration = rich.duration;
  if (rich.pages !== undefined) metadata.pages = rich.pages;

  return { id, blob, metadata, type };
}

/** 从 BlobHandle.path 解析出 AssetId(共享,各 store 按 prefix 调用) */
export function parseBlobPath(path: string, prefix: string): AssetId {
  const fullPrefix = `${prefix}://`;
  if (path.startsWith(fullPrefix)) {
    return path.slice(fullPrefix.length);
  }
  return path;
}

/** 构造完整 Asset 元数据 + 默认字段(共享工厂) */
export function buildAsset(
  id: AssetId,
  blob: Blob,
  metadata: AssetMetadata,
  type: Asset['type'],
  pathPrefix: string
): Asset {
  const now = Date.now();
  return {
    id,
    type,
    metadata,
    blob: {
      path: `${pathPrefix}://${id}`,
      size: blob.size,
      mimeType: metadata.mimeType,
    },
    history: [],
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Memory store 的 BlobHandle.path 前缀 */
const MEMORY_PATH_PREFIX = 'memory';

/** 创建内存版 AssetStore（降级方案，不持久化） */
export function createMemoryAssetStore(): AssetStore {
  const assets = new Map<AssetId, Asset>();
  const blobs = new Map<AssetId, Blob>();

  return {
    async import(source) {
      const { id, blob, metadata, type } = await prepareImport(source);
      blobs.set(id, blob);
      const asset = buildAsset(id, blob, metadata, type, MEMORY_PATH_PREFIX);
      assets.set(id, asset);
      return asset;
    },

    async get(id) {
      return assets.get(id);
    },

    async getBlob(handle) {
      const id = parseBlobPath(handle.path, MEMORY_PATH_PREFIX);
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
      const asset = buildAsset(id, blob, metadata, type, MEMORY_PATH_PREFIX);
      assets.set(id, asset);
      return asset;
    },
  };
}

/** 工厂配置(W2.8) */
export interface CreateAssetStoreOptions {
  /** 是否优先使用 OPFS(默认 true);为 false 时跳过 OPFS */
  preferOpfs?: boolean;
}

/**
 * AssetStore 工厂:自动探测环境,按降级链创建存储(W2.8)。
 *
 * 顺序:
 *   1. preferOpfs(默认 true)且 OPFS 可用 → OpfsAssetStore
 *   2. IndexedDB 可用 → IdbAssetStore(Dexie)
 *   3. 兜底 → MemoryAssetStore(始终可用,不持久化)
 *
 * 任一阶段抛错均自动降级,最终必定返回一个可用 store。
 */
export async function createAssetStore(
  options: CreateAssetStoreOptions = {}
): Promise<AssetStore> {
  const preferOpfs = options.preferOpfs ?? true;

  // 1. OPFS
  if (preferOpfs && isOpfsSupported()) {
    try {
      return await createOpfsAssetStore();
    } catch (err) {
      // OPFS 初始化失败,降级到 IndexedDB
      console.warn('[lokvis] OPFS unavailable, falling back to IndexedDB:', err);
    }
  }

  // 2. IndexedDB
  if (isIdbSupported()) {
    try {
      return await createIdbAssetStore();
    } catch (err) {
      console.warn('[lokvis] IndexedDB unavailable, falling back to memory:', err);
    }
  }

  // 3. Memory(兜底,始终可用)
  return createMemoryAssetStore();
}
