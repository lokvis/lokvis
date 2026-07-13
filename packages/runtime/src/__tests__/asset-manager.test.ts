/**
 * asset-manager 单元测试(W2.2)
 *
 * 直接测试 AssetManager 类(不经过 Runtime),聚焦:
 * - importAsset:blob/file 直传 / url fetch + 超时 + 非 ok 错误 / opfs 不支持
 * - getAsset:不存在抛 "Asset not found"
 * - exportAsset:OPFS fallback MIME 补全 + arrayBuffer 拉取 + export:completed 事件
 * - readAssetExif:非 image / reader 未注册 / reader 注册后的降级与正常路径
 * - removeAsset:删除 + asset:removed 事件
 * - getStorageUsage:O(1) 缓存路径 + O(n) fallback
 */
import { describe, it, expect, vi } from 'vitest';
import { AssetManager } from '../managers/asset-manager.js';
import { createEventBus } from '../event-bus.js';
import { createMemoryAssetStore } from '../asset-store.js';
import { wrapAssetStoreWithQuota } from '../managers/quota-manager.js';
import type { ExifData, LokvisEvent } from '@lokvis/schema';

/** 构造一个 AssetManager + 收集事件的测试夹具 */
function makeFixture(quota = 1024 * 1024) {
  const inner = createMemoryAssetStore();
  const assetStore = wrapAssetStoreWithQuota(inner, quota);
  const eventBus = createEventBus();
  const metadataReaders = new Map();
  const manager = new AssetManager({
    assetStore,
    eventBus,
    metadataReaders,
    storageQuota: quota,
  });
  const events: LokvisEvent[] = [];
  eventBus.onAny((e) => events.push(e));
  return { manager, eventBus, assetStore: inner, events, metadataReaders };
}

function makeImageBlob(size = 10): Blob {
  return new Blob([new Uint8Array(size)], { type: 'image/png' });
}

describe('AssetManager.importAsset', () => {
  it('blob 源正常导入并发射 asset:imported 事件', async () => {
    const { manager, events } = makeFixture();
    const id = await manager.importAsset({
      kind: 'blob',
      blob: makeImageBlob(50),
      name: 'a.png',
    });
    expect(id).toBeTruthy();
    const imported = events.find((e) => e.type === 'asset:imported') as
      | Extract<LokvisEvent, { type: 'asset:imported' }>
      | undefined;
    expect(imported).toBeDefined();
    expect(imported!.assetId).toBe(id);
  });

  it('file 源正常导入', async () => {
    const { manager } = makeFixture();
    const file = new File([new Uint8Array(20)], 'a.png', { type: 'image/png' });
    const id = await manager.importAsset({ kind: 'file', file });
    const asset = await manager.getAsset(id);
    expect(asset.metadata.size).toBe(20);
  });

  it('opfs 源抛 "not yet supported" 错误', async () => {
    const { manager } = makeFixture();
    await expect(
      manager.importAsset({ kind: 'opfs', path: '/a.png' })
    ).rejects.toThrow(/not yet supported/);
  });

  it('url 源:fetch 成功转 blob 导入', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(makeImageBlob(30), { status: 200, statusText: 'OK' })
    );
    try {
      const { manager } = makeFixture();
      const id = await manager.importAsset({
        kind: 'url',
        url: 'http://x/a.png',
      });
      const asset = await manager.getAsset(id);
      expect(asset.metadata.size).toBe(30);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('url 源:fetch 非 ok 应抛错(含 status)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Blob([]), { status: 404, statusText: 'Not Found' })
    );
    const { manager } = makeFixture();
    await expect(
      manager.importAsset({ kind: 'url', url: 'http://x/missing.png' })
    ).rejects.toThrow(/404/);
    vi.restoreAllMocks();
  });

  it('url 源:AbortError 超时应抛 "timed out after 30s" 错误', async () => {
    // 模拟 fetch 因 AbortController.abort() 抛 AbortError;
    // asset-manager 应将其转换为 "timed out after 30s" 错误
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.reject(new DOMException('Aborted', 'AbortError'))
    );
    const { manager } = makeFixture();
    await expect(
      manager.importAsset({ kind: 'url', url: 'http://slow/x.png' })
    ).rejects.toThrow(/timed out after 30s/);
    vi.restoreAllMocks();
  });
});

describe('AssetManager.getAsset', () => {
  it('资产不存在应抛 "Asset not found: <id>"', async () => {
    const { manager } = makeFixture();
    await expect(manager.getAsset('missing-id')).rejects.toThrow(
      /Asset not found: missing-id/
    );
  });
});

describe('AssetManager.exportAsset', () => {
  it('blob.type 为空时应使用 metadata.mimeType 补全(OPFS fallback)', async () => {
    const { manager, assetStore } = makeFixture();
    // 先 import 一个 image/png 资产
    const id = await manager.importAsset({
      kind: 'blob',
      blob: makeImageBlob(10),
      name: 'a.png',
    });
    // 重写 getBlob 返回 type 为空的 blob(模拟 OPFS .bin 退化)
    const origGetBlob = assetStore.getBlob.bind(assetStore);
    assetStore.getBlob = async () => new Blob([new Uint8Array(10)], { type: '' });
    try {
      const exported = await manager.exportAsset(id);
      expect(exported.type).toBe('image/png');
    } finally {
      assetStore.getBlob = origGetBlob;
    }
  });

  it('blob.type 为 application/octet-stream 时也应补全为 metadata.mimeType', async () => {
    const { manager, assetStore } = makeFixture();
    const id = await manager.importAsset({
      kind: 'blob',
      blob: makeImageBlob(10),
      name: 'a.png',
    });
    const origGetBlob = assetStore.getBlob.bind(assetStore);
    assetStore.getBlob = async () =>
      new Blob([new Uint8Array(10)], { type: 'application/octet-stream' });
    try {
      const exported = await manager.exportAsset(id);
      expect(exported.type).toBe('image/png');
    } finally {
      assetStore.getBlob = origGetBlob;
    }
  });

  it('blob.type 正常时应保留原 type', async () => {
    const { manager } = makeFixture();
    const id = await manager.importAsset({
      kind: 'blob',
      blob: new Blob([new Uint8Array(10)], { type: 'image/jpeg' }),
      name: 'a.jpg',
    });
    const exported = await manager.exportAsset(id);
    expect(exported.type).toBe('image/jpeg');
  });

  it('应发射 export:completed 事件(携带 format 与 size)', async () => {
    const { manager, events } = makeFixture();
    const id = await manager.importAsset({
      kind: 'blob',
      blob: makeImageBlob(50),
      name: 'a.png',
    });
    events.length = 0;
    const exported = await manager.exportAsset(id, 'webp');
    expect(exported.size).toBe(50);
    const completed = events.find((e) => e.type === 'export:completed') as
      | Extract<LokvisEvent, { type: 'export:completed' }>
      | undefined;
    expect(completed).toBeDefined();
    expect(completed!.format).toBe('webp');
    expect(completed!.size).toBe(50);
  });

  it('exported Blob 应独立于底层存储(arrayBuffer 拉取)', async () => {
    const { manager, assetStore } = makeFixture();
    const id = await manager.importAsset({
      kind: 'blob',
      blob: makeImageBlob(20),
      name: 'a.png',
    });
    const exported = await manager.exportAsset(id);
    // 删除底层资产后,exported Blob 仍可读取
    await manager.removeAsset(id);
    const buf = await exported.arrayBuffer();
    expect(buf.byteLength).toBe(20);
    void assetStore;
  });
});

describe('AssetManager.readAssetExif', () => {
  it('非 image 资产应返回 null(即便 reader 已注册)', async () => {
    const { manager, metadataReaders } = makeFixture();
    metadataReaders.set('image.read-exif', async () => ({ make: 'Canon' }));
    const id = await manager.importAsset({
      kind: 'blob',
      blob: new Blob(['hi'], { type: 'text/plain' }),
      name: 'a.txt',
    });
    expect(await manager.readAssetExif(id)).toBeNull();
  });

  it('reader 未注册时返回 null(优雅降级)', async () => {
    const { manager } = makeFixture();
    const id = await manager.importAsset({
      kind: 'blob',
      blob: makeImageBlob(10),
      name: 'a.png',
    });
    expect(await manager.readAssetExif(id)).toBeNull();
  });

  it('reader 注册后应返回 ExifData', async () => {
    const { manager, metadataReaders } = makeFixture();
    const id = await manager.importAsset({
      kind: 'blob',
      blob: makeImageBlob(10),
      name: 'a.png',
    });
    const mockExif: ExifData = { make: 'Canon', model: 'R5', iso: 400 };
    metadataReaders.set('image.read-exif', async () => mockExif);
    const result = await manager.readAssetExif(id);
    expect(result).toEqual(mockExif);
  });

  it('reader 抛错时应传播(不静默吞掉)', async () => {
    const { manager, metadataReaders } = makeFixture();
    const id = await manager.importAsset({
      kind: 'blob',
      blob: makeImageBlob(10),
      name: 'a.png',
    });
    metadataReaders.set('image.read-exif', async () => {
      throw new Error('exifr boom');
    });
    await expect(manager.readAssetExif(id)).rejects.toThrow('exifr boom');
  });
});

describe('AssetManager.removeAsset', () => {
  it('删除后应发射 asset:removed 事件', async () => {
    const { manager, events } = makeFixture();
    const id = await manager.importAsset({
      kind: 'blob',
      blob: makeImageBlob(10),
      name: 'a.png',
    });
    events.length = 0;
    await manager.removeAsset(id);
    const removed = events.find((e) => e.type === 'asset:removed') as
      | Extract<LokvisEvent, { type: 'asset:removed' }>
      | undefined;
    expect(removed).toBeDefined();
    expect(removed!.assetId).toBe(id);
  });
});

describe('AssetManager.listAssets', () => {
  it('应透传 store.list()', async () => {
    const { manager } = makeFixture();
    await manager.importAsset({ kind: 'blob', blob: makeImageBlob(10), name: 'a.png' });
    await manager.importAsset({ kind: 'blob', blob: makeImageBlob(20), name: 'b.png' });
    const list = await manager.listAssets();
    expect(list).toHaveLength(2);
  });
});

describe('AssetManager.getStorageUsage', () => {
  it('O(1) 缓存路径:_getQuotaUsage >= 0 时返回缓存值', async () => {
    const { manager } = makeFixture(2048);
    await manager.importAsset({ kind: 'blob', blob: makeImageBlob(100), name: 'a.png' });
    const usage = await manager.getStorageUsage();
    expect(usage.usage).toBe(100);
    expect(usage.quota).toBe(2048);
  });

  it('O(n) fallback:_getQuotaUsage = -1(未初始化)时退化为 listAssets 累加', async () => {
    const { manager, assetStore } = makeFixture(4096);
    // 直接向 inner store 导入(绕过 quota 包装器的 ensureInit),
    // 使 _getQuotaUsage() 仍返回 -1,触发 getStorageUsage 的 listAssets fallback
    await assetStore.import({ kind: 'blob', blob: makeImageBlob(50), name: 'a.png' });
    await assetStore.import({ kind: 'blob', blob: makeImageBlob(70), name: 'b.png' });
    const usage = await manager.getStorageUsage();
    expect(usage.usage).toBe(120);
    expect(usage.quota).toBe(4096);
  });
});
