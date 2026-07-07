/**
 * exportAsset MIME 类型修复回归测试
 *
 * OPFS 存储后端用 .bin 扩展名保存 blob,读取时 fileHandle.getFile() 返回的
 * File.type 为空字符串。exportAsset 应从 asset.metadata.mimeType 补全 Blob type,
 * 否则 Object URL 的 Content-Type 退化为 application/octet-stream,
 * 浏览器下载时文件扩展名变成 .octet-stream。
 */
import { describe, it, expect } from 'vitest';
import type { Asset, AssetId, AssetSource, AssetMetadata, BlobHandle } from '@lokvis/schema';
import { LokvisRuntimeImpl } from '../runtime.js';
import { createMemoryAssetStore, type AssetStore } from '../asset-store.js';

/**
 * 包装一个 AssetStore,使其 getBlob 返回指定 type 的 Blob,
 * 模拟 OPFS .bin 文件读取时 File.type 丢失的场景(空字符串或 application/octet-stream)。
 */
function wrapWithMimelessGetBlob(inner: AssetStore, fakeType: string): AssetStore {
  return {
    async import(source: AssetSource) {
      return inner.import(source);
    },
    async get(id: AssetId) {
      return inner.get(id);
    },
    async getBlob(handle: BlobHandle): Promise<Blob> {
      const blob = await inner.getBlob(handle);
      // 模拟 OPFS 读取 .bin 文件时 type 丢失/降级
      return new Blob([blob], { type: fakeType });
    },
    async remove(id: AssetId) {
      return inner.remove(id);
    },
    async list() {
      return inner.list();
    },
    async create(blob: Blob, metadata: AssetMetadata, type: Asset['type']) {
      return inner.create(blob, metadata, type);
    },
  };
}

describe('exportAsset MIME 类型修复', () => {
  it('当 getBlob 返回空 type 时,应从 metadata.mimeType 补全 Blob type', async () => {
    const runtime = new LokvisRuntimeImpl({
      assetStore: wrapWithMimelessGetBlob(createMemoryAssetStore(), ''),
    });

    const id = await runtime.importAsset({
      kind: 'blob',
      blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/webp' }),
      name: 'a.webp',
    });

    const exported = await runtime.exportAsset(id);
    expect(exported.type).toBe('image/webp');
  });

  it('当 getBlob 返回 application/octet-stream 时,应从 metadata.mimeType 补全 Blob type', async () => {
    // OPFS .bin 文件读取时,浏览器对未知扩展名返回 'application/octet-stream'
    // 而非空字符串 —— 这是一个非空但无效的 MIME type
    const runtime = new LokvisRuntimeImpl({
      assetStore: wrapWithMimelessGetBlob(
        createMemoryAssetStore(),
        'application/octet-stream'
      ),
    });

    const id = await runtime.importAsset({
      kind: 'blob',
      blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' }),
      name: 'a.png',
    });

    const exported = await runtime.exportAsset(id);
    // 修复前:blob.type='application/octet-stream' 被误认为有效 type 直接返回
    // 修复后:识别为 OPFS 兜底 MIME,从 metadata.mimeType 补全为 image/png
    expect(exported.type).toBe('image/png');
  });

  it('当 getBlob 返回正确 type 时,不应改变 Blob type', async () => {
    // Memory store 的 getBlob 直接返回原 Blob,type 未丢失
    const runtime = new LokvisRuntimeImpl({
      assetStore: createMemoryAssetStore(),
    });

    const id = await runtime.importAsset({
      kind: 'blob',
      blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' }),
      name: 'b.png',
    });

    const exported = await runtime.exportAsset(id);
    expect(exported.type).toBe('image/png');
  });

  it('export 后应返回独立 Blob(非底层引用),removeAsset 后仍可读取', async () => {
    // WatermarkBatchTool 场景:exportAsset 后立即 removeAsset 清理资产。
    // 若 exportAsset 返回 OPFS File 引用,removeAsset 删除底层文件后
    // File 变悬空引用,后续读取失败。exportAsset 必须返回独立 Blob(拷贝数据)。
    const runtime = new LokvisRuntimeImpl({
      assetStore: createMemoryAssetStore(),
    });

    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const id = await runtime.importAsset({
      kind: 'blob',
      blob: new Blob([data], { type: 'image/png' }),
      name: 'c.png',
    });

    const exported = await runtime.exportAsset(id);
    // 立即删除 asset(模拟 WatermarkBatchTool 清理)
    await runtime.removeAsset(id);
    // exported 必须仍然可读(数据已拷贝,不依赖底层存储)
    const text = await exported.text();
    expect(text).toBe(new TextDecoder().decode(data));
  });
});
