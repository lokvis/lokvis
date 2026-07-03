/**
 * 集成测试:50+ 图片批量 resize 不 OOM(PROJECT_PLAN W6.9)
 *
 * 验证完整链路:
 *   BatchProcessor.enqueue(50 项) → 并发槽位池调度(free=4 / pro=16) →
 *   每项 importAsset → run(resize workflow) → 产出 output AssetId →
 *   MemoryGuard 压力上升 → 并发槽位动态收缩 → 全部完成不丢项
 *
 * 关键不变量(对应 whitepaper T1「浏览器 OOM ★★★★★」):
 *  - 并发上限永不突破 cap(否则 50 个 decode 同时进行会瞬间 OOM)
 *  - MemoryGuard 进入 high/critical 时并发应自动收缩(测试通过 _getMemoryGuard
 *    注入 tracked 字节模拟压力,无需真实大图)
 *  - 每项 output 仅存 AssetId,Blob 由 AssetStore 托管(BatchProcessor 注释
 *    "不持有 output Blob" 的契约验证)
 *  - 全部 50 项 completed,无 failed/丢失
 *  - 进度事件序列正确(started → item:* → progress → completed)
 *
 * 使用 fake image.resize 实现(参考 undo-redo.test.ts 的 makeFakeImpl),
 * 因 Node 环境无真实图像引擎;本测试聚焦批量调度与内存治理,不验证像素正确性。
 * fake impl 模仿真实 plugin-image 行为:通过 assetStore.create 把输出 Blob
 * 存为 Asset(确保 output 真正进入 store,而非仅返回内存对象)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LokvisRuntimeImpl } from '../../runtime.js';
import { createMemoryAssetStore } from '../../asset-store.js';
import {
  FREE_CONCURRENCY,
  PRO_CONCURRENCY,
  BatchLimitExceededError,
} from '../../batch-processor.js';
import type {
  AssetMetadata,
  Capability,
  CapabilityImplementation,
  LokvisEvent,
  Workflow,
} from '@lokvis/schema';

/** 构造单节点 resize workflow(每个 item 用同一模板,BatchProcessor 内部 clone id) */
function buildResizeWorkflow(): Workflow {
  return {
    id: 'wf-batch-resize',
    version: '1.0.0',
    name: 'batch-resize',
    description: '集成测试用',
    author: { id: 'a', name: 'tester' },
    category: 'image',
    tags: [],
    nodes: [
      {
        id: 'n-resize',
        type: 'transform',
        capability: 'image.resize',
        params: { width: 200, height: 200 },
      },
    ],
    edges: [],
    inputs: { type: 'image', multiple: true },
    outputs: { type: 'image', format: 'png' },
  };
}

/**
 * fake resize 实现:产出新 Asset,模拟一定耗时便于并发观测。
 * 模仿真实 plugin-image:通过 assetStore.create 把输出 Blob 存为 Asset,
 * 确保后续 getAsset / listAssets 能取回(验证 BatchProcessor 不持有 Blob 契约)。
 */
function makeResizeImpl(
  runtime: LokvisRuntimeImpl
): CapabilityImplementation & {
  active: number;
  maxActive: number;
} {
  const state = { active: 0, maxActive: 0 };
  return {
    capability: 'image.resize',
    engine: 'fake',
    async execute() {
      state.active++;
      state.maxActive = Math.max(state.maxActive, state.active);
      // 模拟 decode + resize 耗时,让并发可观测
      await new Promise((r) => setTimeout(r, 10));
      state.active--;
      // 模仿真实 plugin:把输出 Blob 存进 AssetStore(executor 只取 id,
      // Blob 由 store 托管;后续 getAsset / listAssets 可取回)
      const outBlob = new Blob([new Uint8Array([1])], { type: 'image/png' });
      const metadata: AssetMetadata = {
        mimeType: 'image/png',
        size: outBlob.size,
        format: 'png',
        dimensions: { width: 200, height: 200 },
      };
      const outAsset = await runtime._getAssetStore().create(
        outBlob,
        metadata,
        'image'
      );
      return [outAsset];
    },
    get active() {
      return state.active;
    },
    get maxActive() {
      return state.maxActive;
    },
  };
}

function makeCapabilityDecl(): Capability {
  return {
    name: 'image.resize',
    description: 'fake resize',
    inputTypes: ['image'],
    outputTypes: ['image'],
    params: [],
    performance: 'fast',
  };
}

/** 构造 Pro runtime(无 10 项上限,16 并发) */
function makeProRuntime() {
  const runtime = new LokvisRuntimeImpl({
    assetStore: createMemoryAssetStore(),
    isPro: true,
    // 用小预算便于测试 MemoryGuard 压力触发
    memoryBudget: 100 * 1024 * 1024, // 100MB
  });
  const reg = runtime._getCapabilityRegistry();
  reg.registerCapability(makeCapabilityDecl());
  const impl = makeResizeImpl(runtime);
  reg.registerImplementation(impl);
  return { runtime, impl };
}

/** 构造 Free runtime(10 项上限,4 并发) */
function makeFreeRuntime() {
  const runtime = new LokvisRuntimeImpl({
    assetStore: createMemoryAssetStore(),
    isPro: false,
    memoryBudget: 100 * 1024 * 1024,
  });
  const reg = runtime._getCapabilityRegistry();
  reg.registerCapability(makeCapabilityDecl());
  const impl = makeResizeImpl(runtime);
  reg.registerImplementation(impl);
  return { runtime, impl };
}

/** 构造 N 个 fake image 文件作为批量输入 */
function makeImageFiles(count: number): File[] {
  return Array.from({ length: count }, (_, i) =>
    new File([new Uint8Array([i % 256])], `img-${i}.png`, { type: 'image/png' })
  );
}

describe('集成:50+ 图片批量 resize 不 OOM (W6.9)', () => {
  let workflow: Workflow;

  beforeEach(() => {
    workflow = buildResizeWorkflow();
  });

  it('Pro 模式:50 项批量应全部完成,无丢失,无 failed', async () => {
    const { runtime } = makeProRuntime();
    const files = makeImageFiles(50);

    const job = runtime.batch.enqueue({
      items: files.map((file) => ({
        source: { kind: 'file', file },
        workflow,
      })),
    });

    const finalJob = await runtime.batch.waitForCompletion(job.id);

    expect(finalJob.status).toBe('completed');
    expect(finalJob.total).toBe(50);
    expect(finalJob.completed).toBe(50);
    expect(finalJob.failed).toBe(0);
    expect(finalJob.items).toHaveLength(50);
    // 每项应有 outputAssetId
    for (const item of finalJob.items) {
      expect(item.status).toBe('completed');
      expect(item.outputAssetId).toBeTruthy();
    }
  });

  it('Pro 模式:并发永不突破 PRO_CONCURRENCY(16)上限', async () => {
    const { runtime, impl } = makeProRuntime();
    const files = makeImageFiles(50);

    const job = runtime.batch.enqueue({
      items: files.map((file) => ({
        source: { kind: 'file', file },
        workflow,
      })),
    });

    await runtime.batch.waitForCompletion(job.id);

    // 关键不变量:实际并发峰值绝不超过配置上限
    expect(impl.maxActive).toBeLessThanOrEqual(PRO_CONCURRENCY);
    expect(impl.maxActive).toBeGreaterThan(1); // 确实并发了,非串行
  });

  it('Free 模式:并发永不突破 FREE_CONCURRENCY(4)上限', async () => {
    const { runtime, impl } = makeFreeRuntime();
    // Free 上限 10 项,用 10 项填满
    const files = makeImageFiles(10);

    const job = runtime.batch.enqueue({
      items: files.map((file) => ({
        source: { kind: 'file', file },
        workflow,
      })),
    });

    await runtime.batch.waitForCompletion(job.id);

    expect(impl.maxActive).toBeLessThanOrEqual(FREE_CONCURRENCY);
    expect(impl.maxActive).toBeGreaterThan(1);
  });

  it('Free 模式:超过 10 项应抛 BatchLimitExceededError,不创建 job', () => {
    const { runtime } = makeFreeRuntime();
    const files = makeImageFiles(11);

    expect(() =>
      runtime.batch.enqueue({
        items: files.map((file) => ({
          source: { kind: 'file', file },
          workflow,
        })),
      })
    ).toThrow(BatchLimitExceededError);

    // 错误应携带 limit + requested 供 UI 提示
    try {
      runtime.batch.enqueue({
        items: files.map((file) => ({
          source: { kind: 'file', file },
          workflow,
        })),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BatchLimitExceededError);
      const e = err as BatchLimitExceededError;
      expect(e.limit).toBe(10);
      expect(e.requested).toBe(11);
    }

    // 不应创建任何 job
    expect(runtime.batch.list()).toHaveLength(0);
  });

  it('MemoryGuard high 压力下并发应收缩到 ≤ base/2', async () => {
    const { runtime, impl } = makeProRuntime();
    const guard = runtime._getMemoryGuard();
    const files = makeImageFiles(20);

    // 预先登记 85MB(100MB 预算的 85%)→ high 区间(80-95%)
    const alloc = guard.track(85 * 1024 * 1024);
    expect(guard.getPressure()).toBe('high');

    const job = runtime.batch.enqueue({
      items: files.map((file) => ({
        source: { kind: 'file', file },
        workflow,
      })),
    });
    const finalJob = await runtime.batch.waitForCompletion(job.id);

    // high 压力:shrinkConcurrencyByPressure(16, 'high') = max(1, 8) = 8
    expect(impl.maxActive).toBeLessThanOrEqual(8);
    expect(finalJob.status).toBe('completed');
    expect(finalJob.completed).toBe(20);

    alloc.release();
  });

  it('MemoryGuard critical 压力下并发应收缩到 1', async () => {
    const { runtime, impl } = makeProRuntime();
    const guard = runtime._getMemoryGuard();
    const files = makeImageFiles(10);

    // 96MB / 100MB = 96% → critical
    const alloc = guard.track(96 * 1024 * 1024);
    expect(guard.getPressure()).toBe('critical');

    const job = runtime.batch.enqueue({
      items: files.map((file) => ({
        source: { kind: 'file', file },
        workflow,
      })),
    });
    const finalJob = await runtime.batch.waitForCompletion(job.id);

    // critical: shrinkConcurrencyByPressure(16, 'critical') = 1
    expect(impl.maxActive).toBeLessThanOrEqual(1);
    expect(finalJob.status).toBe('completed');
    expect(finalJob.completed).toBe(10);

    alloc.release();
  });

  it('每项 output AssetId 应可从 AssetStore 取回(不持有 Blob 契约)', async () => {
    const { runtime } = makeProRuntime();
    const files = makeImageFiles(15);

    const job = runtime.batch.enqueue({
      items: files.map((file) => ({
        source: { kind: 'file', file },
        workflow,
      })),
    });

    const finalJob = await runtime.batch.waitForCompletion(job.id);

    // 每项 outputAssetId 都应能 getAsset 取回(Blob 由 store 托管,非内存临时对象)
    for (const item of finalJob.items) {
      const asset = await runtime.getAsset(item.outputAssetId!);
      expect(asset).toBeDefined();
      expect(asset.type).toBe('image');
      expect(asset.metadata.format).toBe('png');
      expect(asset.metadata.dimensions).toEqual({ width: 200, height: 200 });
    }
  });

  it('完整进度事件序列:started → (item:started/finished)* → completed', async () => {
    const { runtime } = makeProRuntime();
    const files = makeImageFiles(8);
    const events: string[] = [];

    runtime.eventBus.on('batch:started', () => events.push('started'));
    runtime.eventBus.on('batch:item:started', () => events.push('item:started'));
    runtime.eventBus.on('batch:item:finished', () => events.push('item:finished'));
    runtime.eventBus.on('batch:progress', () => events.push('progress'));
    runtime.eventBus.on('batch:completed', () => events.push('completed'));

    const job = runtime.batch.enqueue({
      items: files.map((file) => ({
        source: { kind: 'file', file },
        workflow,
      })),
    });

    await runtime.batch.waitForCompletion(job.id);

    // 序列断言
    expect(events[0]).toBe('started');
    expect(events[events.length - 1]).toBe('completed');
    // started 与 completed 之间应至少有 8 个 item:started + 8 个 item:finished
    const itemStartedCount = events.filter((e) => e === 'item:started').length;
    const itemFinishedCount = events.filter((e) => e === 'item:finished').length;
    expect(itemStartedCount).toBe(8);
    expect(itemFinishedCount).toBe(8);
  });

  it('progress 事件载荷应单调递增(completed 累加)', async () => {
    const { runtime } = makeProRuntime();
    const files = makeImageFiles(12);
    const progresses: { completed: number; failed: number; total: number }[] = [];

    runtime.eventBus.on('batch:progress', (e: LokvisEvent) => {
      if (e.type === 'batch:progress') {
        progresses.push({
          completed: e.completed,
          failed: e.failed,
          total: e.total,
        });
      }
    });

    const job = runtime.batch.enqueue({
      items: files.map((file) => ({
        source: { kind: 'file', file },
        workflow,
      })),
    });

    await runtime.batch.waitForCompletion(job.id);

    expect(progresses.length).toBe(12); // 每项完成发一次 progress
    expect(progresses[0]!.completed).toBe(1);
    expect(progresses.at(-1)!.completed).toBe(12);
    expect(progresses.at(-1)!.total).toBe(12);
    expect(progresses.at(-1)!.failed).toBe(0);
    // 单调递增
    for (let i = 1; i < progresses.length; i++) {
      expect(progresses[i]!.completed).toBeGreaterThanOrEqual(
        progresses[i - 1]!.completed
      );
    }
  });

  it('批量完成后 AssetStore 应包含全部 output 资产(无 OOM 丢失)', async () => {
    const { runtime } = makeProRuntime();
    const files = makeImageFiles(20);

    const job = runtime.batch.enqueue({
      items: files.map((file) => ({
        source: { kind: 'file', file },
        workflow,
      })),
    });

    const finalJob = await runtime.batch.waitForCompletion(job.id);

    // listAssets 应包含全部 20 个 output(由 fake impl 通过 store.create 存入)。
    // 用 outputAssetId 集合与 listAssets 的 id 集合求交集,避免与 import 输入混淆。
    const allAssets = await runtime.listAssets();
    const allIds = new Set(allAssets.map((a) => a.id));
    const outputIds = finalJob.items.map((i) => i.outputAssetId!);
    for (const id of outputIds) {
      expect(allIds.has(id)).toBe(true);
    }
    expect(finalJob.completed).toBe(20);
  });

  it('onProgress 回调应被调用且最终 completed == total', async () => {
    const { runtime } = makeProRuntime();
    const files = makeImageFiles(10);
    const cb = vi.fn();

    const job = runtime.batch.enqueue({
      items: files.map((file) => ({
        source: { kind: 'file', file },
        workflow,
      })),
    });
    const off = runtime.batch.onProgress(job.id, cb);

    await runtime.batch.waitForCompletion(job.id);
    off();

    expect(cb).toHaveBeenCalled();
    const last = cb.mock.calls.at(-1)![0];
    expect(last.completed).toBe(10);
    expect(last.total).toBe(10);
    expect(last.failed).toBe(0);
  });

  it('部分项失败时 job 应标 failed,但其余项继续完成(隔离)', async () => {
    // 注入一个会偶发失败的 impl:第 3 项抛错,其余成功
    const runtime = new LokvisRuntimeImpl({
      assetStore: createMemoryAssetStore(),
      isPro: true,
    });
    const reg = runtime._getCapabilityRegistry();
    reg.registerCapability(makeCapabilityDecl());
    let callCount = 0;
    reg.registerImplementation({
      capability: 'image.resize',
      engine: 'fake',
      async execute() {
        callCount++;
        if (callCount === 3) {
          throw new Error('simulated failure on 3rd item');
        }
        // 模仿真实 plugin:存 output
        const outBlob = new Blob([new Uint8Array([1])], { type: 'image/png' });
        const outAsset = await runtime._getAssetStore().create(
          outBlob,
          { mimeType: 'image/png', size: 1, format: 'png' },
          'image'
        );
        return [outAsset];
      },
    });

    const files = makeImageFiles(6);
    const job = runtime.batch.enqueue({
      items: files.map((file) => ({
        source: { kind: 'file', file },
        workflow,
      })),
      maxRetries: 0, // 不重试,直接失败
    });

    const finalJob = await runtime.batch.waitForCompletion(job.id);

    // 5 成功 + 1 失败,job 整体 failed(因有 failed > 0)
    expect(finalJob.completed).toBe(5);
    expect(finalJob.failed).toBe(1);
    expect(finalJob.status).toBe('failed');
    const failedItem = finalJob.items.find((i) => i.status === 'failed');
    expect(failedItem).toBeDefined();
    expect(failedItem!.error?.message).toMatch(/simulated failure/);
  });

  it('大并发批量(100 项)应稳定完成,验证不 OOM 韧性', async () => {
    const { runtime, impl } = makeProRuntime();
    const files = makeImageFiles(100);

    const job = runtime.batch.enqueue({
      items: files.map((file) => ({
        source: { kind: 'file', file },
        workflow,
      })),
    });

    const finalJob = await runtime.batch.waitForCompletion(job.id);

    expect(finalJob.status).toBe('completed');
    expect(finalJob.completed).toBe(100);
    expect(finalJob.failed).toBe(0);
    // 并发仍受 PRO_CONCURRENCY 约束
    expect(impl.maxActive).toBeLessThanOrEqual(PRO_CONCURRENCY);
  });
});
