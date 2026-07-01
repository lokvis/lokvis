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
} from '../opfs-asset-store.js';
import {
  createAssetStore,
  createMemoryAssetStore,
} from '../asset-store.js';
import { isIdbSupported } from '../idb-asset-store.js';

// ─── Fake OPFS ─────────────────────────────────────────────────

/** 内存模拟的 OPFS 文件句柄 */
class FakeFileHandle {
  private blob: Blob | null = null;
  async createWritable(): Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }> {
    return {
      write: async (data) => {
        this.blob = data;
      },
      close: async () => {},
    };
  }
  async getFile(): Promise<Blob> {
    if (!this.blob) throw new Error('File not found');
    return this.blob;
  }
}

/** 内存模拟的 OPFS 目录句柄 */
class FakeDirHandle {
  private files = new Map<string, FakeFileHandle>();
  private dirs = new Map<string, FakeDirHandle>();

  async getDirectoryHandle(
    name: string,
    opts?: { create?: boolean }
  ): Promise<FakeDirHandle> {
    let d = this.dirs.get(name);
    if (!d) {
      if (!opts?.create) throw new Error(`Directory not found: ${name}`);
      d = new FakeDirHandle();
      this.dirs.set(name, d);
    }
    return d;
  }

  async getFileHandle(
    name: string,
    opts?: { create?: boolean }
  ): Promise<FakeFileHandle> {
    let f = this.files.get(name);
    if (!f) {
      if (!opts?.create) throw new Error(`File not found: ${name}`);
      f = new FakeFileHandle();
      this.files.set(name, f);
    }
    return f;
  }

  async removeEntry(name: string): Promise<void> {
    this.files.delete(name);
    this.dirs.delete(name);
  }
}

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
