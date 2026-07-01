/**
 * createRuntime / createAssetStore 降级链测试(T5)
 *
 * 在 Node 环境下 OPFS 与 IndexedDB 均不可用,工厂应降级到 Memory store。
 * 通过导入资产后检查 blob.path 前缀验证实际使用的 store 类型。
 */
import { describe, it, expect } from 'vitest';
import { createRuntime, LokvisRuntimeImpl } from '../runtime.js';
import {
  createAssetStore,
  createMemoryAssetStore,
} from '../asset-store.js';
import { isOpfsSupported } from '../opfs-asset-store.js';
import { isIdbSupported } from '../idb-asset-store.js';
import type { AssetSource } from '@lokvis/schema';

/** Node 环境下 OPFS 不可用(无 navigator.storage) */
const OPFS_AVAILABLE = isOpfsSupported();
/** Node 环境(未注入 fake-indexeddb)下 IndexedDB 不可用 */
const IDB_AVAILABLE = isIdbSupported();

const pngBlob = (): Blob =>
  new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });

const pngSource: AssetSource = { kind: 'blob', blob: pngBlob(), name: 'a.png' };

describe('createAssetStore 降级链(T5)', () => {
  it('preferOpfs:false 应跳过 OPFS,无 IDB 时降级到 Memory', async () => {
    const store = await createAssetStore({ preferOpfs: false });
    const asset = await store.import(pngSource);
    // OPFS 已被跳过;若 IDB 不可用则 Memory
    if (!IDB_AVAILABLE) {
      expect(asset.blob.path).toMatch(/^memory:\/\//);
    } else {
      expect(asset.blob.path).toMatch(/^idb:\/\//);
    }
  });

  it('默认在 Node 环境(无 OPFS/IDB)应降级到 Memory store', async () => {
    const store = await createAssetStore();
    const asset = await store.import({
      kind: 'blob',
      blob: pngBlob(),
      name: 'b.png',
    });
    if (!OPFS_AVAILABLE && !IDB_AVAILABLE) {
      expect(asset.blob.path).toMatch(/^memory:\/\//);
    }
    // 无论降级到哪一层,store 始终可用(import 不抛错)
    expect(asset.id).toBeTruthy();
  });

  it('降级后的 store 应支持完整 CRUD(import/get/getBlob/remove/list)', async () => {
    const store = await createAssetStore({ preferOpfs: false });
    const asset = await store.import({
      kind: 'blob',
      blob: pngBlob(),
      name: 'c.png',
    });
    const got = await store.get(asset.id);
    expect(got?.id).toBe(asset.id);
    const blob = await store.getBlob(asset.blob);
    expect(blob.size).toBe(3);
    expect((await store.list()).length).toBeGreaterThanOrEqual(1);
    await store.remove(asset.id);
    expect(await store.get(asset.id)).toBeUndefined();
  });
});

describe('createRuntime 工厂(T5)', () => {
  it('应返回 LokvisRuntimeImpl 实例并可导入资产', async () => {
    const runtime = await createRuntime();
    expect(runtime).toBeInstanceOf(LokvisRuntimeImpl);
    const id = await runtime.importAsset({
      kind: 'blob',
      blob: pngBlob(),
      name: 'd.png',
    });
    expect(id).toBeTruthy();
    const asset = await runtime.getAsset(id);
    expect(asset.metadata.size).toBe(3);
  });

  it('注入自定义 assetStore 应使用该 store(不降级)', async () => {
    const injected = createMemoryAssetStore();
    const runtime = await createRuntime({ assetStore: injected });
    const id = await runtime.importAsset({
      kind: 'blob',
      blob: pngBlob(),
      name: 'e.png',
    });
    const asset = await runtime.getAsset(id);
    // 注入的 Memory store,path 前缀为 memory://
    expect(asset.blob.path).toMatch(/^memory:\/\//);
  });

  it('enableOpfs:false 应传给工厂跳过 OPFS 探测', async () => {
    const runtime = await createRuntime({ enableOpfs: false });
    const id = await runtime.importAsset({
      kind: 'blob',
      blob: pngBlob(),
      name: 'f.png',
    });
    const asset = await runtime.getAsset(id);
    // OPFS 被跳过;Node 无 IDB → Memory
    if (!IDB_AVAILABLE) {
      expect(asset.blob.path).toMatch(/^memory:\/\//);
    }
  });
});
