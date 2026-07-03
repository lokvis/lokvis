/**
 * HistoryStore 持久化单元测试(W7.2 / W7.9)
 *
 * 验证:
 * - save/load/loadAll/delete/clear CRUD
 * - 注入 dbInstance 时使用注入实例
 * - IndexedDB 不可用时 createHistoryStore 返回 undefined(降级)
 *
 * Node 环境无原生 IndexedDB,通过 fake-indexeddb/auto 注入全局;
 * afterAll 还原全局,避免污染其他测试(如降级链断言 isIdbSupported()===false)。
 */
// oxlint-disable-next-line import/no-unresolved
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Dexie from 'dexie';
import {
  HistoryDatabase,
  createHistoryStore,
  type HistoryRecord,
} from '../history-store.js';
import type { HistoryEntry } from '@lokvis/schema';

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

// ─── 工具 ──────────────────────────────────────────────────────

let dbCounter = 0;
function uniqueDbName(): string {
  return `lokvis-history-test-${dbCounter++}`;
}

function makeEntry(n: number, workflowId = 'wf-a'): HistoryEntry {
  return {
    id: `h${n}`,
    workflowId,
    nodeId: `node-${n}`,
    capability: 'image.resize',
    params: { n },
    inputs: n > 0 ? [`out-${n - 1}`] : ['in-0'],
    outputs: [`out-${n}`],
    timestamp: 1000 + n,
  };
}

function makeRecord(
  workflowId: string,
  entries: HistoryEntry[],
  cursor: number,
  extra: Partial<HistoryRecord> = {}
): HistoryRecord {
  return {
    workflowId,
    entries,
    cursor,
    initialInputs: extra.initialInputs ?? ['in-0'],
    currentOutputs: extra.currentOutputs ?? (entries[cursor]?.outputs ?? ['in-0']),
    updatedAt: extra.updatedAt ?? Date.now(),
  };
}

// ─── 测试 ──────────────────────────────────────────────────────

describe('HistoryStore 持久化(W7.2)', () => {
  it('save 后 load 应取回相同记录', async () => {
    const store = createHistoryStore({ dbName: uniqueDbName() })!;
    expect(store).toBeDefined();
    const record = makeRecord('wf-a', [makeEntry(0), makeEntry(1)], 1);
    await store.save(record);

    const got = await store.load('wf-a');
    expect(got).toBeDefined();
    expect(got!.workflowId).toBe('wf-a');
    expect(got!.entries).toHaveLength(2);
    expect(got!.cursor).toBe(1);
    expect(got!.entries[0]!.capability).toBe('image.resize');
    expect(got!.currentOutputs).toEqual(['out-1']);
  });

  it('loadAll 应返回全部已保存记录', async () => {
    const store = createHistoryStore({ dbName: uniqueDbName() })!;
    await store.save(makeRecord('wf-a', [makeEntry(0)], 0));
    await store.save(makeRecord('wf-b', [makeEntry(0, 'wf-b'), makeEntry(1, 'wf-b')], 1));

    const all = await store.loadAll();
    expect(all).toHaveLength(2);
    const ids = all.map((r) => r.workflowId).sort();
    expect(ids).toEqual(['wf-a', 'wf-b']);
  });

  it('delete 后 load 应返回 undefined', async () => {
    const store = createHistoryStore({ dbName: uniqueDbName() })!;
    await store.save(makeRecord('wf-a', [makeEntry(0)], 0));
    expect(await store.load('wf-a')).toBeDefined();

    await store.delete('wf-a');
    expect(await store.load('wf-a')).toBeUndefined();
  });

  it('clear 应清空全部记录', async () => {
    const store = createHistoryStore({ dbName: uniqueDbName() })!;
    await store.save(makeRecord('wf-a', [makeEntry(0)], 0));
    await store.save(makeRecord('wf-b', [makeEntry(0, 'wf-b')], 0));

    await store.clear();
    expect(await store.loadAll()).toHaveLength(0);
  });

  it('save 覆盖同 workflowId 的旧记录', async () => {
    const store = createHistoryStore({ dbName: uniqueDbName() })!;
    await store.save(makeRecord('wf-a', [makeEntry(0)], 0));
    await store.save(makeRecord('wf-a', [makeEntry(0), makeEntry(1)], 1));

    const got = await store.load('wf-a');
    expect(got!.entries).toHaveLength(2);
    expect(got!.cursor).toBe(1);
  });

  it('注入 dbInstance 时应使用注入实例', async () => {
    const db = new HistoryDatabase(uniqueDbName());
    const store = createHistoryStore({ dbInstance: db })!;
    await store.save(makeRecord('wf-a', [makeEntry(0)], 0));

    // 直接查注入的 db,验证同一实例被使用
    const record = await db.history.get('wf-a');
    expect(record).toBeDefined();
    expect(record!.entries).toHaveLength(1);
  });

  it('load 不存在的 workflowId 应返回 undefined', async () => {
    const store = createHistoryStore({ dbName: uniqueDbName() })!;
    expect(await store.load('nonexistent')).toBeUndefined();
  });

  it('loadAll 空库应返回空数组', async () => {
    const store = createHistoryStore({ dbName: uniqueDbName() })!;
    expect(await store.loadAll()).toEqual([]);
  });
});

describe('HistoryStore 降级(IDB 不可用)', () => {
  it('IndexedDB 不可用时 createHistoryStore 应返回 undefined', () => {
    // 临时移除 indexedDB 全局,模拟不可用环境
    const savedIdb = g.indexedDB;
    delete g.indexedDB;
    try {
      const store = createHistoryStore({ dbName: uniqueDbName() });
      expect(store).toBeUndefined();
    } finally {
      g.indexedDB = savedIdb;
    }
  });
});
