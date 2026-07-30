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
import {
  probeImageDimensions,
  probeMediaDuration,
} from '@lokvis/browser-adapter';
import { createOpfsAssetStore, isOpfsSupported } from './opfs-asset-store.js';
import { createIdbAssetStore, isIdbSupported } from './idb-asset-store.js';
import { AssetBlobNotFoundError } from './errors.js';

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
  /**
   * 释放底层资源(W21.6)。
   *
   * - Memory store:清空 Map(数据不可恢复)
   * - OPFS store:清空内存 Map + 关闭 Dexie 连接(OPFS 文件不删除,
   *   下次创建 store 时从 IndexedDB metadata 预加载恢复)
   * - IDB store:关闭 Dexie 连接(IDB 数据不删除)
   *
   * 幂等:重复调用为 no-op。
   * 注:关闭后的 store 调用 import/get/getBlob 等方法行为未定义,
   * 调用方应仅在不再使用该 store 时调用 dispose。
   */
  dispose?(): Promise<void>;
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
}

/**
 * 从 Blob 提取富元数据(dimensions/duration)。
 *
 * 提取策略(实现在 @lokvis/browser-adapter MediaProbe,ADR-015):
 * - image: probeImageDimensions(createImageBitmap)→ width/height
 * - video/audio: probeMediaDuration(HTMLMediaElement)→ duration
 * - 其余: 返回空
 *
 * 注:PDF 页数不在此处提取。页数属领域特定元数据,应经 plugin-pdf 注册的
 * `pdf.read-info` MetadataReader(runtime.readAssetPdfInfo)按需读取,
 * 而非在 Runtime 层用脆弱的结构正则猜测(架构:Runtime 不感知 PDF 结构)。
 *
 * 所有提取均 try/catch:失败时返回空对象,不阻断 import。
 * Node.js / 测试环境无浏览器 API 时,adapter 返回 undefined 自然降级为空。
 *
 * TD-3.9 长期方案:catch 不再静默吞错,console.warn 记录异常(区分"无元数据"
 * 与"提取异常")。asset-store 位于 Runtime 层,无 ctx.log 上下文(不像
 * plugin/capability 走 ExecutionContext / MetadataReaderContext),与
 * opfs-asset-store.ts 的错误日志策略一致。
 */
async function extractRichMetadata(
  blob: Blob,
  type: Asset['type']
): Promise<RichMetadata> {
  try {
    switch (type) {
      case 'image': {
        const dimensions = await probeImageDimensions(blob);
        return dimensions ? { dimensions } : {};
      }
      case 'video':
      case 'audio': {
        const duration = await probeMediaDuration(blob, type);
        return duration !== undefined ? { duration } : {};
      }
      default:
        return {};
    }
  } catch (err) {
    // TD-3.9:区分"无元数据"(default 分支返回 {},无日志)与"提取异常"(此处 warn)
    console.warn(
      `[lokvis:asset-store] extractRichMetadata failed for ${type} blob (${blob.size} bytes):`,
      err
    );
    return {};
  }
}

/**
 * 从 AssetSource 准备导入数据(共享逻辑,供 Memory/OPFS/IDB store 复用):
 * 提取 blob + MIME、生成 id、推断 type、构造 metadata(含富元数据)。
 * 各 store 只需负责"写入 blob + 存元数据"。
 *
 * W6.4:异步提取 dimensions(image)/ duration(video/audio)。
 * 富元数据提取失败时静默降级为 undefined,不阻断 import。
 * 注:PDF 页数不在导入时提取,改由 runtime.readAssetPdfInfo 按需读取。
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
      if (!blob) throw new AssetBlobNotFoundError(`Blob not found for path: ${handle.path}`);
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

    // W21.6: 清空内存 Map,释放 Blob 引用(数据不可恢复)
    async dispose() {
      assets.clear();
      blobs.clear();
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
