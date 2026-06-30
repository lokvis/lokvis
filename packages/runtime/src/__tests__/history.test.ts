/**
 * HistoryStack 单元测试
 *
 * 覆盖(PROJECT_PLAN 2.10):
 * - append / getAll / length / cursor
 * - undo / redo 与游标移动
 * - redo 分支截断(append 新操作后丢弃 redo)
 * - LRU 淘汰(超出上限时移除最旧条目 + onEvict 回调)
 * - history:changed 事件
 * - clear
 */
import { describe, it, expect } from 'vitest';
import { HistoryStack, DEFAULT_MAX_HISTORY_ENTRIES } from '../history.js';
import { createEventBus } from '../event-bus.js';
import type { HistoryEntry } from '@lokvis/schema';

/** 创建测试用 HistoryEntry */
function makeEntry(
  id: string,
  inputs: string[] = [],
  outputs: string[] = [],
): HistoryEntry {
  return {
    id,
    workflowId: 'wf-1',
    nodeId: `node-${id}`,
    capability: 'image.resize',
    params: {},
    inputs,
    outputs,
    timestamp: Date.now(),
  };
}

describe('HistoryStack 基本操作', () => {
  it('初始状态:空历史,cursor=-1,不可 undo/redo', () => {
    const stack = new HistoryStack();
    expect(stack.length).toBe(0);
    expect(stack.getCursor()).toBe(-1);
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);
    expect(stack.getAll()).toEqual([]);
  });

  it('append 后 cursor 指向最后一条,可 undo 不可 redo', () => {
    const stack = new HistoryStack();
    stack.append(makeEntry('e1', ['in1'], ['out1']));
    expect(stack.length).toBe(1);
    expect(stack.getCursor()).toBe(0);
    expect(stack.canUndo()).toBe(true);
    expect(stack.canRedo()).toBe(false);
  });

  it('getAll 返回只读副本,修改不影响内部状态', () => {
    const stack = new HistoryStack();
    stack.append(makeEntry('e1'));
    const all = stack.getAll();
    all.length = 0;
    expect(stack.length).toBe(1);
  });
});

describe('HistoryStack undo/redo', () => {
  it('undo 应返回被撤销条目的 inputs,游标回退', () => {
    const stack = new HistoryStack();
    stack.append(makeEntry('e1', ['in1'], ['out1']));
    const result = stack.undo();
    expect(result).not.toBeNull();
    expect(result!.entry.id).toBe('e1');
    expect(result!.currentAssetIds).toEqual(['in1']);
    expect(stack.getCursor()).toBe(-1);
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(true);
  });

  it('空历史 undo 应返回 null', () => {
    const stack = new HistoryStack();
    expect(stack.undo()).toBeNull();
  });

  it('redo 应返回被重做条目的 outputs,游标前进', () => {
    const stack = new HistoryStack();
    stack.append(makeEntry('e1', ['in1'], ['out1']));
    stack.undo();
    const result = stack.redo();
    expect(result).not.toBeNull();
    expect(result!.entry.id).toBe('e1');
    expect(result!.currentAssetIds).toEqual(['out1']);
    expect(stack.getCursor()).toBe(0);
    expect(stack.canRedo()).toBe(false);
  });

  it('无可 redo 时返回 null', () => {
    const stack = new HistoryStack();
    stack.append(makeEntry('e1'));
    expect(stack.redo()).toBeNull();
  });

  it('多步 undo/redo 序列', () => {
    const stack = new HistoryStack();
    stack.append(makeEntry('e1', ['in1'], ['out1']));
    stack.append(makeEntry('e2', ['out1'], ['out2']));
    stack.append(makeEntry('e3', ['out2'], ['out3']));

    // undo e3 → current=out2
    expect(stack.undo()!.currentAssetIds).toEqual(['out2']);
    // undo e2 → current=out1
    expect(stack.undo()!.currentAssetIds).toEqual(['out1']);
    // undo e1 → current=in1
    expect(stack.undo()!.currentAssetIds).toEqual(['in1']);
    expect(stack.canUndo()).toBe(false);

    // redo e1 → current=out1
    expect(stack.redo()!.currentAssetIds).toEqual(['out1']);
    // redo e2 → current=out2
    expect(stack.redo()!.currentAssetIds).toEqual(['out2']);
    expect(stack.canRedo()).toBe(true);
  });
});

describe('HistoryStack redo 分支截断', () => {
  it('undo 后 append 新操作应丢弃 redo 分支', () => {
    const stack = new HistoryStack();
    stack.append(makeEntry('e1', ['in1'], ['out1']));
    stack.append(makeEntry('e2', ['out1'], ['out2']));
    stack.undo(); // cursor 回到 0

    // append 新操作,redo 分支(e2)应被丢弃
    stack.append(makeEntry('e3', ['out1'], ['out3']));

    expect(stack.length).toBe(2);
    expect(stack.getAll().map((e) => e.id)).toEqual(['e1', 'e3']);
    expect(stack.canRedo()).toBe(false);
    expect(stack.getCursor()).toBe(1);
  });

  it('多次 undo 后 append 只保留 cursor 之前的条目', () => {
    const stack = new HistoryStack();
    stack.append(makeEntry('e1'));
    stack.append(makeEntry('e2'));
    stack.append(makeEntry('e3'));
    stack.undo();
    stack.undo(); // cursor 回到 0

    stack.append(makeEntry('e4'));
    expect(stack.getAll().map((e) => e.id)).toEqual(['e1', 'e4']);
  });
});

describe('HistoryStack LRU 淘汰', () => {
  it('默认上限 10 条,超出时移除最旧条目', () => {
    expect(DEFAULT_MAX_HISTORY_ENTRIES).toBe(10);
    const evicted: HistoryEntry[] = [];
    const stack = new HistoryStack({
      maxEntries: 3,
      onEvict: (entries) => evicted.push(...entries),
    });

    stack.append(makeEntry('e1'));
    stack.append(makeEntry('e2'));
    stack.append(makeEntry('e3'));
    expect(stack.length).toBe(3);

    // 超出上限,e1 应被淘汰
    stack.append(makeEntry('e4'));
    expect(stack.length).toBe(3);
    expect(stack.getAll().map((e) => e.id)).toEqual(['e2', 'e3', 'e4']);
    expect(evicted.map((e) => e.id)).toEqual(['e1']);
  });

  it('LRU 淘汰后游标同步前移', () => {
    const stack = new HistoryStack({ maxEntries: 2 });
    stack.append(makeEntry('e1'));
    stack.append(makeEntry('e2'));
    stack.append(makeEntry('e3')); // e1 被淘汰

    expect(stack.getCursor()).toBe(1); // 原 cursor=2,淘汰后=1
    expect(stack.canUndo()).toBe(true);
  });

  it('onEvict 回调应收到被淘汰的条目', () => {
    const evicted: HistoryEntry[] = [];
    const stack = new HistoryStack({
      maxEntries: 2,
      onEvict: (entries) => evicted.push(...entries),
    });

    stack.append(makeEntry('e1', ['in1'], ['out1']));
    stack.append(makeEntry('e2'));
    stack.append(makeEntry('e3'));

    expect(evicted).toHaveLength(1);
    expect(evicted[0]!.id).toBe('e1');
    expect(evicted[0]!.outputs).toEqual(['out1']);
  });

  it('无 onEvict 回调时不报错', () => {
    const stack = new HistoryStack({ maxEntries: 1 });
    stack.append(makeEntry('e1'));
    expect(() => stack.append(makeEntry('e2'))).not.toThrow();
    expect(stack.length).toBe(1);
  });
});

describe('HistoryStack history:changed 事件', () => {
  it('append 后应发出 history:changed 事件', () => {
    const bus = createEventBus();
    const stack = new HistoryStack({
      eventBus: bus,
      workflowId: 'wf-1',
    });

    const events: { workflowId: string; entries: HistoryEntry[] }[] = [];
    bus.on('history:changed', (e) => events.push(e));

    stack.append(makeEntry('e1'));
    expect(events).toHaveLength(1);
    expect(events[0]!.workflowId).toBe('wf-1');
    expect(events[0]!.entries).toHaveLength(1);
  });

  it('undo/redo/clear 都应发出 history:changed', () => {
    const bus = createEventBus();
    const stack = new HistoryStack({ eventBus: bus, workflowId: 'wf-1' });

    const events: HistoryEntry[][] = [];
    bus.on('history:changed', (e) => events.push(e.entries));

    stack.append(makeEntry('e1'));
    stack.undo();
    stack.redo();
    stack.clear();

    // append + undo + redo + clear = 4 次
    expect(events).toHaveLength(4);
    expect(events[3]!).toEqual([]); // clear 后为空
  });
});

describe('HistoryStack clear', () => {
  it('clear 后历史为空,游标重置', () => {
    const stack = new HistoryStack();
    stack.append(makeEntry('e1'));
    stack.append(makeEntry('e2'));
    stack.clear();

    expect(stack.length).toBe(0);
    expect(stack.getCursor()).toBe(-1);
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);
  });
});
