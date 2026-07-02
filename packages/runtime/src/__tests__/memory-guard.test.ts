/**
 * MemoryGuard 单元测试(W3.3 / 3.7)
 *
 * 覆盖:track/release 幂等性、压力等级阈值、shouldSpill、spill/restore/evict
 * 经由 fake AssetStore、阈值单调性校验、估算助手。
 */
import { describe, it, expect } from 'vitest';
import type { Asset } from '@lokvis/schema';
import {
  MemoryGuard,
  DEFAULT_MEMORY_BUDGET,
  estimateDecodedBytes,
  estimateBlobBytes,
  type MemoryGuardOptions,
} from '../memory-guard.js';
import type { AssetStore } from '../asset-store.js';

/** 内存版 AssetStore(仅实现 spill/restore/evict 用到的方法) */
function fakeAssetStore(): AssetStore & { created: Asset[] } {
  const created: Asset[] = [];
  const blobs = new Map<string, Blob>();
  let counter = 0;
  const store: AssetStore & { created: Asset[] } = {
    created,
    async import() {
      throw new Error('not used');
    },
    async get(id) {
      return created.find((a) => a.id === id);
    },
    async getBlob(handle) {
      const blob = blobs.get(handle.path);
      if (!blob) throw new Error(`no blob for ${handle.path}`);
      return blob;
    },
    async remove(id) {
      const idx = created.findIndex((a) => a.id === id);
      if (idx >= 0) created.splice(idx, 1);
      blobs.delete(id);
    },
    async list() {
      return [...created];
    },
    async create(blob, metadata, type) {
      const id = `asset-${counter++}`;
      blobs.set(id, blob);
      const asset: Asset = {
        id,
        type,
        metadata,
        blob: { path: id, size: blob.size, mimeType: metadata.mimeType },
        history: [],
        tags: [],
        createdAt: 0,
        updatedAt: 0,
      };
      created.push(asset);
      return asset;
    },
  };
  return store;
}

describe('estimateDecodedBytes / estimateBlobBytes', () => {
  it('decoded bytes = w*h*4 (RGBA)', () => {
    expect(estimateDecodedBytes(4000, 3000)).toBe(48_000_000); // ~46MB
    expect(estimateDecodedBytes(0, 100)).toBe(0);
  });

  it('blob bytes = blob.size', () => {
    const blob = new Blob([new Uint8Array(2048)]);
    expect(estimateBlobBytes(blob)).toBe(2048);
  });
});

describe('MemoryGuard 构造与预算', () => {
  it('默认预算 512MB', () => {
    const g = new MemoryGuard();
    expect(g.budgetBytes).toBe(DEFAULT_MEMORY_BUDGET);
    expect(g.budgetBytes).toBe(512 * 1024 * 1024);
  });

  it('canSpill 取决于是否传入 assetStore', () => {
    expect(new MemoryGuard().canSpill).toBe(false);
    expect(new MemoryGuard({ assetStore: fakeAssetStore() }).canSpill).toBe(true);
  });

  it('阈值非单调时应抛错', () => {
    expect(
      () => new MemoryGuard({ elevatedRatio: 0.9, highRatio: 0.5 })
    ).toThrow(/non-decreasing/);
    expect(
      () => new MemoryGuard({ highRatio: 0.99, criticalRatio: 0.8 })
    ).toThrow(/non-decreasing/);
  });
});

describe('track / release', () => {
  it('track 累加 usage,release 回退', () => {
    const g = new MemoryGuard({ budget: 1000 });
    expect(g.currentUsage).toBe(0);
    const a = g.track(300);
    expect(g.currentUsage).toBe(300);
    const b = g.track(200);
    expect(g.currentUsage).toBe(500);
    a.release();
    expect(g.currentUsage).toBe(200);
    b.release();
    expect(g.currentUsage).toBe(0);
  });

  it('release 幂等:重复调用仅首次生效', () => {
    const g = new MemoryGuard({ budget: 1000 });
    const a = g.track(100);
    a.release();
    a.release();
    a.release();
    expect(g.currentUsage).toBe(0);
  });

  it('track 负数应抛错', () => {
    const g = new MemoryGuard();
    expect(() => g.track(-1)).toThrow(/non-negative/);
  });

  it('reset 归零所有登记', () => {
    const g = new MemoryGuard({ budget: 1000 });
    g.track(100);
    g.track(200);
    expect(g.currentUsage).toBe(300);
    g.reset();
    expect(g.currentUsage).toBe(0);
  });
});

describe('getPressure 阈值', () => {
  const opts: MemoryGuardOptions = { budget: 1000, assetStore: fakeAssetStore() };

  it('<60% → low', () => {
    const g = new MemoryGuard(opts);
    g.track(599);
    expect(g.getPressure()).toBe('low');
  });

  it('60-80% → elevated', () => {
    const g = new MemoryGuard(opts);
    g.track(600);
    expect(g.getPressure()).toBe('elevated');
    g.track(199);
    expect(g.getPressure()).toBe('elevated');
  });

  it('80-95% → high', () => {
    const g = new MemoryGuard(opts);
    g.track(800);
    expect(g.getPressure()).toBe('high');
    g.track(149);
    expect(g.getPressure()).toBe('high');
  });

  it('>=95% → critical', () => {
    const g = new MemoryGuard(opts);
    g.track(950);
    expect(g.getPressure()).toBe('critical');
  });

  it('超预算 ratio > 1 仍 critical', () => {
    const g = new MemoryGuard(opts);
    g.track(2000);
    expect(g.getPressure()).toBe('critical');
    expect(g.getUsageRatio()).toBe(2);
  });
});

describe('shouldSpill', () => {
  it('无 assetStore 时永远 false', () => {
    const g = new MemoryGuard({ budget: 1000 });
    g.track(990);
    expect(g.getPressure()).toBe('critical');
    expect(g.shouldSpill()).toBe(false);
  });

  it('有 assetStore 且 high 时 true', () => {
    const g = new MemoryGuard({ budget: 1000, assetStore: fakeAssetStore() });
    g.track(800);
    expect(g.shouldSpill()).toBe(true);
  });

  it('有 assetStore 但 low 时 false', () => {
    const g = new MemoryGuard({ budget: 1000, assetStore: fakeAssetStore() });
    g.track(100);
    expect(g.shouldSpill()).toBe(false);
  });
});

describe('spill / restore / evict', () => {
  it('无 assetStore 时 spill 抛错', async () => {
    const g = new MemoryGuard({ budget: 1000 });
    await expect(g.spill(new Blob([new Uint8Array(8)]))).rejects.toThrow(
      /requires an assetStore/
    );
  });

  it('spill → restore → evict 完整链路', async () => {
    const store = fakeAssetStore();
    const g = new MemoryGuard({ budget: 1000, assetStore: store });
    const data = new Uint8Array([1, 2, 3, 4]);
    const blob = new Blob([data], { type: 'image/png' });

    const asset = await g.spill(blob);
    expect(asset.type).toBe('image');
    expect(asset.metadata.mimeType).toBe('image/png');
    expect(asset.metadata.size).toBe(4);
    expect(store.created).toHaveLength(1);

    const restored = await g.restore(asset);
    expect(await restored.arrayBuffer()).toEqual(data.buffer);

    await g.evict(asset);
    expect(store.created).toHaveLength(0);
  });

  it('restore 无 assetStore 时抛错', async () => {
    const g = new MemoryGuard();
    await expect(
      g.restore({ id: 'x', blob: { path: 'x', size: 0, mimeType: '' } } as Asset)
    ).rejects.toThrow(/requires an assetStore/);
  });

  it('evict 无 assetStore 时静默(no-op)', async () => {
    const g = new MemoryGuard();
    await expect(
      g.evict({ id: 'x', blob: { path: 'x', size: 0, mimeType: '' } } as Asset)
    ).resolves.toBeUndefined();
  });

  it('spill 默认 MIME 取 blob.type,缺失时 octet-stream', async () => {
    const g = new MemoryGuard({ budget: 1000, assetStore: fakeAssetStore() });
    const noType = new Blob([new Uint8Array([0])]);
    const asset = await g.spill(noType);
    expect(asset.metadata.mimeType).toBe('application/octet-stream');
  });
});
