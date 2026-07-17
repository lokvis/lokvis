/**
 * NodeAssetStore:Node.js 环境的 AssetStore 实现。
 *
 * 基于 fs/promises + workdir,将资产文件存储在 `workdir/.lokvis/assets/` 目录。
 * 元数据保存在内存 Map 中(进程生命周期内有效,不持久化到磁盘)。
 *
 * 用于 MCP Server 的 Node 降级模式:AI 客户端通过 stdio 调用 lokvis tool,
 * tool handler 通过 NodeAssetStore 读写本地文件。
 *
 * 注意:与浏览器端 AssetStore(OPFS/IndexedDB)不同,NodeAssetStore 不支持
 * `kind: 'opfs'` 和 `kind: 'url'`(url 可通过 fetch 支持,但当前不实现)。
 */

import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  Asset,
  AssetId,
  AssetMetadata,
  AssetSource,
  BlobHandle,
} from '@lokvis/schema';
import type { AssetStore } from '@lokvis/runtime';

/** 生成唯一 ID(Node.js 环境 crypto.randomUUID 可用) */
function generateId(): string {
  return crypto.randomUUID();
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

/** 从 AssetSource 提取 Blob 与 MIME */
function extractBlobFromSource(source: AssetSource): {
  blob: Blob;
  mimeType: string;
} {
  if (source.kind === 'file') {
    return { blob: source.file, mimeType: source.file.type || 'application/octet-stream' };
  }
  if (source.kind === 'blob') {
    return { blob: source.blob, mimeType: source.blob.type || 'application/octet-stream' };
  }
  throw new Error(
    `Asset source kind "${source.kind}" not supported by NodeAssetStore`
  );
}

/**
 * Node.js 环境的 AssetStore。
 *
 * @example
 * ```ts
 * const store = new NodeAssetStore('/path/to/workdir');
 * await store.init();
 * const asset = await store.import({ kind: 'file', file: myFile });
 * ```
 */
export class NodeAssetStore implements AssetStore {
  private readonly assets = new Map<AssetId, Asset>();
  private readonly assetsDir: string;

  constructor(workdir: string) {
    this.assetsDir = join(workdir, '.lokvis', 'assets');
  }

  /** 初始化存储目录(必须在其他操作前调用) */
  async init(): Promise<void> {
    await mkdir(this.assetsDir, { recursive: true });
  }

  async import(source: AssetSource): Promise<Asset> {
    const { blob, mimeType } = extractBlobFromSource(source);
    const format = getFormatFromMime(mimeType);
    const metadata: AssetMetadata = {
      mimeType,
      size: blob.size,
      format,
    };
    const type = inferAssetType(mimeType);
    return this.create(blob, metadata, type);
  }

  async get(id: AssetId): Promise<Asset | undefined> {
    return this.assets.get(id);
  }

  async getBlob(handle: BlobHandle): Promise<Blob> {
    const data = await readFile(handle.path);
    return new Blob([data], { type: handle.mimeType });
  }

  async remove(id: AssetId): Promise<void> {
    const asset = this.assets.get(id);
    if (!asset) return;
    // 删除文件,文件不存在的错误(ENOENT)静默忽略,其他错误需记录
    await unlink(asset.blob.path).catch((err) => {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        console.warn(`[lokvis-mcp] node-asset-store: unlink(${asset.blob.path}) failed:`, err);
      }
    });
    this.assets.delete(id);
  }

  async list(): Promise<Asset[]> {
    return Array.from(this.assets.values());
  }

  async create(
    blob: Blob,
    metadata: AssetMetadata,
    type: Asset['type']
  ): Promise<Asset> {
    const id = generateId();
    const ext = metadata.format || 'bin';
    const path = join(this.assetsDir, `${id}.${ext}`);
    const data = new Uint8Array(await blob.arrayBuffer());
    await writeFile(path, data);

    const now = Date.now();
    const asset: Asset = {
      id,
      type,
      metadata,
      blob: { path, size: blob.size, mimeType: metadata.mimeType },
      history: [],
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    this.assets.set(id, asset);
    return asset;
  }
}
