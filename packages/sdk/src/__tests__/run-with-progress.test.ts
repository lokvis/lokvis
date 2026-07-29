/**
 * runWithProgress 单测(#9 执行编排下沉)
 *
 * 覆盖:
 * - 订阅 node:started/finished/failed → 归一为 NodeStatusUpdate 回调
 * - runtime.run 返回结果原样透传(result)
 * - 逐个 getAsset 加载输出;失败的进 failedOutputIds,不静默丢弃
 * - finally 卸载所有订阅(run 后 eventBus 无残留 handler)
 * - 不传 onNodeStatus 时不订阅节点事件
 */
import { describe, it, expect } from 'vitest';
import { runWithProgress, type NodeStatusUpdate } from '../run-with-progress.js';
import type { LokvisRuntime } from '@lokvis/runtime';
import type {
  Asset,
  AssetId,
  LokvisEvent,
  LokvisEventType,
  Workflow,
  WorkflowResult,
} from '@lokvis/schema';

/** 最小 EventBus fake(仅 on / emit,计数 handler 便于断言卸载) */
function makeEventBus() {
  const handlers = new Map<string, Set<(e: LokvisEvent) => void>>();
  return {
    on<T extends LokvisEventType>(
      type: T,
      handler: (event: Extract<LokvisEvent, { type: T }>) => void
    ): () => void {
      const set = handlers.get(type) ?? new Set();
      set.add(handler as (e: LokvisEvent) => void);
      handlers.set(type, set);
      return () => {
        set.delete(handler as (e: LokvisEvent) => void);
      };
    },
    onAny() {
      return () => {};
    },
    emit(event: LokvisEvent) {
      for (const h of [...(handlers.get(event.type) ?? [])]) h(event);
    },
    clear() {
      handlers.clear();
    },
    /** 测试辅助:某事件当前 handler 数 */
    _count(type: string) {
      return handlers.get(type)?.size ?? 0;
    },
  };
}

function makeWorkflow(id = 'wf'): Workflow {
  return {
    id,
    version: '1.0.0',
    name: 'wf',
    description: 'd',
    author: { id: 't', name: 'T' },
    category: 'image',
    tags: [],
    nodes: [{ id: 'n1', type: 'transform', capability: 'image.resize' }],
    edges: [],
    inputs: { type: 'image', multiple: false },
    outputs: { type: 'image' },
  };
}

function makeAsset(id: string): Asset {
  return {
    id: id as AssetId,
    type: 'image',
    name: `${id}.png`,
    mimeType: 'image/png',
    size: 1,
    createdAt: 0,
    updatedAt: 0,
    metadata: {},
  } as unknown as Asset;
}

/** 构造 fake runtime:run 时按序 emit 节点事件并返回给定 result */
function makeRuntime(opts: {
  bus: ReturnType<typeof makeEventBus>;
  result: WorkflowResult;
  emitDuringRun?: (bus: ReturnType<typeof makeEventBus>) => void;
  assets?: Record<string, Asset>;
  failingAssetIds?: Set<string>;
}): LokvisRuntime {
  const { bus, result, emitDuringRun, assets = {}, failingAssetIds } = opts;
  return {
    eventBus: bus,
    async run() {
      emitDuringRun?.(bus);
      return result;
    },
    async getAsset(id: AssetId) {
      if (failingAssetIds?.has(id)) {
        throw new Error(`getAsset failed: ${id}`);
      }
      const a = assets[id];
      if (!a) throw new Error(`no asset ${id}`);
      return a;
    },
  } as unknown as LokvisRuntime;
}

function completedResult(outputs: string[]): WorkflowResult {
  return {
    status: 'completed',
    outputs: outputs as AssetId[],
    duration: 42,
  } as WorkflowResult;
}

describe('runWithProgress(#9 执行编排下沉)', () => {
  it('订阅节点事件并归一为 NodeStatusUpdate 回调', async () => {
    const bus = makeEventBus();
    const runtime = makeRuntime({
      bus,
      result: completedResult(['out1']),
      assets: { out1: makeAsset('out1') },
      emitDuringRun: (b) => {
        b.emit({ type: 'node:started', nodeId: 'n1' } as LokvisEvent);
        b.emit({ type: 'node:finished', nodeId: 'n1', duration: 10 } as LokvisEvent);
      },
    });

    const updates: NodeStatusUpdate[] = [];
    await runWithProgress(runtime, makeWorkflow(), [], {
      onNodeStatus: (u) => updates.push(u),
    });

    expect(updates).toEqual([
      { nodeId: 'n1', status: 'running' },
      { nodeId: 'n1', status: 'success', duration: 10 },
    ]);
  });

  it('node:failed 归一为 status=failed 并带 error 文案', async () => {
    const bus = makeEventBus();
    const runtime = makeRuntime({
      bus,
      result: completedResult([]),
      emitDuringRun: (b) => {
        b.emit({
          type: 'node:failed',
          nodeId: 'n1',
          error: new Error('boom'),
        } as LokvisEvent);
      },
    });

    const updates: NodeStatusUpdate[] = [];
    await runWithProgress(runtime, makeWorkflow(), [], {
      onNodeStatus: (u) => updates.push(u),
    });

    expect(updates).toEqual([{ nodeId: 'n1', status: 'failed', error: 'boom' }]);
  });

  it('透传 result 并加载输出资产', async () => {
    const bus = makeEventBus();
    const runtime = makeRuntime({
      bus,
      result: completedResult(['out1', 'out2']),
      assets: { out1: makeAsset('out1'), out2: makeAsset('out2') },
    });

    const { result, outputs, failedOutputIds } = await runWithProgress(
      runtime,
      makeWorkflow(),
      []
    );

    expect(result.status).toBe('completed');
    expect(outputs.map((o) => o.id)).toEqual(['out1', 'out2']);
    expect(failedOutputIds).toEqual([]);
  });

  it('getAsset 失败的输出进 failedOutputIds,不静默丢弃', async () => {
    const bus = makeEventBus();
    const runtime = makeRuntime({
      bus,
      result: completedResult(['ok', 'bad']),
      assets: { ok: makeAsset('ok') },
      failingAssetIds: new Set(['bad']),
    });

    const { outputs, failedOutputIds } = await runWithProgress(
      runtime,
      makeWorkflow(),
      []
    );

    expect(outputs.map((o) => o.id)).toEqual(['ok']);
    expect(failedOutputIds).toEqual(['bad']);
  });

  it('finally 卸载所有订阅(run 后 eventBus 无残留 handler)', async () => {
    const bus = makeEventBus();
    const runtime = makeRuntime({ bus, result: completedResult([]) });

    await runWithProgress(runtime, makeWorkflow(), [], {
      onNodeStatus: () => {},
    });

    expect(bus._count('node:started')).toBe(0);
    expect(bus._count('node:finished')).toBe(0);
    expect(bus._count('node:failed')).toBe(0);
  });

  it('不传 onNodeStatus 时不订阅节点事件', async () => {
    const bus = makeEventBus();
    const runtime = makeRuntime({ bus, result: completedResult([]) });

    await runWithProgress(runtime, makeWorkflow(), []);

    expect(bus._count('node:started')).toBe(0);
  });

  it('run 抛错时仍卸载订阅', async () => {
    const bus = makeEventBus();
    const runtime = {
      eventBus: bus,
      async run() {
        throw new Error('run failed');
      },
      async getAsset() {
        throw new Error('unused');
      },
    } as unknown as LokvisRuntime;

    await expect(
      runWithProgress(runtime, makeWorkflow(), [], { onNodeStatus: () => {} })
    ).rejects.toThrow('run failed');

    expect(bus._count('node:started')).toBe(0);
  });
});
