/**
 * OPFS AssetStore + 降级工厂 单元测试(PROJECT_PLAN W2.10)
 *
 * 覆盖:
 * - OpfsAssetStore 完整 CRUD(注入 FakeOpfsRoot 模拟 OPFS)
 * - OpfsAssetStore 不可用时抛 OpfsUnavailableError
 * - createAssetStore 降级链:OPFS → IndexedDB → Memory
 *   (Node 环境下 OPFS/IDB 均不可用,验证兜底降级)
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  createOpfsAssetStore,
  isOpfsSupported,
  OpfsUnavailableError,
  OPFS_PATH_PREFIX,
  type OpfsAssetStoreOptions,
  type OpfsMetadataRecord,
} from '../opfs-asset-store.js';
import {
  createAssetStore,
  createMemoryAssetStore,
} from '../asset-store.js';
import { isIdbSupported } from '../idb-asset-store.js';
// W2.1:共享 OPFS fake(原为本文件内联,与 opfs-metadata-persistence.test.ts 重复)
import { FakeDirHandle } from '../test-utils/fakes.js';

// ─── Fake OPFS ─────────────────────────────────────────────────

/** 构造注入 rootHandle 的 OPFS store */
async function makeOpfsStore(root?: FakeDirHandle) {
  const rootHandle = (root ?? new FakeDirHandle()) as unknown as FileSystemDirectoryHandle;
  const options: OpfsAssetStoreOptions = { rootHandle };
  const store = await createOpfsAssetStore(options);
  return { store, rootHandle: root ?? new FakeDirHandle() };
}

// ─── OpfsAssetStore CRUD ────────────────────────────────────────

describe('OpfsAssetStore CRUD', () => {
  it('import file 应写入 OPFS 并返回完整 Asset', async () => {
    const { store } = await makeOpfsStore();
    const file = new File([new Uint8Array([1, 2, 3])], 'a.png', {
      type: 'image/png',
    });
    const asset = await store.import({ kind: 'file', file });

    expect(asset.id).toBeTruthy();
    expect(asset.type).toBe('image');
    expect(asset.metadata.size).toBe(3);
    expect(asset.metadata.format).toBe('png');
    expect(asset.blob.path).toBe(`${OPFS_PATH_PREFIX}://${asset.id}`);
    expect(asset.blob.mimeType).toBe('image/png');
  });

  it('import blob 应能推断类型', async () => {
    const { store } = await makeOpfsStore();
    const blob = new Blob([new Uint8Array([0])], { type: 'video/mp4' });
    const asset = await store.import({ kind: 'blob', blob, name: 'v.mp4' });
    expect(asset.type).toBe('video');
    expect(asset.metadata.format).toBe('mp4');
  });

  it('import url/opfs 源应抛 not supported', async () => {
    const { store } = await makeOpfsStore();
    await expect(store.import({ kind: 'url', url: 'https://x' })).rejects.toThrow(
      /not supported/
    );
    await expect(store.import({ kind: 'opfs', path: '/foo' })).rejects.toThrow(
      /not supported/
    );
  });

  it('get() 应返回已导入资产;未知 id 返回 undefined', async () => {
    const { store } = await makeOpfsStore();
    const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });
    const asset = await store.import({ kind: 'blob', blob, name: 'a.png' });
    expect((await store.get(asset.id))?.id).toBe(asset.id);
    expect(await store.get('missing')).toBeUndefined();
  });

  it('getBlob() 应返回写入的原始数据', async () => {
    const { store } = await makeOpfsStore();
    const data = new Uint8Array([10, 20, 30]);
    const blob = new Blob([data], { type: 'image/png' });
    const asset = await store.import({ kind: 'blob', blob, name: 'a.png' });

    const got = await store.getBlob(asset.blob);
    expect(got.size).toBe(3);
    expect(got.type).toBe('image/png');
  });

  it('getBlob() 句柄不存在应抛错', async () => {
    const { store } = await makeOpfsStore();
    await expect(
      store.getBlob({ path: `${OPFS_PATH_PREFIX}://missing`, size: 0, mimeType: '' })
    ).rejects.toThrow(/Blob not found/);
  });

  it('remove() 应删除资产,getBlob 之后应抛错', async () => {
    const { store } = await makeOpfsStore();
    const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });
    const asset = await store.import({ kind: 'blob', blob, name: 'a.png' });
    await store.remove(asset.id);
    expect(await store.get(asset.id)).toBeUndefined();
    // 文件已删除,getBlob 恢复路径应抛错
    await expect(store.getBlob(asset.blob)).rejects.toThrow();
  });

  it('remove() 不存在的 id 不应抛错', async () => {
    const { store } = await makeOpfsStore();
    await expect(store.remove('nonexistent')).resolves.toBeUndefined();
  });

  it('list() 应返回全部已导入资产', async () => {
    const { store } = await makeOpfsStore();
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
    expect((await store.list()).length).toBe(2);
  });

  it('create() 应使用调用方提供的 metadata 与 type', async () => {
    const { store } = await makeOpfsStore();
    const blob = new Blob([new Uint8Array([0])], { type: 'image/webp' });
    const asset = await store.create(
      blob,
      { mimeType: 'image/webp', size: 1, format: 'webp', dimensions: { width: 4, height: 2 } },
      'image'
    );
    expect(asset.type).toBe('image');
    expect(asset.metadata.dimensions).toEqual({ width: 4, height: 2 });
  });

  it('每个 import 应生成不同 id', async () => {
    const { store } = await makeOpfsStore();
    const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });
    const a1 = await store.import({ kind: 'blob', blob, name: 'a.png' });
    const a2 = await store.import({ kind: 'blob', blob, name: 'b.png' });
    expect(a1.id).not.toBe(a2.id);
  });
});

// ─── OpfsAssetStore 环境检测 ────────────────────────────────────

describe('OPFS 环境检测', () => {
  it('Node 环境 isOpfsSupported 应为 false', () => {
    expect(isOpfsSupported()).toBe(false);
  });

  it('无 rootHandle 且 OPFS 不可用应抛 OpfsUnavailableError', async () => {
    // Node 环境 OPFS 不可用
    await expect(createOpfsAssetStore()).rejects.toBeInstanceOf(OpfsUnavailableError);
  });
});

// ─── createAssetStore 降级链 ─────────────────────────────────────

describe('createAssetStore 降级链', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    // 还原 navigator
    vi.restoreAllMocks();
    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        configurable: true,
        writable: true,
      });
    } else {
      delete (globalThis as Record<string, unknown>).navigator;
    }
  });

  it('OPFS/IDB 均不可用应降级到 Memory', async () => {
    // 默认 Node 环境:无 navigator.storage,无 indexedDB
    const store = await createAssetStore();
    // Memory store 的 import 仍能工作
    const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });
    const asset = await store.import({ kind: 'blob', blob, name: 'a.png' });
    expect(asset.blob.path).toMatch(/^memory:\/\//);
  });

  it('preferOpfs=false 应跳过 OPFS(仍降级到 Memory,因 IDB 不可用)', async () => {
    expect(isOpfsSupported()).toBe(false);
    expect(isIdbSupported()).toBe(false);
    const store = await createAssetStore({ preferOpfs: false });
    const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });
    const asset = await store.import({ kind: 'blob', blob, name: 'a.png' });
    expect(asset.blob.path).toMatch(/^memory:\/\//);
  });

  it('OPFS 可用但初始化失败应降级到 IndexedDB→Memory', async () => {
    // 模拟 navigator.storage.getDirectory 抛错
    const fakeNavigator = {
      storage: {
        getDirectory: () => Promise.reject(new Error('OPFS init boom')),
      },
    };
    Object.defineProperty(globalThis, 'navigator', {
      value: fakeNavigator,
      configurable: true,
      writable: true,
    });
    // isOpfsSupported 检测函数存在即可视为支持,实际初始化失败 → 降级
    expect(isOpfsSupported()).toBe(true);
    const store = await createAssetStore({ preferOpfs: true });
    // IDB 不可用(Node),最终降级到 Memory
    const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });
    const asset = await store.import({ kind: 'blob', blob, name: 'a.png' });
    expect(asset.blob.path).toMatch(/^memory:\/\//);
  });

  it('OPFS 可用且初始化成功应返回 OpfsAssetStore', async () => {
    // 注入一个真实可用的 fake root 到 navigator.storage.getDirectory
    const fakeRoot = new FakeDirHandle();
    const fakeNavigator = {
      storage: {
        getDirectory: () => Promise.resolve(fakeRoot as unknown as FileSystemDirectoryHandle),
      },
    };
    Object.defineProperty(globalThis, 'navigator', {
      value: fakeNavigator,
      configurable: true,
      writable: true,
    });
    expect(isOpfsSupported()).toBe(true);
    const store = await createAssetStore({ preferOpfs: true });
    const blob = new Blob([new Uint8Array([1, 2])], { type: 'image/png' });
    const asset = await store.import({ kind: 'blob', blob, name: 'a.png' });
    expect(asset.blob.path).toBe(`${OPFS_PATH_PREFIX}://${asset.id}`);
  });

  it('降级应输出 warn 日志(OPFS 失败时)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fakeNavigator = {
      storage: {
        getDirectory: () => Promise.reject(new Error('boom')),
      },
    };
    Object.defineProperty(globalThis, 'navigator', {
      value: fakeNavigator,
      configurable: true,
      writable: true,
    });
    await createAssetStore({ preferOpfs: true });
    expect(warnSpy).toHaveBeenCalled();
    const msg = warnSpy.mock.calls[0]?.[0] ?? '';
    expect(String(msg)).toMatch(/OPFS unavailable/i);
  });

  it('createMemoryAssetStore 始终可用', async () => {
    const store = createMemoryAssetStore();
    const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });
    const asset = await store.import({ kind: 'blob', blob, name: 'a.png' });
    expect(asset.id).toBeTruthy();
  });
});

// ─── m9: IndexedDB 不可用 → 仅内存模式降级 ───────────────────────

describe('OPFS store IndexedDB 不可用降级(m9)', () => {
  // Node 环境无 fake-indexeddb 注入,isIdbSupported()===false
  // (本测试文件未 import 'fake-indexeddb/auto')

  it('isIdbSupported 在 Node 环境应为 false', () => {
    expect(isIdbSupported()).toBe(false);
  });

  it('IndexedDB 不可用时 store 退化为仅内存,刷新后 list() 为空', async () => {
    // 同一 root 句柄,模拟"刷新":新建 store 实例
    const root = new FakeDirHandle();
    const rootHandle = root as unknown as FileSystemDirectoryHandle;

    const store1 = await createOpfsAssetStore({ rootHandle });
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    const asset = await store1.import({ kind: 'blob', blob, name: 'a.png' });

    // store1 内存里有资产
    expect((await store1.list()).length).toBe(1);

    // 刷新:新建 store(同 root),无 IDB 持久化 → 内存 Map 为空
    const store2 = await createOpfsAssetStore({ rootHandle });
    const list2 = await store2.list();
    expect(list2).toHaveLength(0);
    expect(await store2.get(asset.id)).toBeUndefined();

    // OPFS 文件本身仍残留在 root 里(无 GC),但元数据丢失,
    // 这是有意降级行为(与 W2 一致),避免 IDB 不可用时阻断主流程
  });

  it('IndexedDB 不可用时 import/remove 不应抛错(降级为 no-op 持久化)', async () => {
    const root = new FakeDirHandle();
    const rootHandle = root as unknown as FileSystemDirectoryHandle;
    const store = await createOpfsAssetStore({ rootHandle });

    const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });
    const asset = await store.import({ kind: 'blob', blob, name: 'a.png' });
    expect(asset.id).toBeTruthy();

    // remove 不应因 IDB 不可用抛错
    await expect(store.remove(asset.id)).resolves.toBeUndefined();
    expect(await store.get(asset.id)).toBeUndefined();
  });
});

// ─── W21.6: OpfsAssetStore.dispose() ─────────────────────────

describe('OpfsAssetStore.dispose() (W21.6)', () => {
  it('dispose 后 list() 应返回空(内存 Map 已清空)', async () => {
    const { store } = await makeOpfsStore();
    await store.import({
      kind: 'blob',
      blob: new Blob([new Uint8Array([0])], { type: 'image/png' }),
      name: 'a.png',
    });
    expect((await store.list()).length).toBe(1);

    await store.dispose?.();
    expect((await store.list()).length).toBe(0);
  });

  it('dispose 后 get() 应返回 undefined(内存 Map 已清空)', async () => {
    const { store } = await makeOpfsStore();
    const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });
    const asset = await store.import({ kind: 'blob', blob, name: 'a.png' });

    await store.dispose?.();
    expect(await store.get(asset.id)).toBeUndefined();
  });

  it('dispose 应幂等:重复调用不抛错', async () => {
    const { store } = await makeOpfsStore();
    await store.dispose?.();
    await expect(store.dispose?.()).resolves.toBeUndefined();
  });

  it('dispose 应调用 metadataKvStore.close()', async () => {
    // 注入内存 KVStore 验证 close 调用
    const { createMemoryKVStore } = await import(
      '@lokvis/browser-adapter/test-utils'
    );
    const fakeRoot = new FakeDirHandle();
    const kv = createMemoryKVStore<OpfsMetadataRecord>('id');
    const closeSpy = vi.spyOn(kv, 'close');

    const store = await createOpfsAssetStore({
      rootHandle: fakeRoot as unknown as FileSystemDirectoryHandle,
      metadataKvStore: kv,
    });

    await store.dispose?.();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});
