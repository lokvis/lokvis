/**
 * HistoryStack 单元测试(PROJECT_PLAN W2.10)
 *
 * 覆盖:
 * - append / list / currentIndex / canUndo / canRedo
 * - undo / redo 游标语义(null = 回到初始,undefined = 无操作)
 * - 截断 redo 分支
 * - LRU 淘汰 + onEvict 回调
 * - onChanged 回调
 * - jumpTo / clear / snapshot / restore
 * - workflowId 不匹配抛错
 */
import { describe, it, expect } from 'vitest';
import { HistoryStack, createHistoryStack } from '../history.js';
import type { HistoryEntry } from '@lokvis/schema';

const WF = 'wf-test';

function entry(
  n: number,
  workflowId = WF,
  outputs: string[] = [`out-${n}`]
): HistoryEntry {
  return {
    id: `h${n}`,
    workflowId,
    nodeId: `node-${n}`,
    capability: 'image.resize',
    params: { n },
    inputs: n > 0 ? [`out-${n - 1}`] : ['in-0'],
    outputs,
    timestamp: 1000 + n,
  };
}

describe('HistoryStack 基础', () => {
  it('初始状态:空,cannot undo/redo', () => {
    const s = new HistoryStack(WF);
    expect(s.length).toBe(0);
    expect(s.currentIndex).toBe(-1);
    expect(s.canUndo).toBe(false);
    expect(s.canRedo).toBe(false);
    expect(s.list()).toEqual([]);
    expect(s.applied()).toEqual([]);
    expect(s.redoBranch()).toEqual([]);
  });

  it('append 后 cursor 指向最新条目', () => {
    const s = new HistoryStack(WF);
    s.append(entry(0));
    expect(s.length).toBe(1);
    expect(s.currentIndex).toBe(0);
    expect(s.canUndo).toBe(true);
    expect(s.canRedo).toBe(false);
    expect(s.applied()).toHaveLength(1);
    expect(s.redoBranch()).toHaveLength(0);
  });

  it('workflowId 不匹配应抛错', () => {
    const s = new HistoryStack(WF);
    expect(() => s.append(entry(0, 'other-wf'))).toThrow(/mismatch/);
  });
});

describe('HistoryStack undo/redo', () => {
  it('空栈 undo 返回 undefined', () => {
    const s = new HistoryStack(WF);
    expect(s.undo()).toBeUndefined();
  });

  it('空栈 redo 返回 undefined', () => {
    const s = new HistoryStack(WF);
    expect(s.redo()).toBeUndefined();
  });

  it('undo 一次返回当前应应用条目(最后一条)', () => {
    const s = new HistoryStack(WF);
    s.append(entry(0));
    s.append(entry(1));
    const r = s.undo();
    // undo 后 cursor=0,应返回 entry(0)
    expect(r).toEqual(entry(0));
    expect(s.currentIndex).toBe(0);
    expect(s.canRedo).toBe(true);
    expect(s.canUndo).toBe(true);
  });

  it('undo 到初始状态返回 null', () => {
    const s = new HistoryStack(WF);
    s.append(entry(0));
    const r = s.undo();
    // undo 后 cursor=-1,应返回 null(表示回到初始)
    expect(r).toBeNull();
    expect(s.currentIndex).toBe(-1);
    expect(s.canUndo).toBe(false);
    expect(s.canRedo).toBe(true);
  });

  it('redo 重做一步返回该条目', () => {
    const s = new HistoryStack(WF);
    s.append(entry(0));
    s.append(entry(1));
    s.undo(); // cursor=0
    const r = s.redo();
    expect(r).toEqual(entry(1));
    expect(s.currentIndex).toBe(1);
    expect(s.canRedo).toBe(false);
  });

  it('多次 undo 再 redo 回到最新', () => {
    const s = new HistoryStack(WF);
    s.append(entry(0));
    s.append(entry(1));
    s.append(entry(2));
    expect(s.undo()).toEqual(entry(1));
    expect(s.undo()).toEqual(entry(0));
    expect(s.undo()).toBeNull();
    expect(s.redo()).toEqual(entry(0));
    expect(s.redo()).toEqual(entry(1));
    expect(s.redo()).toEqual(entry(2));
    expect(s.canRedo).toBe(false);
  });
});

describe('HistoryStack 截断 redo 分支', () => {
  it('undo 后 append 新条目应丢弃 redo 分支', () => {
    const s = new HistoryStack(WF);
    s.append(entry(0));
    s.append(entry(1));
    s.undo(); // cursor=0, redo 分支=[entry(1)]
    // 新操作应截断 entry(1)
    const fresh = entry(2, WF, ['out-fresh']);
    s.append(fresh);
    expect(s.list()).toEqual([entry(0), fresh]);
    expect(s.canRedo).toBe(false);
    expect(s.currentIndex).toBe(1);
  });

  it('截断 redo 分支时应触发 onEvict 清理被丢弃条目的 outputs 资产', () => {
    const evicted: HistoryEntry[] = [];
    const s = new HistoryStack(WF, {
      onEvict: (e) => evicted.push(e),
    });
    s.append(entry(0));
    s.append(entry(1));
    s.append(entry(2));
    s.undo(); // cursor=1, redo 分支=[entry(2)]
    s.undo(); // cursor=0, redo 分支=[entry(1), entry(2)]
    const fresh = entry(99, WF, ['out-fresh']);
    s.append(fresh);
    // 被丢弃的 entry(1) 和 entry(2) 都应通过 onEvict 通知清理
    expect(evicted).toEqual([entry(1), entry(2)]);
    expect(s.list()).toEqual([entry(0), fresh]);
  });

  it('截断 redo 分支时 onEvict 抛错不应阻断 append', () => {
    const s = new HistoryStack(WF, {
      onEvict: () => {
        throw new Error('cleanup failed');
      },
    });
    s.append(entry(0));
    s.append(entry(1));
    s.undo(); // cursor=0, redo 分支=[entry(1)]
    expect(() => s.append(entry(2, WF, ['fresh']))).not.toThrow();
    expect(s.list()).toEqual([entry(0), entry(2, WF, ['fresh'])]);
  });

  it('连续 undo 多步后 append 只保留 cursor 之前的', () => {
    const s = new HistoryStack(WF);
    s.append(entry(0));
    s.append(entry(1));
    s.append(entry(2));
    s.undo(); // cursor=1
    s.undo(); // cursor=0
    const fresh = entry(99, WF, ['out-x']);
    s.append(fresh);
    expect(s.list()).toEqual([entry(0), fresh]);
  });
});

describe('HistoryStack LRU 淘汰 + onEvict', () => {
  it('超过 maxEntries 应从最旧端淘汰并触发 onEvict', () => {
    const evicted: HistoryEntry[] = [];
    const s = new HistoryStack(WF, {
      maxEntries: 2,
      onEvict: (e) => evicted.push(e),
    });
    s.append(entry(0));
    s.append(entry(1));
    s.append(entry(2)); // 淘汰 entry(0)
    expect(s.length).toBe(2);
    expect(s.list()).toEqual([entry(1), entry(2)]);
    expect(evicted).toEqual([entry(0)]);
    // cursor 应跟随:append 后指向最新(索引1),淘汰 1 条后仍为最新
    expect(s.currentIndex).toBe(1);
  });

  it('无 onEvict 回调时仍维护上限(静默丢弃)', () => {
    const s = new HistoryStack(WF, { maxEntries: 2 });
    s.append(entry(0));
    s.append(entry(1));
    s.append(entry(2));
    expect(s.length).toBe(2);
    expect(s.list()).toEqual([entry(1), entry(2)]);
  });

  it('onEvict 抛错不应阻断历史操作', () => {
    const s = new HistoryStack(WF, {
      maxEntries: 1,
      onEvict: () => {
        throw new Error('cleanup failed');
      },
    });
    s.append(entry(0));
    expect(() => s.append(entry(1))).not.toThrow();
    expect(s.length).toBe(1);
    expect(s.list()).toEqual([entry(1)]);
  });

  it('淘汰后 cursor 不低于 -1', () => {
    const s = new HistoryStack(WF, { maxEntries: 1 });
    s.append(entry(0));
    s.append(entry(1)); // 淘汰 entry(0), cursor 应为 0(指向 entry(1))
    expect(s.currentIndex).toBe(0);
    s.append(entry(2)); // 淘汰 entry(1), cursor 应为 0
    expect(s.currentIndex).toBe(0);
    expect(s.list()).toEqual([entry(2)]);
  });
});

describe('HistoryStack onChanged 回调', () => {
  it('每次变更都应触发 onChanged(workflowId, entries)', () => {
    const calls: { wf: string; entries: HistoryEntry[] }[] = [];
    const s = new HistoryStack(WF, {
      onChanged: (wf, entries) => calls.push({ wf, entries }),
    });
    s.append(entry(0));
    s.append(entry(1));
    s.undo();
    s.redo();
    // append x2 + undo + redo = 4 次
    expect(calls).toHaveLength(4);
    expect(calls[0]!.wf).toBe(WF);
    expect(calls[0]!.entries).toHaveLength(1);
    // 最后一次 redo 后 entries 应有 2 条
    expect(calls.at(-1)!.entries).toHaveLength(2);
  });
});

describe('HistoryStack jumpTo / clear / snapshot', () => {
  it('jumpTo 有效索引应移动 cursor', () => {
    const s = new HistoryStack(WF);
    s.append(entry(0));
    s.append(entry(1));
    s.append(entry(2));
    const r = s.jumpTo(0);
    expect(r).toEqual(entry(0));
    expect(s.currentIndex).toBe(0);
    expect(s.canRedo).toBe(true);
  });

  it('jumpTo(-1) 回到初始返回 null', () => {
    const s = new HistoryStack(WF);
    s.append(entry(0));
    expect(s.jumpTo(-1)).toBeNull();
    expect(s.currentIndex).toBe(-1);
  });

  it('jumpTo 越界返回 undefined 且不改变状态', () => {
    const s = new HistoryStack(WF);
    s.append(entry(0));
    expect(s.jumpTo(5)).toBeUndefined();
    expect(s.jumpTo(-2)).toBeUndefined();
    expect(s.currentIndex).toBe(0);
  });

  it('clear 清空所有条目', () => {
    const s = new HistoryStack(WF);
    s.append(entry(0));
    s.append(entry(1));
    s.clear();
    expect(s.length).toBe(0);
    expect(s.currentIndex).toBe(-1);
    expect(s.canUndo).toBe(false);
  });

  it('reset 清空条目并触发 onEvict 回收每条 outputs 资产', () => {
    const evicted: HistoryEntry[] = [];
    const s = new HistoryStack(WF, {
      onEvict: (e) => evicted.push(e),
    });
    s.append(entry(0));
    s.append(entry(1));
    s.append(entry(2));
    s.reset();
    expect(s.length).toBe(0);
    expect(s.currentIndex).toBe(-1);
    expect(s.canUndo).toBe(false);
    // 三条历史都应被通知清理(用于 run 重跑时回收中间产物)
    expect(evicted).toEqual([entry(0), entry(1), entry(2)]);
  });

  it('reset 空栈不应触发 onEvict', () => {
    const evicted: HistoryEntry[] = [];
    const s = new HistoryStack(WF, {
      onEvict: (e) => evicted.push(e),
    });
    expect(() => s.reset()).not.toThrow();
    expect(evicted).toEqual([]);
  });

  it('snapshot / restore 往返', () => {
    const s = new HistoryStack(WF);
    s.append(entry(0));
    s.append(entry(1));
    s.undo(); // cursor=0
    const snap = s.snapshot();
    expect(snap.cursor).toBe(0);
    expect(snap.entries).toHaveLength(2);

    const s2 = new HistoryStack(WF);
    s2.restore(snap);
    expect(s2.list()).toEqual([entry(0), entry(1)]);
    expect(s2.currentIndex).toBe(0);
    expect(s2.canRedo).toBe(true);
  });

  it('restore cursor 超出范围应被截断到合法值(上界)', () => {
    const s = new HistoryStack(WF);
    s.restore({ entries: [entry(0)], cursor: 99 });
    expect(s.currentIndex).toBe(0);
  });

  it('restore cursor 损坏为负值应 clamp 到 -1(下界)', () => {
    const s = new HistoryStack(WF);
    s.restore({ entries: [entry(0)], cursor: -5 });
    expect(s.currentIndex).toBe(-1);
    expect(s.canUndo).toBe(false);
  });
});

describe('createHistoryStack 工厂', () => {
  it('应创建独立实例,默认 maxEntries=10', () => {
    const s = createHistoryStack(WF);
    for (let i = 0; i < 12; i++) s.append(entry(i));
    expect(s.length).toBe(10);
  });
});
