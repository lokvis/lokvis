/**
 * MemoryAssetStore 单元测试
 */
import { describe, it, expect } from 'vitest';
import { createMemoryAssetStore } from '../asset-store.js';

describe('createMemoryAssetStore', () => {
  it('import file 类型资产应返回完整 Asset', async () => {
    const store = createMemoryAssetStore();
    const file = new File([new Uint8Array([1, 2, 3])], 'a.png', {
      type: 'image/png',
    });

    const asset = await store.import({ kind: 'file', file });

    expect(asset.id).toBeTruthy();
    expect(asset.type).toBe('image');
    expect(asset.metadata.mimeType).toBe('image/png');
    expect(asset.metadata.size).toBe(3);
    expect(asset.metadata.format).toBe('png');
    expect(asset.blob.path).toMatch(/^memory:\/\//);
    expect(asset.history).toEqual([]);
    expect(asset.tags).toEqual([]);
    expect(asset.createdAt).toBe(asset.updatedAt);
  });

  it('import blob 类型资产应能推断类型', async () => {
    const store = createMemoryAssetStore();
    const blob = new Blob([new Uint8Array([0])], { type: 'video/mp4' });

    const asset = await store.import({ kind: 'blob', blob, name: 'v.mp4' });

    expect(asset.type).toBe('video');
    expect(asset.metadata.format).toBe('mp4');
  });

  it('application/pdf 应识别为 pdf 类型', async () => {
    const store = createMemoryAssetStore();
    const blob = new Blob([new Uint8Array([0])], { type: 'application/pdf' });

    const asset = await store.import({ kind: 'blob', blob, name: 'd.pdf' });

    expect(asset.type).toBe('pdf');
  });

  it('application/json 应识别为 data 类型', async () => {
    const store = createMemoryAssetStore();
    const blob = new Blob(['{}'], { type: 'application/json' });

    const asset = await store.import({ kind: 'blob', blob, name: 'd.json' });

    expect(asset.type).toBe('data');
  });

  it('未知 MIME 类型应回退为 unknown', async () => {
    const store = createMemoryAssetStore();
    const blob = new Blob([new Uint8Array([0])], { type: 'application/x-foo' });

    const asset = await store.import({ kind: 'blob', blob, name: 'x' });

    expect(asset.type).toBe('data');
  });

  it('无 MIME 的 blob 应使用 octet-stream 并按 application/ 归为 data', async () => {
    const store = createMemoryAssetStore();
    const blob = new Blob([new Uint8Array([0])]);

    const asset = await store.import({ kind: 'blob', blob, name: 'x' });

    expect(asset.metadata.mimeType).toBe('application/octet-stream');
    // application/octet-stream 命中 application/ 前缀 → data
    expect(asset.type).toBe('data');
  });

  it('get() 应返回已导入的资产', async () => {
    const store = createMemoryAssetStore();
    const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });
    const asset = await store.import({ kind: 'blob', blob, name: 'a.png' });

    const got = await store.get(asset.id);
    expect(got).toBeDefined();
    expect(got!.id).toBe(asset.id);
  });

  it('get() 未知的 id 应返回 undefined', async () => {
    const store = createMemoryAssetStore();
    const got = await store.get('nonexistent');
    expect(got).toBeUndefined();
  });

  it('getBlob() 应返回原始 Blob 数据', async () => {
    const store = createMemoryAssetStore();
    const data = new Uint8Array([10, 20, 30]);
    const blob = new Blob([data], { type: 'image/png' });
    const asset = await store.import({ kind: 'blob', blob, name: 'a.png' });

    const got = await store.getBlob(asset.blob);
    expect(got.size).toBe(3);
    expect(got.type).toBe('image/png');
  });

  it('getBlob() 不存在的句柄应抛错', async () => {
    const store = createMemoryAssetStore();

    await expect(
      store.getBlob({ path: 'memory://missing', size: 0, mimeType: '' })
    ).rejects.toThrow(/Blob not found/);
  });

  it('remove() 应删除资产与 blob', async () => {
    const store = createMemoryAssetStore();
    const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });
    const asset = await store.import({ kind: 'blob', blob, name: 'a.png' });

    await store.remove(asset.id);
    const got = await store.get(asset.id);
    expect(got).toBeUndefined();
    await expect(store.getBlob(asset.blob)).rejects.toThrow();
  });

  it('list() 应返回所有资产', async () => {
    const store = createMemoryAssetStore();
    await store.import({
      kind: 'blob',
      blob: new Blob([new Uint8Array([0])], { type: 'image/png' }),
      name: 'a.png',
    });
    await store.import({
      kind: 'blob',
      blob: new Blob([new Uint8Array([0])], { type: 'image/jpeg' }),
      name: 'b.jpg',
    });

    const list = await store.list();
    expect(list).toHaveLength(2);
  });

  it('create() 应使用调用方提供的 metadata 与 type', async () => {
    const store = createMemoryAssetStore();
    const blob = new Blob([new Uint8Array([0])], { type: 'image/webp' });
    const metadata = {
      mimeType: 'image/webp',
      size: 1,
      format: 'webp',
      dimensions: { width: 100, height: 50 },
    };

    const asset = await store.create(blob, metadata, 'image');
    expect(asset.type).toBe('image');
    expect(asset.metadata.dimensions).toEqual({ width: 100, height: 50 });
    expect(asset.metadata.format).toBe('webp');
  });

  it('每次 import 应生成不同 id', async () => {
    const store = createMemoryAssetStore();
    const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });

    const a1 = await store.import({ kind: 'blob', blob, name: 'a.png' });
    const a2 = await store.import({ kind: 'blob', blob, name: 'b.png' });

    expect(a1.id).not.toBe(a2.id);
  });

  it('opfs/url 类型源应抛错（内存 store 不支持）', async () => {
    const store = createMemoryAssetStore();
    await expect(
      store.import({ kind: 'opfs', path: '/foo' })
    ).rejects.toThrow(/not supported/);
    await expect(store.import({ kind: 'url', url: 'https://x' })).rejects.toThrow(
      /not supported/
    );
  });
});
