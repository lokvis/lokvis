/**
 * OPFS 元数据持久化测试(W6.6)
 *
 * 验证:OPFS store 在"刷新"(销毁内存 Map 后重建)后,list()/get() 仍能
 * 返回之前导入的资产 —— Dexie 元数据库承担持久化职责。
 *
 * Node 环境无原生 IndexedDB,通过 fake-indexeddb/auto 注入全局。
 * afterAll 删除全局,避免污染其他测试文件(如 opfs 降级链断言
 * isIdbSupported()===false)。
 */
// oxlint-disable-next-line import/no-unresolved
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Dexie from 'dexie';
import {
  createOpfsAssetStore,
  OpfsMetadataDatabase,
} from '../opfs-asset-store.js';
import type { AssetStore } from '../asset-store.js';

// ─── Fake OPFS(与 opfs-asset-store.test.ts 同构) ───────────────

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

// ─── fake-indexeddb 全局管理(还原 Node 干净环境) ───────────────

const g = globalThis as Record<string, unknown>;
const FAKE_GLOBALS = ['indexedDB', 'IDBKeyRange', 'IDBFactory'];
let savedDexieIndexedDB: typeof Dexie.dependencies.indexedDB;
let savedDexieIDBKeyRange: typeof Dexie.dependencies.IDBKeyRange;

beforeAll(() => {
  savedDexieIndexedDB = Dexie.dependencies.indexedDB;
  savedDexieIDBKeyRange = Dexie.dependencies.IDBKeyRange;
});

afterAll(() => {
  Dexie.dependencies.indexedDB = savedDexieIndexedDB;
  Dexie.dependencies.IDBKeyRange = savedDexieIDBKeyRange;
  for (const key of FAKE_GLOBALS) {
    delete g[key];
  }
});

// ─── 工具:每个测试用唯一 db 名,避免测试间数据污染 ─────────────

let dbCounter = 0;
function uniqueDbName(): string {
  return `lokvis-opfs-metadata-test-${dbCounter++}`;
}

async function makeFreshStore(
  root: FakeDirHandle,
  dbName: string
): Promise<AssetStore> {
  return createOpfsAssetStore({
    rootHandle: root as unknown as FileSystemDirectoryHandle,
    metadataDbName: dbName,
  });
}

// ─── 测试 ──────────────────────────────────────────────────────

describe('OPFS 元数据持久化(W6.6)', () => {
  it('import 后刷新(新建 store)list() 应恢复资产', async () => {
    const root = new FakeDirHandle();
    const dbName = uniqueDbName();

    const store1 = await makeFreshStore(root, dbName);
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    const asset = await store1.import({ kind: 'blob', blob, name: 'a.png' });

    // 模拟刷新:新建 store(同 root + 同 db),内存 Map 为空但 Dexie 有数据
    const store2 = await makeFreshStore(root, dbName);
    const list = await store2.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(asset.id);
    expect(list[0]!.metadata.mimeType).toBe('image/png');
    expect(list[0]!.metadata.size).toBe(3);

    // get() 也应能恢复
    const got = await store2.get(asset.id);
    expect(got).toBeDefined();
    expect(got!.id).toBe(asset.id);
  });

  it('getBlob 在刷新后应从 OPFS 重新获取文件句柄', async () => {
    const root = new FakeDirHandle();
    const dbName = uniqueDbName();

    const store1 = await makeFreshStore(root, dbName);
    const blob = new Blob([new Uint8Array([10, 20])], { type: 'image/png' });
    const asset = await store1.import({ kind: 'blob', blob, name: 'a.png' });

    // 刷新:新 store 的 fileHandles Map 为空,需从 OPFS 重新获取句柄
    const store2 = await makeFreshStore(root, dbName);
    const gotBlob = await store2.getBlob(asset.blob);
    expect(gotBlob.size).toBe(2);
    expect(gotBlob.type).toBe('image/png');
  });

  it('remove 后刷新,list() 不应包含已删除资产', async () => {
    const root = new FakeDirHandle();
    const dbName = uniqueDbName();

    const store1 = await makeFreshStore(root, dbName);
    const a1 = await store1.import({
      kind: 'blob',
      blob: new Blob([new Uint8Array([0])], { type: 'image/png' }),
      name: 'a.png',
    });
    const a2 = await store1.import({
      kind: 'blob',
      blob: new Blob([new Uint8Array([0])], { type: 'image/jpeg' }),
      name: 'b.jpg',
    });

    await store1.remove(a1.id);

    const store2 = await makeFreshStore(root, dbName);
    const list = await store2.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(a2.id);
  });

  it('create 产出的资产刷新后也能恢复', async () => {
    const root = new FakeDirHandle();
    const dbName = uniqueDbName();

    const store1 = await makeFreshStore(root, dbName);
    const blob = new Blob([new Uint8Array([0])], { type: 'image/webp' });
    const asset = await store1.create(
      blob,
      { mimeType: 'image/webp', size: 1, format: 'webp' },
      'image'
    );

    const store2 = await makeFreshStore(root, dbName);
    const got = await store2.get(asset.id);
    expect(got).toBeDefined();
    expect(got!.metadata.format).toBe('webp');
  });

  it('metadataDb 注入时应使用注入的实例', async () => {
    const root = new FakeDirHandle();
    const db = new OpfsMetadataDatabase(`injected-${uniqueDbName()}`);

    const store = await createOpfsAssetStore({
      rootHandle: root as unknown as FileSystemDirectoryHandle,
      metadataDb: db,
    });

    const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });
    const asset = await store.import({ kind: 'blob', blob, name: 'a.png' });

    // 直接查 db,验证注入的实例被使用
    const record = await db.metadata.get(asset.id);
    expect(record).toBeDefined();
    expect(record!.id).toBe(asset.id);
    expect(record!.asset.metadata.mimeType).toBe('image/png');
  });

  it('多次 import 后刷新应恢复全部资产', async () => {
    const root = new FakeDirHandle();
    const dbName = uniqueDbName();

    const store1 = await makeFreshStore(root, dbName);
    for (let i = 0; i < 5; i++) {
      await store1.import({
        kind: 'blob',
        blob: new Blob([new Uint8Array([i])], { type: 'image/png' }),
        name: `img-${i}.png`,
      });
    }

    const store2 = await makeFreshStore(root, dbName);
    const list = await store2.list();
    expect(list).toHaveLength(5);
  });
});
