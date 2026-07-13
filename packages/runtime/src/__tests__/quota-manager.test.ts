/**
 * quota-manager 单元测试(W2.2)
 *
 * 直接测试 QuotaExceededError / estimateSourceSize / wrapAssetStoreWithQuota,
 * 不经过 Runtime,聚焦:
 * - 配额预检:import/create 超限抛 QuotaExceededError
 * - usage 累加与 remove 回退
 * - _getQuotaUsage 的 -1(未初始化)与正数(已初始化)两种状态
 * - runExclusive 串行化:并发 import 不会因 TOCTOU 双双通过校验
 * - get/getBlob/list 直接透传(不经过串行化链)
 */
import { describe, it, expect } from 'vitest';
import {
  QuotaExceededError,
  estimateSourceSize,
  wrapAssetStoreWithQuota,
  type QuotaAwareAssetStore,
} from '../managers/quota-manager.js';
import { createMemoryAssetStore, type AssetStore } from '../asset-store.js';

function makeBlob(size: number, type = 'image/png'): Blob {
  return new Blob([new Uint8Array(size)], { type });
}

describe('QuotaExceededError', () => {
  it('携带 usage / delta / quota 字段', () => {
    const err = new QuotaExceededError(100, 50, 120);
    expect(err.usage).toBe(100);
    expect(err.delta).toBe(50);
    expect(err.quota).toBe(120);
    expect(err.name).toBe('QuotaExceededError');
    expect(err.message).toContain('usage=100');
    expect(err.message).toContain('delta=50');
    expect(err.message).toContain('quota=120');
  });
});

describe('estimateSourceSize', () => {
  it('file 源返回 file.size', () => {
    const file = new File([new Uint8Array(42)], 'a.png', { type: 'image/png' });
    expect(estimateSourceSize({ kind: 'file', file })).toBe(42);
  });

  it('blob 源返回 blob.size', () => {
    expect(estimateSourceSize({ kind: 'blob', blob: makeBlob(99), name: 'a' })).toBe(99);
  });

  it('url 源返回 0(大小未知,跳过预检)', () => {
    expect(estimateSourceSize({ kind: 'url', url: 'http://x/a.png' })).toBe(0);
  });

  it('opfs 源返回 0(大小未知,跳过预检)', () => {
    expect(estimateSourceSize({ kind: 'opfs', path: '/a.png' })).toBe(0);
  });
});

describe('wrapAssetStoreWithQuota - 配额预检', () => {
  function makeStore(quota: number): { store: QuotaAwareAssetStore; inner: AssetStore } {
    const inner = createMemoryAssetStore();
    return { store: wrapAssetStoreWithQuota(inner, quota), inner };
  }

  it('import 超限应抛 QuotaExceededError', async () => {
    const { store } = makeStore(50);
    await expect(
      store.import({ kind: 'blob', blob: makeBlob(100), name: 'a.png' })
    ).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it('import 成功后 usage 应累加', async () => {
    const { store } = makeStore(1000);
    await store.import({ kind: 'blob', blob: makeBlob(100), name: 'a.png' });
    await store.import({ kind: 'blob', blob: makeBlob(200), name: 'b.png' });
    expect(store._getQuotaUsage()).toBe(300);
  });

  it('create 超限应抛 QuotaExceededError(使用 metadata.size 校验)', async () => {
    const { store } = makeStore(50);
    await expect(
      store.create(
        makeBlob(100),
        { mimeType: 'image/png', size: 100, format: 'png' },
        'image'
      )
    ).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it('create 成功后 usage 应累加', async () => {
    const { store } = makeStore(1000);
    await store.create(
      makeBlob(50),
      { mimeType: 'image/png', size: 50, format: 'png' },
      'image'
    );
    expect(store._getQuotaUsage()).toBe(50);
  });

  it('remove 后 usage 应回退', async () => {
    const { store } = makeStore(1000);
    const a = await store.import({ kind: 'blob', blob: makeBlob(100), name: 'a.png' });
    const b = await store.import({ kind: 'blob', blob: makeBlob(200), name: 'b.png' });
    expect(store._getQuotaUsage()).toBe(300);

    await store.remove(a.id);
    expect(store._getQuotaUsage()).toBe(200);

    await store.remove(b.id);
    expect(store._getQuotaUsage()).toBe(0);
  });

  it('remove 不存在的资产不应使 usage 为负', async () => {
    const { store } = makeStore(1000);
    await store.import({ kind: 'blob', blob: makeBlob(100), name: 'a.png' });
    // remove 一个不存在的 id(existing === undefined,usage 不变)
    await store.remove('nonexistent-id');
    expect(store._getQuotaUsage()).toBe(100);
  });
});

describe('wrapAssetStoreWithQuota - _getQuotaUsage', () => {
  it('未初始化(无任何 import/create)时返回 -1', () => {
    const inner = createMemoryAssetStore();
    const store = wrapAssetStoreWithQuota(inner, 1000);
    // list 等读操作不触发 ensureInit
    expect(store._getQuotaUsage()).toBe(-1);
  });

  it('import 后返回已累加的 usage', async () => {
    const store = wrapAssetStoreWithQuota(createMemoryAssetStore(), 1000);
    await store.import({ kind: 'blob', blob: makeBlob(100), name: 'a.png' });
    expect(store._getQuotaUsage()).toBe(100);
  });

  it('ensureInit 仅触发一次:后续操作不重新累加 list', async () => {
    const inner = createMemoryAssetStore();
    // 预先注入一个资产(模拟"刷新后内存 Map 为空但 list 有数据")
    await inner.import({ kind: 'blob', blob: makeBlob(50), name: 'pre.png' });
    const store = wrapAssetStoreWithQuota(inner, 1000);
    // 首次 import 触发 ensureInit:list() 累加 50,再 +100
    await store.import({ kind: 'blob', blob: makeBlob(100), name: 'a.png' });
    expect(store._getQuotaUsage()).toBe(150);
  });
});

describe('wrapAssetStoreWithQuota - 透传方法', () => {
  it('get/getBlob/list 不经过配额校验直接透传', async () => {
    const inner = createMemoryAssetStore();
    const store = wrapAssetStoreWithQuota(inner, 1); // 极小配额
    // 透传 list(不抛配额错)
    expect(await store.list()).toHaveLength(0);
    // 透传 get(不存在返回 undefined,不抛配额错)
    expect(await store.get('nope')).toBeUndefined();
  });
});

describe('wrapAssetStoreWithQuota - 串行化(TOCTOU 防御)', () => {
  it('并发 import 不会因 TOCTOU 双双通过校验', async () => {
    // 配额仅够 1 个 100B 资产;若串行化失效,两个并发都会基于 usage=0 通过校验
    const store = wrapAssetStoreWithQuota(createMemoryAssetStore(), 150);
    const p1 = store.import({ kind: 'blob', blob: makeBlob(100), name: 'a.png' });
    const p2 = store.import({ kind: 'blob', blob: makeBlob(100), name: 'b.png' });

    const results = await Promise.allSettled([p1, p2]);
    // 恰好一个成功(usage 100),另一个因 100+100>150 抛 QuotaExceededError
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.status === 'rejected' && rejected[0]!.reason).toBeInstanceOf(
      QuotaExceededError
    );
    // 成功的那个累加后 usage=100
    expect(store._getQuotaUsage()).toBe(100);
  });

  it('一次 import 失败不阻塞后续 import(chain 不传播 rejection)', async () => {
    const store = wrapAssetStoreWithQuota(createMemoryAssetStore(), 50);
    // 第一次 import 超限失败
    await expect(
      store.import({ kind: 'blob', blob: makeBlob(100), name: 'big.png' })
    ).rejects.toBeInstanceOf(QuotaExceededError);
    // 第二次 import(小文件)应能成功 —— chain 不因前次失败而阻塞
    await store.import({ kind: 'blob', blob: makeBlob(40), name: 'small.png' });
    expect(store._getQuotaUsage()).toBe(40);
  });
});
