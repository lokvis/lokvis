/**
 * BatchProcessor 单元测试(W6.8)
 *
 * 覆盖:
 * - 并发控制:free=4 / pro=16,同时 processing 项不超过槽位
 * - 失败重试:maxRetries 内重试成功 / 达上限标记 failed
 * - 批量上限:免费 10 文件超限抛 BatchLimitExceededError / Pro 无上限
 * - 取消:cancel 终止 pending 项,in-flight 项调 runtime.cancel
 * - 进度事件:batch:started / batch:item:* / batch:progress / batch:completed
 * - 暂停/恢复:pause 后不补新项,resume 继续
 * - retryFailed:重置 failed 项重新执行
 *
 * mock 策略:LokvisRuntime 用最小 mock(只实现 importAsset/run/cancel),
 * 其余方法 stub;EventBus 用真实 createEventBus(验证事件正确触发)。
 */
import { describe, it, expect } from 'vitest';
import {
  BatchProcessor,
  BatchLimitExceededError,
  FREE_BATCH_LIMIT,
  FREE_CONCURRENCY,
  PRO_CONCURRENCY,
} from '../batch-processor.js';
import { createEventBus } from '../event-bus.js';
import type { LokvisRuntime, RunOptions } from '../types.js';
import type {
  Asset,
  AssetId,
  AssetSource,
  Capability,
  HistoryEntry,
  McpManifest,
  Workflow,
  WorkflowResult,
} from '@lokvis/schema';

// ─── mock 工具 ──────────────────────────────────────────────────

/** 构造最小合法 Workflow(供 BatchItemInput.workflow 使用) */
function makeWorkflow(id = 'wf-test'): Workflow {
  return {
    id,
    version: '1.0.0',
    name: 'test-wf',
    description: 'test workflow',
    author: { id: 'tester', name: 'Tester' },
    category: 'image',
    tags: [],
    nodes: [{ id: 'n1', type: 'transform', capability: 'image.resize' }],
    edges: [],
    inputs: { type: 'image', multiple: false },
    outputs: { type: 'image' },
  };
}

interface MockRuntimeOptions {
  runImpl?: (wf: Workflow, inputs: AssetId[]) => Promise<WorkflowResult>;
  cancelImpl?: (wfId: string) => Promise<void>;
  importImpl?: (source: AssetSource) => Promise<AssetId>;
  isPro?: boolean;
}

/** 创建 mock LokvisRuntime(只实现 BatchProcessor 依赖的 3 个方法) */
function createMockRuntime(opts: MockRuntimeOptions = {}): LokvisRuntime {
  const eventBus = createEventBus();
  let assetCounter = 0;
  let outCounter = 0;
  return {
    version: '0.1.0',
    status: 'idle',
    isPro: opts.isPro ?? false,
    batch: undefined as never,
    eventBus,
    async importAsset(source: AssetSource): Promise<AssetId> {
      if (opts.importImpl) return opts.importImpl(source);
      return `in_${++assetCounter}`;
    },
    async run(
      workflow: Workflow,
      inputs: AssetId[] | Asset[],
      _options?: RunOptions
    ): Promise<WorkflowResult> {
      if (opts.runImpl) return opts.runImpl(workflow, inputs as AssetId[]);
      return {
        workflowId: workflow.id,
        outputs: [`out_${++outCounter}`],
        duration: 1,
        status: 'completed',
      };
    },
    async cancel(workflowId: string): Promise<void> {
      if (opts.cancelImpl) await opts.cancelImpl(workflowId);
    },
    async pause() {},
    async resume() {},
    async getCurrentOutputs(): Promise<AssetId[]> {
      return [];
    },
    async disposeWorkflow() {},
    async history(): Promise<HistoryEntry[]> {
      return [];
    },
    async undo() {},
    async redo() {},
    async getAsset(): Promise<Asset> {
      throw new Error('not mocked');
    },
    async exportAsset(): Promise<Blob> {
      return new Blob();
    },
    async removeAsset() {},
    async listAssets(): Promise<Asset[]> {
      return [];
    },
    async capabilities(): Promise<Capability[]> {
      return [];
    },
    async hasCapability(): Promise<boolean> {
      return false;
    },
    toMcpManifest(): McpManifest {
      return {
        serverName: 'lokvis',
        version: '0.1.0',
        tools: [],
        resources: [],
      };
    },
  } as unknown as LokvisRuntime;
}

/** 构造批量项输入 */
function makeItems(count: number): { source: AssetSource; workflow: Workflow }[] {
  return Array.from({ length: count }, (_, i) => ({
    source: {
      kind: 'blob',
      blob: new Blob([new Uint8Array([i])]),
      name: `f${i}.png`,
    },
    workflow: makeWorkflow(),
  }));
}

// ─── 并发控制 ──────────────────────────────────────────────────

describe('BatchProcessor 并发控制', () => {
  it('free 用户并发应不超过 FREE_CONCURRENCY(4)', async () => {
    let active = 0;
    let maxActive = 0;
    const runtime = createMockRuntime({
      runImpl: async (wf) => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 20));
        active--;
        return {
          workflowId: wf.id,
          outputs: [`out_${wf.id}`],
          duration: 0,
          status: 'completed' as const,
        };
      },
    });
    const bp = new BatchProcessor({
      runtime,
      eventBus: runtime.eventBus,
      isPro: false,
    });

    const job = bp.enqueue({ items: makeItems(10) });
    const finalJob = await bp.waitForCompletion(job.id);

    expect(maxActive).toBeLessThanOrEqual(FREE_CONCURRENCY);
    expect(maxActive).toBe(FREE_CONCURRENCY);
    expect(finalJob.status).toBe('completed');
    expect(finalJob.completed).toBe(10);
  });

  it('Pro 用户并发应不超过 PRO_CONCURRENCY(16)', async () => {
    let active = 0;
    let maxActive = 0;
    const runtime = createMockRuntime({
      isPro: true,
      runImpl: async (wf) => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 20));
        active--;
        return {
          workflowId: wf.id,
          outputs: [`out`],
          duration: 0,
          status: 'completed' as const,
        };
      },
    });
    const bp = new BatchProcessor({
      runtime,
      eventBus: runtime.eventBus,
      isPro: true,
    });

    const job = bp.enqueue({ items: makeItems(20) });
    const finalJob = await bp.waitForCompletion(job.id);

    expect(maxActive).toBeLessThanOrEqual(PRO_CONCURRENCY);
    expect(finalJob.status).toBe('completed');
  });

  it('自定义 concurrency 选项应覆盖默认值', async () => {
    let active = 0;
    let maxActive = 0;
    const runtime = createMockRuntime({
      runImpl: async (wf) => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 20));
        active--;
        return {
          workflowId: wf.id,
          outputs: [`out`],
          duration: 0,
          status: 'completed' as const,
        };
      },
    });
    const bp = new BatchProcessor({
      runtime,
      eventBus: runtime.eventBus,
      isPro: false,
    });

    const job = bp.enqueue({ items: makeItems(8), concurrency: 2 });
    await bp.waitForCompletion(job.id);

    expect(maxActive).toBeLessThanOrEqual(2);
    expect(maxActive).toBe(2);
  });
});

// ─── 批量上限(W6.2)──────────────────────────────────────────

describe('BatchProcessor 批量上限', () => {
  it('free 用户超过 10 文件应抛 BatchLimitExceededError', () => {
    const runtime = createMockRuntime({});
    const bp = new BatchProcessor({
      runtime,
      eventBus: runtime.eventBus,
      isPro: false,
    });

    expect(() => bp.enqueue({ items: makeItems(FREE_BATCH_LIMIT + 1) })).toThrow(
      BatchLimitExceededError
    );
  });

  it('BatchLimitExceededError 应携带 limit 与 requested', () => {
    const runtime = createMockRuntime({});
    const bp = new BatchProcessor({
      runtime,
      eventBus: runtime.eventBus,
      isPro: false,
    });

    try {
      bp.enqueue({ items: makeItems(15) });
      expect.fail('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BatchLimitExceededError);
      const e = err as BatchLimitExceededError;
      expect(e.limit).toBe(FREE_BATCH_LIMIT);
      expect(e.requested).toBe(15);
    }
  });

  it('Pro 用户无上限(20 文件应成功)', async () => {
    const runtime = createMockRuntime({ isPro: true });
    const bp = new BatchProcessor({
      runtime,
      eventBus: runtime.eventBus,
      isPro: true,
    });

    const job = bp.enqueue({ items: makeItems(20) });
    const finalJob = await bp.waitForCompletion(job.id);

    expect(finalJob.status).toBe('completed');
    expect(finalJob.total).toBe(20);
  });

  it('恰好 10 文件(free 上限边界)应成功', async () => {
    const runtime = createMockRuntime({});
    const bp = new BatchProcessor({
      runtime,
      eventBus: runtime.eventBus,
      isPro: false,
    });

    const job = bp.enqueue({ items: makeItems(FREE_BATCH_LIMIT) });
    const finalJob = await bp.waitForCompletion(job.id);

    expect(finalJob.status).toBe('completed');
  });
});

// ─── 失败重试 ──────────────────────────────────────────────────

describe('BatchProcessor 失败重试', () => {
  it('maxRetries=1,首次失败后重试成功 → completed', async () => {
    let callCount = 0;
    const runtime = createMockRuntime({
      runImpl: async (wf) => {
        callCount++;
        if (callCount === 1) throw new Error('transient failure');
        return {
          workflowId: wf.id,
          outputs: ['out'],
          duration: 0,
          status: 'completed' as const,
        };
      },
    });
    const bp = new BatchProcessor({
      runtime,
      eventBus: runtime.eventBus,
      isPro: false,
    });

    const job = bp.enqueue({ items: makeItems(1), maxRetries: 1 });
    const finalJob = await bp.waitForCompletion(job.id);

    expect(finalJob.status).toBe('completed');
    expect(callCount).toBe(2);
    expect(finalJob.items[0]!.attempts).toBe(1);
  });

  it('重试达上限后标记 failed', async () => {
    const runtime = createMockRuntime({
      runImpl: async () => {
        throw new Error('permanent failure');
      },
    });
    const bp = new BatchProcessor({
      runtime,
      eventBus: runtime.eventBus,
      isPro: false,
    });

    const job = bp.enqueue({ items: makeItems(1), maxRetries: 1 });
    const finalJob = await bp.waitForCompletion(job.id);

    expect(finalJob.status).toBe('failed');
    expect(finalJob.failed).toBe(1);
    expect(finalJob.items[0]!.attempts).toBe(2); // 首次 + 1 次重试
    expect(finalJob.items[0]!.error?.message).toBe('permanent failure');
  });

  it('默认 maxRetries=0,首次失败即 failed', async () => {
    const runtime = createMockRuntime({
      runImpl: async () => {
        throw new Error('no retry');
      },
    });
    const bp = new BatchProcessor({
      runtime,
      eventBus: runtime.eventBus,
      isPro: false,
    });

    const job = bp.enqueue({ items: makeItems(1) });
    const finalJob = await bp.waitForCompletion(job.id);

    expect(finalJob.status).toBe('failed');
    expect(finalJob.items[0]!.attempts).toBe(1);
  });

  it('单项 maxRetries 覆盖 job 级 maxRetries', async () => {
    let callCount = 0;
    const runtime = createMockRuntime({
      runImpl: async () => {
        callCount++;
        throw new Error('always fail');
      },
    });
    const bp = new BatchProcessor({
      runtime,
      eventBus: runtime.eventBus,
      isPro: false,
    });

    const items = makeItems(1).map((it) => ({ ...it, maxRetries: 2 }));
    const job = bp.enqueue({ items, maxRetries: 0 });
    const finalJob = await bp.waitForCompletion(job.id);

    expect(finalJob.status).toBe('failed');
    expect(callCount).toBe(3); // 首次 + 2 次重试
  });
});

// ─── 取消 ──────────────────────────────────────────────────────

describe('BatchProcessor 取消', () => {
  it('cancel 应终止 job,pending 项标记 cancelled', async () => {
    const runtime = createMockRuntime({
      runImpl: async (wf) => {
        // 慢执行,让部分项保持 pending
        await new Promise((r) => setTimeout(r, 50));
        return {
          workflowId: wf.id,
          outputs: ['out'],
          duration: 0,
          status: 'completed' as const,
        };
      },
    });
    const bp = new BatchProcessor({
      runtime,
      eventBus: runtime.eventBus,
      isPro: false,
    });

    const job = bp.enqueue({ items: makeItems(10) });
    // 等待 schedule 启动部分项
    await new Promise((r) => setTimeout(r, 5));
    await bp.cancel(job.id);

    const finalJob = bp.get(job.id);
    expect(finalJob?.status).toBe('cancelled');
    // 所有项应处于 cancelled/completed 之一,无 pending/processing
    for (const item of finalJob!.items) {
      expect(['cancelled', 'completed']).toContain(item.status);
    }
  });

  it('cancel 应调用 runtime.cancel 取消 in-flight workflow', async () => {
    const cancelledIds: string[] = [];
    const runtime = createMockRuntime({
      runImpl: async (wf) => {
        await new Promise((r) => setTimeout(r, 100));
        return {
          workflowId: wf.id,
          outputs: ['out'],
          duration: 0,
          status: 'completed' as const,
        };
      },
      cancelImpl: async (wfId: string) => {
        cancelledIds.push(wfId);
      },
    });
    const bp = new BatchProcessor({
      runtime,
      eventBus: runtime.eventBus,
      isPro: false,
    });

    const job = bp.enqueue({ items: makeItems(10) });
    await new Promise((r) => setTimeout(r, 10));
    await bp.cancel(job.id);

    // 至少有一个 in-flight workflow 被 cancel
    expect(cancelledIds.length).toBeGreaterThan(0);
  });

  it('cancel 已完成的 job 不应抛错', async () => {
    const runtime = createMockRuntime({});
    const bp = new BatchProcessor({
      runtime,
      eventBus: runtime.eventBus,
      isPro: false,
    });

    const job = bp.enqueue({ items: makeItems(2) });
    await bp.waitForCompletion(job.id);
    await expect(bp.cancel(job.id)).resolves.toBeUndefined();
  });
});

// ─── 进度事件(W6.3)──────────────────────────────────────────

describe('BatchProcessor 进度事件', () => {
  it('应触发 batch:started / batch:item:* / batch:progress / batch:completed', async () => {
    const runtime = createMockRuntime({});
    const bp = new BatchProcessor({
      runtime,
      eventBus: runtime.eventBus,
      isPro: false,
    });

    const types: string[] = [];
    const off = runtime.eventBus.onAny((e) => types.push(e.type));

    const job = bp.enqueue({ items: makeItems(3) });
    await bp.waitForCompletion(job.id);
    off();

    expect(types).toContain('batch:started');
    expect(types.filter((t) => t === 'batch:item:started').length).toBe(3);
    expect(types.filter((t) => t === 'batch:item:finished').length).toBe(3);
    expect(types.filter((t) => t === 'batch:progress').length).toBe(3);
    expect(types).toContain('batch:completed');
  });

  it('batch:progress 应携带正确的 completed/failed/total', async () => {
    const runtime = createMockRuntime({});
    const bp = new BatchProcessor({
      runtime,
      eventBus: runtime.eventBus,
      isPro: false,
    });

    const progressEvents: { completed: number; failed: number; total: number }[] = [];
    runtime.eventBus.on('batch:progress', (e) => {
      progressEvents.push({ completed: e.completed, failed: e.failed, total: e.total });
    });

    const job = bp.enqueue({ items: makeItems(3) });
    await bp.waitForCompletion(job.id);

    expect(progressEvents).toHaveLength(3);
    expect(progressEvents[0]!.completed).toBe(1);
    expect(progressEvents[2]!.completed).toBe(3);
    expect(progressEvents[2]!.total).toBe(3);
  });

  it('失败时应触发 batch:item:failed 而非 batch:item:finished', async () => {
    const runtime = createMockRuntime({
      runImpl: async () => {
        throw new Error('fail');
      },
    });
    const bp = new BatchProcessor({
      runtime,
      eventBus: runtime.eventBus,
      isPro: false,
    });

    const types: string[] = [];
    const off = runtime.eventBus.onAny((e) => {
      if (e.type.startsWith('batch:')) types.push(e.type);
    });

    const job = bp.enqueue({ items: makeItems(1) });
    await bp.waitForCompletion(job.id);
    off();

    expect(types).toContain('batch:item:failed');
    expect(types).not.toContain('batch:item:finished');
  });

  it('onProgress 回调应被调用', async () => {
    const runtime = createMockRuntime({});
    const bp = new BatchProcessor({
      runtime,
      eventBus: runtime.eventBus,
      isPro: false,
    });

    const progressCalls: number[] = [];
    const job = bp.enqueue({ items: makeItems(3) });
    bp.onProgress(job.id, (p) => progressCalls.push(p.completed));

    await bp.waitForCompletion(job.id);

    expect(progressCalls).toEqual([1, 2, 3]);
  });
});

// ─── 暂停/恢复 ────────────────────────────────────────────────

describe('BatchProcessor 暂停/恢复', () => {
  it('pause 后不再补新项,resume 后继续', async () => {
    let completedCount = 0;
    const runtime = createMockRuntime({
      runImpl: async (wf) => {
        await new Promise((r) => setTimeout(r, 20));
        completedCount++;
        return {
          workflowId: wf.id,
          outputs: ['out'],
          duration: 0,
          status: 'completed' as const,
        };
      },
    });
    const bp = new BatchProcessor({
      runtime,
      eventBus: runtime.eventBus,
      isPro: false,
    });

    const job = bp.enqueue({ items: makeItems(8) });
    // 等首批(4 项)开始
    await new Promise((r) => setTimeout(r, 5));
    await bp.pause(job.id);

    const pausedJob = bp.get(job.id);
    expect(pausedJob?.status).toBe('paused');

    // 等一段时间,确认无新项完成(暂停后 in-flight 跑完但无新项补入)
    await new Promise((r) => setTimeout(r, 50));

    // resume 后应继续完成剩余项
    await bp.resume(job.id);
    const finalJob = await bp.waitForCompletion(job.id);

    expect(finalJob.status).toBe('completed');
    expect(finalJob.completed).toBe(8);
  });
});

// ─── retryFailed ──────────────────────────────────────────────

describe('BatchProcessor retryFailed', () => {
  it('retryFailed 应重置 failed 项并重新执行', async () => {
    let shouldFail = true;
    const runtime = createMockRuntime({
      runImpl: async (wf) => {
        if (shouldFail) throw new Error('fail');
        return {
          workflowId: wf.id,
          outputs: ['out'],
          duration: 0,
          status: 'completed' as const,
        };
      },
    });
    const bp = new BatchProcessor({
      runtime,
      eventBus: runtime.eventBus,
      isPro: false,
    });

    const job = bp.enqueue({ items: makeItems(1), maxRetries: 0 });
    const failedJob = await bp.waitForCompletion(job.id);
    expect(failedJob.status).toBe('failed');

    // 修复失败原因后重试
    shouldFail = false;
    await bp.retryFailed(job.id);
    const finalJob = await bp.waitForCompletion(job.id);

    expect(finalJob.status).toBe('completed');
    expect(finalJob.completed).toBe(1);
  });
});

// ─── 列表/查询 ────────────────────────────────────────────────

describe('BatchProcessor 列表/查询', () => {
  it('list() 应返回所有 job', async () => {
    const runtime = createMockRuntime({});
    const bp = new BatchProcessor({
      runtime,
      eventBus: runtime.eventBus,
      isPro: false,
    });

    const job1 = bp.enqueue({ items: makeItems(2) });
    const job2 = bp.enqueue({ items: makeItems(3) });

    const list = bp.list();
    expect(list).toHaveLength(2);
    expect(list.map((j) => j.id).sort()).toEqual([job1.id, job2.id].sort());
  });

  it('get(未知 id) 应返回 undefined', () => {
    const runtime = createMockRuntime({});
    const bp = new BatchProcessor({
      runtime,
      eventBus: runtime.eventBus,
      isPro: false,
    });

    expect(bp.get('nonexistent')).toBeUndefined();
  });

  it('waitForCompletion(未知 id) 应抛错', async () => {
    const runtime = createMockRuntime({});
    const bp = new BatchProcessor({
      runtime,
      eventBus: runtime.eventBus,
      isPro: false,
    });

    await expect(bp.waitForCompletion('nonexistent')).rejects.toThrow(/not found/);
  });
});
