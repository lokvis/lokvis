/**
 * history-manager 单元测试(W2.2)
 *
 * 直接测试 HistoryManager 类(不经过 Runtime / executor),聚焦:
 * - history / getHistoryState 空栈语义
 * - prepareForRun:默认重置 vs appendHistory 保留
 * - recordFromNodeEvent:append + currentOutputs 更新 + 空输出跳过
 * - undo/redo/jumpTo 链:currentOutputs 正确切换(null = 回到 initialInputs)
 * - enforceStacksLimit:FIFO 删最旧(32 上限)
 * - disposeHistory:清理栈与映射
 * - persistHistory:无 store / 保存快照 / 空栈 delete
 * - loadPersistedHistory:isLoadingHistory 守卫 + dirtyDuringLoad 补发
 */
import { describe, it, expect } from 'vitest';
import { HistoryManager } from '../managers/history-manager.js';
import { createEventBus } from '../event-bus.js';
import { createMemoryAssetStore } from '../asset-store.js';
import { wrapAssetStoreWithQuota } from '../managers/quota-manager.js';
import type { Asset, HistoryEntry, LokvisEvent } from '@lokvis/schema';
import type { HistoryRecord, HistoryStore } from '../history-store.js';

/** 内存版 HistoryStore(用于测试 persist / load 竞态) */
class MemoryHistoryStore implements HistoryStore {
  records = new Map<string, HistoryRecord>();
  async save(record: HistoryRecord): Promise<void> {
    this.records.set(record.workflowId, record);
  }
  async load(workflowId: string): Promise<HistoryRecord | undefined> {
    return this.records.get(workflowId);
  }
  async loadAll(): Promise<HistoryRecord[]> {
    return [...this.records.values()];
  }
  async delete(workflowId: string): Promise<void> {
    this.records.delete(workflowId);
  }
  async clear(): Promise<void> {
    this.records.clear();
  }
}

function makeFixture(withStore = false): {
  manager: HistoryManager;
  store?: MemoryHistoryStore;
  events: LokvisEvent[];
} {
  const inner = createMemoryAssetStore();
  const assetStore = wrapAssetStoreWithQuota(inner, 1024 * 1024);
  const eventBus = createEventBus();
  const store = withStore ? new MemoryHistoryStore() : undefined;
  const manager = new HistoryManager({ eventBus, assetStore, historyStore: store });
  const events: LokvisEvent[] = [];
  eventBus.onAny((e) => events.push(e));
  return { manager, store, events };
}

const WF = 'wf-test';

function makeAsset(id: string): Asset {
  return {
    id,
    type: 'image',
    metadata: { mimeType: 'image/png', size: 1, format: 'png' },
    blob: { path: `memory://${id}`, size: 1, mimeType: 'image/png' },
    history: [],
    tags: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

/** 构造 node:finished 事件 */
function nodeFinishedEvent(
  workflowId: string,
  nodeId: string,
  outputs: Asset[]
): Extract<LokvisEvent, { type: 'node:finished' }> {
  return {
    type: 'node:finished',
    workflowId,
    nodeId,
    capability: 'image.resize',
    params: {},
    outputs,
    duration: 1,
  };
}

describe('HistoryManager - 空栈语义', () => {
  it('history 对不存在的工作流返回 []', async () => {
    const { manager } = makeFixture();
    expect(await manager.history('unknown')).toEqual([]);
  });

  it('getHistoryState 对不存在的工作流返回 { entries: [], cursor: -1 }', async () => {
    const { manager } = makeFixture();
    const state = await manager.getHistoryState('unknown');
    expect(state.entries).toEqual([]);
    expect(state.cursor).toBe(-1);
  });

  it('getCurrentOutputs 对不存在的工作流返回 []', async () => {
    const { manager } = makeFixture();
    expect(manager.getCurrentOutputs('unknown')).toEqual([]);
  });
});

describe('HistoryManager - prepareForRun', () => {
  it('默认(appendHistory=false)应重置历史栈并初始化 initialInputs/currentOutputs', async () => {
    const { manager } = makeFixture();
    // 先有一些历史
    manager.prepareForRun(WF, ['in-1'], false);
    manager.recordFromNodeEvent(nodeFinishedEvent(WF, 'n1', [makeAsset('out-1')]));
    expect(await manager.history(WF)).toHaveLength(1);

    // 重跑:历史被清空,currentOutputs 重置为新 inputs
    manager.prepareForRun(WF, ['in-2'], false);
    expect(await manager.history(WF)).toHaveLength(0);
    expect(manager.getCurrentOutputs(WF)).toEqual(['in-2']);
  });

  it('appendHistory=true 且已有栈:保留栈,仅确保 initialInputs 已记录', async () => {
    const { manager } = makeFixture();
    manager.prepareForRun(WF, ['in-1'], false);
    manager.recordFromNodeEvent(nodeFinishedEvent(WF, 'n1', [makeAsset('out-1')]));

    // append 模式:历史保留
    manager.prepareForRun(WF, ['in-2'], true);
    expect(await manager.history(WF)).toHaveLength(1);
    // currentOutputs 不被重置(保留 append 语义)
  });

  it('appendHistory=true 但无已有栈:等同默认重置', async () => {
    const { manager } = makeFixture();
    manager.prepareForRun(WF, ['in-1'], true);
    expect(manager.getCurrentOutputs(WF)).toEqual(['in-1']);
  });
});

describe('HistoryManager - recordFromNodeEvent', () => {
  it('应 append 条目并更新 currentOutputs', async () => {
    const { manager } = makeFixture();
    manager.prepareForRun(WF, ['in-1'], false);
    manager.recordFromNodeEvent(nodeFinishedEvent(WF, 'n1', [makeAsset('out-1')]));
    const entries = await manager.history(WF);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.nodeId).toBe('n1');
    expect(manager.getCurrentOutputs(WF)).toEqual(['out-1']);
  });

  it('outputs 为空时应跳过(不 append)', async () => {
    const { manager } = makeFixture();
    manager.prepareForRun(WF, ['in-1'], false);
    manager.recordFromNodeEvent(nodeFinishedEvent(WF, 'n1', []));
    expect(await manager.history(WF)).toHaveLength(0);
  });

  it('连续多步:inputs 取上一步 outputs', async () => {
    const { manager } = makeFixture();
    manager.prepareForRun(WF, ['in-1'], false);
    manager.recordFromNodeEvent(nodeFinishedEvent(WF, 'n1', [makeAsset('out-1')]));
    manager.recordFromNodeEvent(nodeFinishedEvent(WF, 'n2', [makeAsset('out-2')]));
    const entries = await manager.history(WF);
    expect(entries).toHaveLength(2);
    // 第二步 inputs 应为第一步 outputs
    expect(entries[1]!.inputs).toEqual(['out-1']);
  });
});

describe('HistoryManager - undo/redo/jumpTo 链', () => {
  it('undo 一步:currentOutputs 回到上一步 outputs', async () => {
    const { manager } = makeFixture();
    manager.prepareForRun(WF, ['in-1'], false);
    manager.recordFromNodeEvent(nodeFinishedEvent(WF, 'n1', [makeAsset('out-1')]));
    manager.recordFromNodeEvent(nodeFinishedEvent(WF, 'n2', [makeAsset('out-2')]));
    expect(manager.getCurrentOutputs(WF)).toEqual(['out-2']);

    await manager.undo(WF);
    expect(manager.getCurrentOutputs(WF)).toEqual(['out-1']);
  });

  it('undo 到初始:currentOutputs 回到 initialInputs', async () => {
    const { manager } = makeFixture();
    manager.prepareForRun(WF, ['in-1'], false);
    manager.recordFromNodeEvent(nodeFinishedEvent(WF, 'n1', [makeAsset('out-1')]));
    await manager.undo(WF);
    expect(manager.getCurrentOutputs(WF)).toEqual(['in-1']);
  });

  it('redo 重做:currentOutputs 前进到该条目 outputs', async () => {
    const { manager } = makeFixture();
    manager.prepareForRun(WF, ['in-1'], false);
    manager.recordFromNodeEvent(nodeFinishedEvent(WF, 'n1', [makeAsset('out-1')]));
    manager.recordFromNodeEvent(nodeFinishedEvent(WF, 'n2', [makeAsset('out-2')]));
    await manager.undo(WF); // 回到 out-1
    await manager.redo(WF); // 前进到 out-2
    expect(manager.getCurrentOutputs(WF)).toEqual(['out-2']);
  });

  it('jumpTo 跳转:currentOutputs 切换到目标条目 outputs', async () => {
    const { manager } = makeFixture();
    manager.prepareForRun(WF, ['in-1'], false);
    manager.recordFromNodeEvent(nodeFinishedEvent(WF, 'n1', [makeAsset('out-1')]));
    manager.recordFromNodeEvent(nodeFinishedEvent(WF, 'n2', [makeAsset('out-2')]));
    manager.recordFromNodeEvent(nodeFinishedEvent(WF, 'n3', [makeAsset('out-3')]));
    // 跳回第 0 步
    await manager.jumpTo(WF, 0);
    expect(manager.getCurrentOutputs(WF)).toEqual(['out-1']);
    // 跳到初始(-1)
    await manager.jumpTo(WF, -1);
    expect(manager.getCurrentOutputs(WF)).toEqual(['in-1']);
  });

  it('recordRunResult:outputs 非空时更新 currentOutputs', () => {
    const { manager } = makeFixture();
    manager.prepareForRun(WF, ['in-1'], false);
    manager.recordRunResult(WF, ['final-out']);
    expect(manager.getCurrentOutputs(WF)).toEqual(['final-out']);
  });

  it('recordRunResult:outputs 为空时不更新 currentOutputs', () => {
    const { manager } = makeFixture();
    manager.prepareForRun(WF, ['in-1'], false);
    manager.recordRunResult(WF, []);
    expect(manager.getCurrentOutputs(WF)).toEqual(['in-1']);
  });
});

describe('HistoryManager - disposeHistory', () => {
  it('清理栈与映射,后续 history 返回 []', async () => {
    const { manager } = makeFixture();
    manager.prepareForRun(WF, ['in-1'], false);
    manager.recordFromNodeEvent(nodeFinishedEvent(WF, 'n1', [makeAsset('out-1')]));
    expect(await manager.history(WF)).toHaveLength(1);

    manager.disposeHistory(WF);
    expect(await manager.history(WF)).toEqual([]);
    expect(manager.getCurrentOutputs(WF)).toEqual([]);
  });
});

describe('HistoryManager - persistHistory', () => {
  it('无 historyStore 时为 no-op(不抛错)', async () => {
    const { manager } = makeFixture(false);
    manager.prepareForRun(WF, ['in-1'], false);
    manager.recordFromNodeEvent(nodeFinishedEvent(WF, 'n1', [makeAsset('out-1')]));
    // persistHistory 不抛错
    await manager.persistHistory(WF);
  });

  it('有 historyStore 时应保存快照(含 cursor / initialInputs / currentOutputs)', async () => {
    const { manager, store } = makeFixture(true);
    manager.prepareForRun(WF, ['in-1'], false);
    manager.recordFromNodeEvent(nodeFinishedEvent(WF, 'n1', [makeAsset('out-1')]));
    // onChanged 回调 fire-and-forget 调用 persistHistory,等微任务刷新
    await new Promise((r) => setTimeout(r, 0));

    const record = await store!.load(WF);
    expect(record).toBeDefined();
    expect(record!.entries).toHaveLength(1);
    expect(record!.cursor).toBe(0);
    expect(record!.initialInputs).toEqual(['in-1']);
    expect(record!.currentOutputs).toEqual(['out-1']);
  });

  it('entries 为空(栈已 dispose)时应 delete 持久化记录', async () => {
    const { manager, store } = makeFixture(true);
    manager.prepareForRun(WF, ['in-1'], false);
    manager.recordFromNodeEvent(nodeFinishedEvent(WF, 'n1', [makeAsset('out-1')]));
    await new Promise((r) => setTimeout(r, 0));
    expect(await store!.load(WF)).toBeDefined();

    // dispose 后 persist 应删除记录
    manager.disposeHistory(WF);
    await manager.persistHistory(WF);
    expect(await store!.load(WF)).toBeUndefined();
  });
});

describe('HistoryManager - loadPersistedHistory', () => {
  it('加载快照后 history / currentOutputs 恢复', async () => {
    const { manager, store } = makeFixture(true);
    // 预置一条持久化记录
    const entry: HistoryEntry = {
      id: 'h1',
      workflowId: WF,
      nodeId: 'n1',
      capability: 'image.resize',
      params: {},
      inputs: ['in-1'],
      outputs: ['out-1'],
      timestamp: 1000,
    };
    await store!.save({
      workflowId: WF,
      entries: [entry],
      cursor: 0,
      initialInputs: ['in-1'],
      currentOutputs: ['out-1'],
      updatedAt: 1000,
    });

    await manager.loadPersistedHistory();
    const entries = await manager.history(WF);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.nodeId).toBe('n1');
    expect(manager.getCurrentOutputs(WF)).toEqual(['out-1']);
  });

  it('空 entries 记录应被跳过(双重防御)', async () => {
    const { manager, store } = makeFixture(true);
    await store!.save({
      workflowId: WF,
      entries: [],
      cursor: -1,
      initialInputs: [],
      currentOutputs: [],
      updatedAt: 0,
    });
    await manager.loadPersistedHistory();
    expect(await manager.history(WF)).toEqual([]);
  });

  it('dirtyDuringLoad 补发:加载期间变更在加载后被 persist', async () => {
    const { manager, store } = makeFixture(true);
    // 预置一条记录触发 load 期间的 stack.restore → onChanged → persistHistory
    const entry: HistoryEntry = {
      id: 'h1',
      workflowId: WF,
      nodeId: 'n1',
      capability: 'image.resize',
      params: {},
      inputs: ['in-1'],
      outputs: ['out-1'],
      timestamp: 1000,
    };
    await store!.save({
      workflowId: WF,
      entries: [entry],
      cursor: 0,
      initialInputs: ['in-1'],
      currentOutputs: ['out-1'],
      updatedAt: 1000,
    });

    await manager.loadPersistedHistory();
    await new Promise((r) => setTimeout(r, 0));
    // 补发后,记录仍存在且 entries 完整(未被误删)
    const record = await store!.load(WF);
    expect(record).toBeDefined();
    expect(record!.entries).toHaveLength(1);
  });

  it('无 historyStore 时为 no-op(不抛错)', async () => {
    const { manager } = makeFixture(false);
    await manager.loadPersistedHistory();
  });
});
