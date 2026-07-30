/**
 * KVStoreFactory 单元测试。
 *
 * 用 fake-indexeddb 提供全局 indexedDB(与 runtime 各 store 测试同一约定),
 * 验证 Dexie 后端的泛型 KV 语义;内存版 fake 一并覆盖。
 */
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { createKVStore } from '../kv-store.js';
import { createMemoryKVStore } from '../test-utils.js';

interface Rec {
  id: string;
  value: number;
}

let dbSeq = 0;
const nextDbName = () => `test-kv-${++dbSeq}`;

describe('createKVStore(IndexedDB 后端)', () => {
  it('put/get/toArray/delete/clear 应符合泛型 KV 语义', async () => {
    const store = createKVStore<Rec>({
      dbName: nextDbName(),
      tableName: 'items',
      keyPath: 'id',
    });
    await store.put({ id: 'a', value: 1 });
    await store.put({ id: 'b', value: 2 });
    expect(await store.get('a')).toEqual({ id: 'a', value: 1 });
    expect((await store.toArray()).length).toBe(2);

    await store.put({ id: 'a', value: 9 });
    expect(await store.get('a')).toEqual({ id: 'a', value: 9 });

    await store.delete('a');
    expect(await store.get('a')).toBeUndefined();
    await store.delete('a'); // 幂等

    await store.clear();
    expect(await store.toArray()).toEqual([]);
    store.close();
  });

  it('close 后重新创建同名 store 应能读到已持久化数据', async () => {
    const dbName = nextDbName();
    const options = { dbName, tableName: 'items', keyPath: 'id' };
    const first = createKVStore<Rec>(options);
    await first.put({ id: 'x', value: 42 });
    first.close();

    const second = createKVStore<Rec>(options);
    expect(await second.get('x')).toEqual({ id: 'x', value: 42 });
    second.close();
  });

  it('支持二级索引声明(schema 不抛错,toArray 正常)', async () => {
    const store = createKVStore<Rec & { updatedAt: number }>({
      dbName: nextDbName(),
      tableName: 'history',
      keyPath: 'id',
      indexes: ['updatedAt'],
    });
    await store.put({ id: 'w1', value: 1, updatedAt: 100 });
    expect((await store.toArray())[0]?.updatedAt).toBe(100);
    store.close();
  });
});

describe('createMemoryKVStore(测试 fake)', () => {
  it('语义应与 IndexedDB 版一致', async () => {
    const store = createMemoryKVStore<Rec>('id');
    await store.put({ id: 'a', value: 1 });
    expect(await store.get('a')).toEqual({ id: 'a', value: 1 });
    await store.delete('a');
    expect(await store.get('a')).toBeUndefined();
    await store.put({ id: 'b', value: 2 });
    await store.clear();
    expect(await store.toArray()).toEqual([]);
  });
});
