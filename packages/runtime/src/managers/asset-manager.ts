/**
 * Asset Manager
 *
 * 从 runtime.ts 抽取的资产操作逻辑,包装为独立类。
 *
 * 职责:
 * - importAsset:URL fetch + 超时保护 / OPFS 不支持错误 / blob 导入 + 事件发射
 * - getAsset:资产查找(不存在抛 "Asset not found")
 * - exportAsset:OPFS fallback MIME 补全 + arrayBuffer 显式拉取(避免悬空引用)
 * - readAssetExif:MetadataReader 依赖反转查找与降级
 * - removeAsset:删除 + 事件发射
 * - listAssets:列表
 * - getStorageUsage:O(1) 缓存路径 + O(n) fallback
 *
 * 设计:
 * - 通过 deps 注入 assetStore / eventBus / metadataReaders / storageQuota,
 *   不持有 Runtime 实例,避免循环依赖。
 * - metadataReaders 由 Runtime 持有并通过 `_registerMetadataReader` 写入,
 *   这里按引用读取(Map 突变对 AssetManager 立即可见),保持 Plugin 注册语义不变。
 */

import { getOpfsRoot, isOpfsSupported } from '@lokvis/browser-adapter';
import type {
  Asset,
  AssetId,
  AssetSource,
  EventBus,
  ExifData,
  ImageMetadata,
  MetadataReader,
  MetadataReaderContext,
  PdfInfo,
} from '@lokvis/schema';
import { METADATA_READER_NAMES } from '@lokvis/schema';
import type { QuotaAwareAssetStore } from './quota-manager.js';
import { AssetNotFoundError } from '../errors.js';

/** AssetManager 依赖 */
export interface AssetManagerDeps {
  assetStore: QuotaAwareAssetStore;
  eventBus: EventBus;
  metadataReaders: Map<string, MetadataReader>;
  /** 配额上限,用于 getStorageUsage 返回值(不参与校验,校验在 quota-manager 内) */
  storageQuota: number;
}

/** OPFS 后端用 .bin 存储时,File.type 退化的兜底 MIME */
const OPFS_FALLBACK_MIME = 'application/octet-stream';

/** URL 导入超时(覆盖绝大多数正常图片下载) */
const URL_FETCH_TIMEOUT_MS = 30_000;

/** AssetManager:资产操作封装,由 RuntimeImpl 持有并委托 */
export class AssetManager {
  constructor(private readonly deps: AssetManagerDeps) {}

  /**
   * 导入资产。
   *
   * - file/blob 源直接透传给 assetStore.import
   * - url 源在 runtime 层 fetch → blob(含 30s 超时保护),再走 blob 导入
   * - opfs 源通过 File System Access API 读取 OPFS 文件 → file 导入(仅浏览器)
   */
  async importAsset(source: AssetSource): Promise<AssetId> {
    // 修复 review 报告：原实现直接透传 source 给 assetStore.import，
    // 但 MemoryAssetStore/OpfsAssetStore/IdbAssetStore 的 extractBlobFromSource
    // 仅支持 file/blob 两种 kind，url/opfs 会抛 "not supported"。
    // 这里在 runtime 层兜底处理 url（fetch → blob），opfs 暂不支持（OPFS
    // 路径访问需要 filesystem access permission，未来单独实现）
    let effectiveSource = source;
    if (source.kind === 'url') {
      // 超时保护:防止慢响应或挂起的 URL 无限期阻塞 import。
      // 30s 覆盖绝大多数正常图片下载;超时后 abort 并抛明确错误。
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);
      try {
        const resp = await fetch(source.url, { signal: controller.signal });
        if (!resp.ok) {
          throw new Error(`Failed to fetch asset from ${source.url}: ${resp.status} ${resp.statusText}`);
        }
        const blob = await resp.blob();
        const name = source.url.split('/').pop()?.split('?')[0] || 'asset';
        effectiveSource = { kind: 'blob', blob, name };
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw new Error(`Failed to fetch asset from ${source.url}: timed out after 30s`);
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    } else if (source.kind === 'opfs') {
      // OPFS(Origin Private File System)导入:经 adapter StorageAdapter
      // 读取浏览器 origin 私有文件系统中的文件,转为 blob 源走标准导入。
      if (!isOpfsSupported()) {
        throw new Error(
          "AssetSource kind 'opfs' requires a browser environment with File System Access API support"
        );
      }
      const root = await getOpfsRoot();
      const segments = source.path.split('/').filter(Boolean);
      let dirHandle: FileSystemDirectoryHandle = root;
      // 逐级导航到目标文件所在目录
      for (let i = 0; i < segments.length - 1; i++) {
        dirHandle = await dirHandle.getDirectoryHandle(segments[i]!);
      }
      const fileName = segments[segments.length - 1];
      if (!fileName) {
        throw new Error(`Invalid OPFS path: '${source.path}' does not point to a file`);
      }
      const fileHandle = await dirHandle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      effectiveSource = { kind: 'file', file };
    }

    const asset = await this.deps.assetStore.import(effectiveSource);
    this.deps.eventBus.emit({
      type: 'asset:imported',
      assetId: asset.id,
      metadata: asset.metadata,
    });
    return asset.id;
  }

  /**
   * 获取资产(不存在抛 AssetNotFoundError,SDK 经 instanceof 转换)。
   */
  async getAsset(id: AssetId): Promise<Asset> {
    const asset = await this.deps.assetStore.get(id);
    if (!asset) throw new AssetNotFoundError(id);
    return asset;
  }

  /**
   * 导出资产为 Blob。
   *
   * OPFS 存储后端用 .bin 扩展名存储,读取时 fileHandle.getFile() 返回的
   * File.type 可能为空字符串或 'application/octet-stream'(浏览器对未知扩展名
   * 的默认兜底 MIME)。这两种情况都会导致 Object URL 的 Content-Type 退化,
   * 下载时文件扩展名变成 .octet-stream。
   * 用 asset metadata 的 mimeType 补全 Blob type(IDB/Memory 后端不受影响)。
   *
   * 关键:用 arrayBuffer() 显式读取数据到内存,再构造新 Blob。
   * 不能用 new Blob([blob]) —— 浏览器实现中它可能延迟引用底层 OPFS 文件,
   * WatermarkBatchTool 在 export 后立即 removeAsset 删除 OPFS 文件,
   * 导致后续 downloadBlob 读取悬空引用失败("check internet connection")。
   * arrayBuffer() 立即拉取数据,确保返回的 Blob 完全独立于底层存储。
   */
  async exportAsset(id: AssetId, format?: string): Promise<Blob> {
    const asset = await this.getAsset(id);
    const blob = await this.deps.assetStore.getBlob(asset.blob);
    const mimeType =
      !blob.type || blob.type === OPFS_FALLBACK_MIME
        ? asset.metadata.mimeType
        : blob.type;
    const buffer = await blob.arrayBuffer();
    const exported = new Blob([buffer], { type: mimeType });
    this.deps.eventBus.emit({
      type: 'export:completed',
      assetId: id,
      format: format ?? asset.metadata.format,
      size: blob.size,
    });
    return exported;
  }

  /**
   * 读取 image 资产的 EXIF 元数据(W7.3/7.4 长期方案:MetadataReader 依赖反转)。
   *
   * Runtime 持有 plugin-image 通过 ctx.registerMetadataReader('image.read-exif', fn)
   * 注册的 reader 引用,按名调用。reader 内部调 readExifFromBlob(exifr)。
   * Plugin 未安装时优雅降级返回 null(不抛错)。
   *
   * 架构决策:readExif 是 Blob→ExifData 查询,不符合 Engine 层 Blob↔Blob 纯函数
   * 约束,也不符合 Capability Asset[]→Asset[] 契约,故走 MetadataReader 机制,
   * 不进 engine-image、不走 Capability execute。
   */
  async readAssetExif(id: AssetId): Promise<ExifData | null> {
    const asset = await this.getAsset(id);
    if (asset.type !== 'image') return null;
    const reader = this.deps.metadataReaders.get(METADATA_READER_NAMES.imageExif);
    if (!reader) return null; // Plugin 未安装,优雅降级

    // TD-3.4 长期方案:构造 MetadataReaderContext,为 reader 提供可观测信号。
    // log 前缀含 assetId,便于 Sentry 上报与调试时关联具体资产。
    // info 级别不输出(避免噪音),warn/error 走 console。
    const readerCtx: MetadataReaderContext = {
      log: (level, message) => {
        const prefix = `[lokvis:read-asset-exif:${id}]`;
        if (level === 'error') console.error(`${prefix} ${message}`);
        else if (level === 'warn') console.warn(`${prefix} ${message}`);
        // info 不输出(避免噪音)
      },
    };
    return reader(asset, readerCtx) as Promise<ExifData | null>;
  }

  /**
   * 读取 image 资产的 dimensions/format 元数据(MetadataReader 依赖反转)。
   *
   * Runtime 持有 plugin-image 通过 ctx.registerMetadataReader(
   * 'image.read-metadata', fn) 注册的 reader 引用,按名调用。reader 内部调
   * engine-image/node 的 getMetadata(sharp .metadata())。
   * Plugin 未安装时优雅降级返回 null(不抛错)。
   *
   * 架构意义:mcp-server 经此方法读取处理后输出图像的精确尺寸,不再直接
   * import @lokvis/engine-image(五层架构单向依赖,见 A1 修复)。
   */
  async readAssetImageMetadata(id: AssetId): Promise<ImageMetadata | null> {
    const asset = await this.getAsset(id);
    if (asset.type !== 'image') return null;
    const reader = this.deps.metadataReaders.get(METADATA_READER_NAMES.imageMetadata);
    if (!reader) return null; // Plugin 未安装,优雅降级

    const readerCtx: MetadataReaderContext = {
      log: (level, message) => {
        const prefix = `[lokvis:read-asset-image-metadata:${id}]`;
        if (level === 'error') console.error(`${prefix} ${message}`);
        else if (level === 'warn') console.warn(`${prefix} ${message}`);
      },
    };
    return reader(asset, readerCtx) as Promise<ImageMetadata | null>;
  }

  /**
   * 读取 pdf 资产的页数(MetadataReader 依赖反转)。
   *
   * Runtime 持有 plugin-pdf 通过 ctx.registerMetadataReader(
   * 'pdf.read-info', fn) 注册的 reader 引用,按名调用。reader 内部调
   * engine-pdf 的 getPdfInfo(pdf-lib getPageCount)。
   * Plugin 未安装时优雅降级返回 null(不抛错)。
   *
   * 架构意义:mcp-server 经此方法读取处理后输出 PDF 的页数,不再直接
   * import @lokvis/engine-pdf(五层架构单向依赖,见 A1 修复)。
   */
  async readAssetPdfInfo(id: AssetId): Promise<PdfInfo | null> {
    const asset = await this.getAsset(id);
    if (asset.type !== 'pdf') return null;
    const reader = this.deps.metadataReaders.get(METADATA_READER_NAMES.pdfInfo);
    if (!reader) return null; // Plugin 未安装,优雅降级

    const readerCtx: MetadataReaderContext = {
      log: (level, message) => {
        const prefix = `[lokvis:read-asset-pdf-info:${id}]`;
        if (level === 'error') console.error(`${prefix} ${message}`);
        else if (level === 'warn') console.warn(`${prefix} ${message}`);
      },
    };
    return reader(asset, readerCtx) as Promise<PdfInfo | null>;
  }

  async removeAsset(id: AssetId): Promise<void> {
    await this.deps.assetStore.remove(id);
    this.deps.eventBus.emit({ type: 'asset:removed', assetId: id });
  }

  async listAssets(): Promise<Asset[]> {
    return this.deps.assetStore.list();
  }

  /**
   * 获取存储使用情况。
   *
   * m6 优化:优先用配额包装器内部维护的 usage(O(1),import/create/remove
   * 时增量更新),避免每次 O(n) 全量 listAssets 影响 StatusBar 刷新。
   * 包装器未就绪(ensureInit 未完成)返回 -1 时,fallback 到 listAssets
   * 实时计算(source of truth,与 W6.4 富元数据一致)。
   */
  async getStorageUsage(): Promise<{ usage: number; quota: number }> {
    const cached = this.deps.assetStore._getQuotaUsage();
    if (cached >= 0) {
      return { usage: cached, quota: this.deps.storageQuota };
    }
    const all = await this.deps.assetStore.list();
    const usage = all.reduce((sum, a) => sum + a.metadata.size, 0);
    return { usage, quota: this.deps.storageQuota };
  }
}
