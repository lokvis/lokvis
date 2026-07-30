/**
 * 集成测试:历史持久化 + jumpTo(W7.2 / W7.9)
 *
 * 验证:
 * - runtime.run 产生历史后,快照持久化到 historyStore
 * - "刷新"(用同一 historyStore 新建 runtime)后,历史条目与游标恢复
 * - runtime.jumpTo 跳转后,currentOutputs 正确切换
 * - getHistoryState 返回 { entries, cursor }
 * - disposeWorkflow 后持久化记录被删除
 *
 * Node 环境通过 fake-indexeddb/auto 注入全局;afterAll 还原全局避免污染。
 */
// oxlint-disable-next-line import/no-unresolved
import 'fake-indexeddb/auto';
import { describe, it, expect, afterAll } from 'vitest';
import {
  LokvisRuntimeImpl,
  createRuntime,
} from '../../runtime.js';
import { createMemoryAssetStore } from '../../asset-store.js';
import {
  createHistoryStore,
  type HistoryStore,
} from '../../history-store.js';
import type {
  Asset,
  Capability,
  CapabilityImplementation,
} from '@lokvis/schema';
import type { Workflow } from '@lokvis/schema';

const WF_ID = 'wf-persist';

/** resize → compress 线性 workflow */
function buildWorkflow(): Workflow {
  return {
    id: WF_ID,
    version: '1.0.0',
    name: 'persist-test',
    description: 'test',
    author: { id: 'a', name: 'tester' },
    category: 'image',
    tags: [],
    nodes: [
      { id: 'n-resize', type: 'transform', capability: 'image.resize', params: { width: 100 } },
      { id: 'n-compress', type: 'transform', capability: 'image.compress', params: { quality: 80 } },
    ],
    edges: [{ from: 'n-resize', to: 'n-compress' }],
    inputs: { type: 'image', multiple: false },
    outputs: { type: 'image', format: 'png' },
  };
}

function makeFakeImpl(capability: string, marker: string): CapabilityImplementation {
  return {
    capability,
    engine: 'fake',
    execute: async () => {
      const out: Asset = {
        id: `asset-${marker}`,
        type: 'image',
        metadata: {
          mimeType: 'image/png',
          size: 1,
          format: 'png',
          dimensions: { width: 100, height: 100 },
        },
        blob: { path: `memory://asset-${marker}`, size: 1, mimeType: 'image/png' },
        history: [],
        tags: [marker],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      return [out];
    },
  };
}

function makeCapabilityDecl(name: string): Capability {
  return {
    name,
    description: 'fake',
    inputTypes: ['image'],
    outputTypes: ['image'],
    params: [],
    performance: 'fast',
  };
}

const INPUT_ASSET: Asset = {
  id: 'asset-input',
  type: 'image',
  metadata: { mimeType: 'image/png', size: 1, format: 'png' },
  blob: { path: 'memory://asset-input', size: 1, mimeType: 'image/png' },
  history: [],
  tags: [],
  createdAt: 0,
  updatedAt: 0,
};

/** 用注入的 historyStore 构造 runtime(注册 fake 能力) */
function makeRuntime(historyStore: HistoryStore): LokvisRuntimeImpl {
  const runtime = new LokvisRuntimeImpl({
    assetStore: createMemoryAssetStore(),
    historyStore,
    storageQuota: 1024 * 1024,
  });
  const reg = runtime._getCapabilityRegistry();
  reg.registerCapability(makeCapabilityDecl('image.resize'));
  reg.registerCapability(makeCapabilityDecl('image.compress'));
  reg.registerImplementation(makeFakeImpl('image.resize', 'resized'));
  reg.registerImplementation(makeFakeImpl('image.compress', 'compressed'));
  return runtime;
}

// ─── fake-indexeddb 全局管理 ───────────────────────────────────

const g = globalThis as Record<string, unknown>;
const FAKE_GLOBALS = ['indexedDB', 'IDBKeyRange', 'IDBFactory'];

afterAll(() => {
  for (const key of FAKE_GLOBALS) {
    delete g[key];
  }
});

let dbCounter = 0;
function uniqueDbName(): string {
  return `lokvis-history-integration-${dbCounter++}`;
}

// ─── 测试 ──────────────────────────────────────────────────────

describe('集成:历史持久化 + jumpTo(W7.2/W7.9)', () => {
  it('run 产生历史后应持久化到 historyStore', async () => {
    const historyStore = createHistoryStore({ dbName: uniqueDbName() })!;
    const runtime = makeRuntime(historyStore);

    await runtime.run(buildWorkflow(), [INPUT_ASSET]);

    // 直接查 historyStore,验证快照已写入
    const record = await historyStore.load(WF_ID);
    expect(record).toBeDefined();
    expect(record!.entries).toHaveLength(2);
    expect(record!.cursor).toBe(1);
    expect(record!.initialInputs).toEqual(['asset-input']);
    expect(record!.currentOutputs).toEqual(['asset-compressed']);
  });

  it('刷新(新建 runtime 同 historyStore)后历史与游标应恢复', async () => {
    const dbName = uniqueDbName();
    const store1 = createHistoryStore({ dbName: dbName })!;
    const runtime1 = makeRuntime(store1);
    await runtime1.run(buildWorkflow(), [INPUT_ASSET]);
    // undo 一步,使游标停留在中间位置(cursor=0)
    await runtime1.undo(WF_ID);
    expect(runtime1._getCurrentOutputs(WF_ID)).toEqual(['asset-resized']);

    // 模拟刷新:用同一 historyStore 新建 runtime
    // 注意:createRuntime 工厂会自动 loadPersistedHistory
    const store2 = createHistoryStore({ dbName: dbName })!;
    const runtime2 = new LokvisRuntimeImpl({
      assetStore: createMemoryAssetStore(),
      historyStore: store2,
      storageQuota: 1024 * 1024,
    });
    await runtime2.loadPersistedHistory();

    // 历史条目与游标应恢复
    const state = await runtime2.getHistoryState(WF_ID);
    expect(state.entries).toHaveLength(2);
    expect(state.cursor).toBe(0);
    // currentOutputs 也应恢复到 undo 后的位置
    expect(runtime2._getCurrentOutputs(WF_ID)).toEqual(['asset-resized']);
  });

  it('jumpTo 跳转后 currentOutputs 应正确切换', async () => {
    const historyStore = createHistoryStore({ dbName: uniqueDbName() })!;
    const runtime = makeRuntime(historyStore);
    await runtime.run(buildWorkflow(), [INPUT_ASSET]);
    // cursor=1, currentOutputs=['asset-compressed']

    // 跳回第 0 步(resize 输出)
    await runtime.jumpTo(WF_ID, 0);
    expect(runtime._getCurrentOutputs(WF_ID)).toEqual(['asset-resized']);
    const state0 = await runtime.getHistoryState(WF_ID);
    expect(state0.cursor).toBe(0);

    // 跳回初始(index=-1)
    await runtime.jumpTo(WF_ID, -1);
    expect(runtime._getCurrentOutputs(WF_ID)).toEqual(['asset-input']);
    const stateInit = await runtime.getHistoryState(WF_ID);
    expect(stateInit.cursor).toBe(-1);

    // 再跳到第 1 步(compress 输出)
    await runtime.jumpTo(WF_ID, 1);
    expect(runtime._getCurrentOutputs(WF_ID)).toEqual(['asset-compressed']);
  });

  it('jumpTo 越界应为 no-op(不影响游标与输出)', async () => {
    const historyStore = createHistoryStore({ dbName: uniqueDbName() })!;
    const runtime = makeRuntime(historyStore);
    await runtime.run(buildWorkflow(), [INPUT_ASSET]);
    const before = await runtime.getHistoryState(WF_ID);

    // 越界:索引 >= length
    await runtime.jumpTo(WF_ID, 99);
    const after = await runtime.getHistoryState(WF_ID);
    expect(after.cursor).toBe(before.cursor);
    expect(runtime._getCurrentOutputs(WF_ID)).toEqual(['asset-compressed']);

    // 越界:索引 < -1
    await runtime.jumpTo(WF_ID, -2);
    expect((await runtime.getHistoryState(WF_ID)).cursor).toBe(before.cursor);
  });

  it('getHistoryState 对不存在的工作流应返回空', async () => {
    const historyStore = createHistoryStore({ dbName: uniqueDbName() })!;
    const runtime = makeRuntime(historyStore);

    const state = await runtime.getHistoryState('nonexistent');
    expect(state.entries).toEqual([]);
    expect(state.cursor).toBe(-1);
  });

  it('disposeWorkflow 后持久化记录应被删除', async () => {
    const historyStore = createHistoryStore({ dbName: uniqueDbName() })!;
    const runtime = makeRuntime(historyStore);
    await runtime.run(buildWorkflow(), [INPUT_ASSET]);
    expect(await historyStore.load(WF_ID)).toBeDefined();

    await runtime.disposeWorkflow(WF_ID);
    // TD-2.1: disposeWorkflow 内部 await disposeHistory → await persistHistory,
    // 返回时 IDB 删除已落地,无需轮询等待 fire-and-forget 的 persist 完成
    expect(await historyStore.load(WF_ID)).toBeUndefined();
  });

  it('createRuntime 工厂应自动创建 historyStore 并预加载历史', async () => {
    const dbName = uniqueDbName();
    // 先通过 historyStore 写入一条人造历史记录
    const store1 = createHistoryStore({ dbName })!;
    await store1.save({
      workflowId: WF_ID,
      entries: [
        {
          id: 'h0',
          workflowId: WF_ID,
          nodeId: 'n-0',
          capability: 'image.resize',
          params: {},
          inputs: ['asset-input'],
          outputs: ['asset-resized'],
          timestamp: 1000,
        },
      ],
      cursor: 0,
      initialInputs: ['asset-input'],
      currentOutputs: ['asset-resized'],
      updatedAt: Date.now(),
    });

    // 用工厂创建(同一 dbName),应自动创建 historyStore 并预加载到上面写入的历史
    const runtime = await createRuntime({
      enableOpfs: false,
      enableIndexedDB: true,
      historyStoreOptions: { dbName },
    });
    const state = await runtime.getHistoryState(WF_ID);
    expect(state.entries).toHaveLength(1);
    expect(state.cursor).toBe(0);
    expect((runtime as LokvisRuntimeImpl)._getCurrentOutputs(WF_ID)).toEqual(['asset-resized']);
  });

  it('historyStore 为 undefined 时退化为仅内存历史(不抛错)', async () => {
    // 直接 new Impl 不传 historyStore
    const runtime = new LokvisRuntimeImpl({
      assetStore: createMemoryAssetStore(),
      storageQuota: 1024 * 1024,
    });
    const reg = runtime._getCapabilityRegistry();
    reg.registerCapability(makeCapabilityDecl('image.resize'));
    reg.registerCapability(makeCapabilityDecl('image.compress'));
    reg.registerImplementation(makeFakeImpl('image.resize', 'resized'));
    reg.registerImplementation(makeFakeImpl('image.compress', 'compressed'));

    await runtime.run(buildWorkflow(), [INPUT_ASSET]);
    const state = await runtime.getHistoryState(WF_ID);
    expect(state.entries).toHaveLength(2);
    // loadPersistedHistory 在无 store 时为 no-op
    await runtime.loadPersistedHistory();
    expect((await runtime.getHistoryState(WF_ID)).entries).toHaveLength(2);
  });
});
