/**
 * IdbAssetStore 单元测试(PROJECT_PLAN W2)
 *
 * Node 环境无原生 IndexedDB,通过 fake-indexeddb/auto 注入全局。
 * /auto 在模块加载时注册 indexedDB/IDBKeyRange 等全局(早于 Dexie 捕获),
 * 故 Dexie 能正确使用 fake 实现。afterAll 删除全局,避免污染其他测试文件
 * (如 opfs 降级链断言 isIdbSupported()===false)。
 */
// eslint-disable-next-line import/no-unresolved
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Dexie from 'dexie';
import {
  createIdbAssetStore,
  isIdbSupported,
  AssetDatabase,
  IDB_PATH_PREFIX,
} from '../idb-asset-store.js';

const g = globalThis as Record<string, unknown>;
/** /auto 设置的全局键,afterAll 删除以还原环境 */
const FAKE_GLOBALS = ['indexedDB', 'IDBKeyRange', 'IDBFactory'];
let savedDexieIndexedDB: typeof Dexie.dependencies.indexedDB;
let savedDexieIDBKeyRange: typeof Dexie.dependencies.IDBKeyRange;

beforeAll(() => {
  // Dexie 在模块加载时已捕获 fake(因 /auto 先于 dexie import 执行),
  // 此处仅记录原始依赖以便还原(实际无需改动,但保持幂等)。
  savedDexieIndexedDB = Dexie.dependencies.indexedDB;
  savedDexieIDBKeyRange = Dexie.dependencies.IDBKeyRange;
});

afterAll(() => {
  Dexie.dependencies.indexedDB = savedDexieIndexedDB;
  Dexie.dependencies.IDBKeyRange = savedDexieIDBKeyRange;
  // 删除 /auto 注册的全局,还原 Node 干净环境
  for (const key of FAKE_GLOBALS) {
    delete g[key];
  }
});

describe('isIdbSupported', () => {
  it('全局 indexedDB 存在时应返回 true', () => {
    expect(isIdbSupported()).toBe(true);
  });
});

describe('createIdbAssetStore', () => {
  let dbName: string;

  beforeEach(() => {
    // 每个测试用独立 db,避免跨用例数据残留
    dbName = `lokvis-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  });

  it('import file 类型资产应返回完整 Asset(idb:// 前缀)', async () => {
    const store = await createIdbAssetStore({ dbName });
    const file = new File([new Uint8Array([1, 2, 3])], 'a.png', {
      type: 'image/png',
    });

    const asset = await store.import({ kind: 'file', file });

    expect(asset.id).toBeTruthy();
    expect(asset.type).toBe('image');
    expect(asset.metadata.mimeType).toBe('image/png');
    expect(asset.metadata.size).toBe(3);
    expect(asset.metadata.format).toBe('png');
    expect(asset.blob.path).toMatch(/^idb:\/\//);
    expect(asset.blob.size).toBe(3);
  });

  it('import blob 类型资产应能推断类型', async () => {
    const store = await createIdbAssetStore({ dbName });
    const blob = new Blob([new Uint8Array([0])], { type: 'video/mp4' });

    const asset = await store.import({ kind: 'blob', blob, name: 'v.mp4' });

    expect(asset.type).toBe('video');
    expect(asset.metadata.format).toBe('mp4');
  });

  it('application/pdf 应识别为 pdf 类型', async () => {
    const store = await createIdbAssetStore({ dbName });
    const blob = new Blob([new Uint8Array([0])], { type: 'application/pdf' });

    const asset = await store.import({ kind: 'blob', blob, name: 'd.pdf' });

    expect(asset.type).toBe('pdf');
  });

  it('无 MIME 的 blob 应使用 octet-stream', async () => {
    const store = await createIdbAssetStore({ dbName });
    const blob = new Blob([new Uint8Array([0])]);

    const asset = await store.import({ kind: 'blob', blob, name: 'x' });

    expect(asset.metadata.mimeType).toBe('application/octet-stream');
    expect(asset.type).toBe('data');
  });

  it('get() 应返回已导入的资产', async () => {
    const store = await createIdbAssetStore({ dbName });
    const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });
    const asset = await store.import({ kind: 'blob', blob, name: 'a.png' });

    const got = await store.get(asset.id);
    expect(got).toBeDefined();
    expect(got!.id).toBe(asset.id);
  });

  it('get() 未知的 id 应返回 undefined', async () => {
    const store = await createIdbAssetStore({ dbName });
    const got = await store.get('nonexistent');
    expect(got).toBeUndefined();
  });

  it('getBlob() 应返回原始 Blob 数据(经结构化克隆存储)', async () => {
    const store = await createIdbAssetStore({ dbName });
    const data = new Uint8Array([10, 20, 30]);
    const blob = new Blob([data], { type: 'image/png' });
    const asset = await store.import({ kind: 'blob', blob, name: 'a.png' });

    const got = await store.getBlob(asset.blob);
    expect(got.size).toBe(3);
    expect(got.type).toBe('image/png');
    const buf = new Uint8Array(await got.arrayBuffer());
    expect(Array.from(buf)).toEqual([10, 20, 30]);
  });

  it('getBlob() 不存在的句柄应抛错', async () => {
    const store = await createIdbAssetStore({ dbName });

    await expect(
      store.getBlob({ path: 'idb://missing', size: 0, mimeType: '' })
    ).rejects.toThrow(/Blob not found/);
  });

  it('remove() 应删除资产', async () => {
    const store = await createIdbAssetStore({ dbName });
    const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });
    const asset = await store.import({ kind: 'blob', blob, name: 'a.png' });

    await store.remove(asset.id);
    expect(await store.get(asset.id)).toBeUndefined();
    await expect(store.getBlob(asset.blob)).rejects.toThrow();
  });

  it('list() 应返回所有资产', async () => {
    const store = await createIdbAssetStore({ dbName });
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
    const store = await createIdbAssetStore({ dbName });
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
    expect(asset.blob.path).toMatch(/^idb:\/\//);
  });

  it('每次 import 应生成不同 id', async () => {
    const store = await createIdbAssetStore({ dbName });
    const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });

    const a1 = await store.import({ kind: 'blob', blob, name: 'a.png' });
    const a2 = await store.import({ kind: 'blob', blob, name: 'b.png' });

    expect(a1.id).not.toBe(a2.id);
  });

  it('opfs/url 类型源应抛错(IDB store 同样不支持)', async () => {
    const store = await createIdbAssetStore({ dbName });
    await expect(store.import({ kind: 'opfs', path: '/foo' })).rejects.toThrow(
      /not supported/
    );
    await expect(store.import({ kind: 'url', url: 'https://x' })).rejects.toThrow(
      /not supported/
    );
  });

  it('跨 store 实例(同 db)应能读取已持久化数据', async () => {
    // 模拟刷新后:新 store 实例基于同一 db 名应能读回旧数据
    const db = new AssetDatabase(dbName);
    const store1 = await createIdbAssetStore({ dbInstance: db });
    const blob = new Blob([new Uint8Array([7, 8])], { type: 'image/png' });
    const asset = await store1.import({ kind: 'blob', blob, name: 'a.png' });

    // 新实例(同一 db),get 应能取回
    const store2 = await createIdbAssetStore({ dbInstance: db });
    const got = await store2.get(asset.id);
    expect(got).toBeDefined();
    expect(got!.id).toBe(asset.id);

    const gotBlob = await store2.getBlob(asset.blob);
    const buf = new Uint8Array(await gotBlob.arrayBuffer());
    expect(Array.from(buf)).toEqual([7, 8]);
  });

  it('IDB_PATH_PREFIX 应为 "idb"', () => {
    expect(IDB_PATH_PREFIX).toBe('idb');
  });
});
