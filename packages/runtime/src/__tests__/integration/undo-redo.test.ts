/**
 * 集成测试:resize → compress → undo → redo(PROJECT_PLAN W2.11)
 *
 * 验证完整链路:
 *   Runtime.run() → executor 触发 node:finished → HistoryStack 自动记录
 *   → Runtime.undo()/redo() 切换 currentOutputs → 发射 history:changed 事件
 *
 * 使用注入的 fake capability 实现(避免依赖真实图像引擎),
 * 在 Node 环境运行(plan 原文 "vitest browser" 指语义;Node 足以覆盖逻辑)。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { LokvisRuntimeImpl, QuotaExceededError } from '../../runtime.js';
import { createMemoryAssetStore } from '../../asset-store.js';
import type {
  Asset,
  Capability,
  CapabilityImplementation,
} from '@lokvis/schema';
import type { Workflow } from '@lokvis/schema';

const WF_ID = 'wf-undo-redo';

/** 构造 resize → compress 线性 workflow */
function buildWorkflow(): Workflow {
  return {
    id: WF_ID,
    version: '1.0.0',
    name: 'resize-then-compress',
    description: 'test',
    author: { id: 'a', name: 'tester' },
    category: 'image',
    tags: [],
    nodes: [
      { id: 'n-resize', type: 'transform', capability: 'image.resize', params: { width: 100 } },
      { id: 'n-compress', type: 'transform', capability: 'image.compress', params: { quality: 80 } },
    ],
    edges: [
      { from: 'n-resize', to: 'n-compress' },
    ],
    inputs: { type: 'image', multiple: false },
    outputs: { type: 'image', format: 'png' },
  };
}

/** 构造一个 fake 能力实现:产出新 Asset(标记 metadata.dimensions) */
function makeFakeImpl(
  capability: string,
  marker: string
): CapabilityImplementation {
  return {
    capability,
    engine: 'fake',
    execute: async () => {
      // 直接构造 Asset 数组返回(用 marker 区分每步输出;executor 不会回查 store)
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

/** 构造已注册 fake 能力的 Runtime */
function makeRuntime() {
  const runtime = new LokvisRuntimeImpl({
    assetStore: createMemoryAssetStore(),
    storageQuota: 1024 * 1024, // 1MB 配额用于测试 quota
  });
  const reg = runtime._getCapabilityRegistry();
  reg.registerCapability(makeCapabilityDecl('image.resize'));
  reg.registerCapability(makeCapabilityDecl('image.compress'));
  reg.registerImplementation(makeFakeImpl('image.resize', 'resized'));
  reg.registerImplementation(makeFakeImpl('image.compress', 'compressed'));
  return runtime;
}

describe('集成:resize → compress → undo → redo', () => {
  let runtime: LokvisRuntimeImpl;

  beforeEach(() => {
    runtime = makeRuntime();
  });

  it('run 完成后应产生 2 条历史', async () => {
    const wf = buildWorkflow();
    const inputAsset: Asset = {
      id: 'asset-input',
      type: 'image',
      metadata: { mimeType: 'image/png', size: 1, format: 'png' },
      blob: { path: 'memory://asset-input', size: 1, mimeType: 'image/png' },
      history: [],
      tags: [],
      createdAt: 0,
      updatedAt: 0,
    };

    const result = await runtime.run(wf, [inputAsset]);
    expect(result.status).toBe('completed');
    expect(result.outputs).toEqual(['asset-compressed']);

    const history = await runtime.history(WF_ID);
    expect(history).toHaveLength(2);
    expect(history[0]!.capability).toBe('image.resize');
    expect(history[0]!.outputs).toEqual(['asset-resized']);
    expect(history[1]!.capability).toBe('image.compress');
    expect(history[1]!.outputs).toEqual(['asset-compressed']);
  });

  it('undo 一次回到 resize 输出,再 undo 回到初始输入', async () => {
    const wf = buildWorkflow();
    const inputAsset: Asset = {
      id: 'asset-input',
      type: 'image',
      metadata: { mimeType: 'image/png', size: 1, format: 'png' },
      blob: { path: 'memory://asset-input', size: 1, mimeType: 'image/png' },
      history: [],
      tags: [],
      createdAt: 0,
      updatedAt: 0,
    };
    await runtime.run(wf, [inputAsset]);

    // undo 1:回到 resize 输出
    await runtime.undo(WF_ID);
    expect(runtime._getCurrentOutputs(WF_ID)).toEqual(['asset-resized']);

    // undo 2:回到初始输入
    await runtime.undo(WF_ID);
    expect(runtime._getCurrentOutputs(WF_ID)).toEqual(['asset-input']);
  });

  it('redo 重做到 compress 输出', async () => {
    const wf = buildWorkflow();
    const inputAsset: Asset = {
      id: 'asset-input',
      type: 'image',
      metadata: { mimeType: 'image/png', size: 1, format: 'png' },
      blob: { path: 'memory://asset-input', size: 1, mimeType: 'image/png' },
      history: [],
      tags: [],
      createdAt: 0,
      updatedAt: 0,
    };
    await runtime.run(wf, [inputAsset]);
    await runtime.undo(WF_ID);
    await runtime.undo(WF_ID);

    await runtime.redo(WF_ID);
    expect(runtime._getCurrentOutputs(WF_ID)).toEqual(['asset-resized']);
    await runtime.redo(WF_ID);
    expect(runtime._getCurrentOutputs(WF_ID)).toEqual(['asset-compressed']);
  });

  it('undo 后新增操作应截断 redo 分支', async () => {
    const wf = buildWorkflow();
    const inputAsset: Asset = {
      id: 'asset-input',
      type: 'image',
      metadata: { mimeType: 'image/png', size: 1, format: 'png' },
      blob: { path: 'memory://asset-input', size: 1, mimeType: 'image/png' },
      history: [],
      tags: [],
      createdAt: 0,
      updatedAt: 0,
    };
    await runtime.run(wf, [inputAsset]);
    await runtime.undo(WF_ID); // 回到 resize

    // 再跑一次相同 workflow(产生新 history)→ 应截断原 compress 分支
    await runtime.run(wf, [inputAsset]);
    const history = await runtime.history(WF_ID);
    // 第一次 run:2 条(resize+compress),undo 到 resize,再 run 又 2 条
    // 但 redo 分支被截断后,历史应为 [resize(old), resize(new), compress(new)]
    // 注意:append 截断的是 cursor 之后的 redo 分支
    expect(history.length).toBe(3);
    expect(history.at(-1)!.outputs).toEqual(['asset-compressed']);
  });

  it('history:changed 事件应在 undo/redo 时发射', async () => {
    const wf = buildWorkflow();
    const inputAsset: Asset = {
      id: 'asset-input',
      type: 'image',
      metadata: { mimeType: 'image/png', size: 1, format: 'png' },
      blob: { path: 'memory://asset-input', size: 1, mimeType: 'image/png' },
      history: [],
      tags: [],
      createdAt: 0,
      updatedAt: 0,
    };
    await runtime.run(wf, [inputAsset]);

    const changedEvents: { workflowId: string; entries: unknown[] }[] = [];
    runtime.eventBus.on('history:changed', (e) =>
      changedEvents.push({ workflowId: e.workflowId, entries: e.entries })
    );

    await runtime.undo(WF_ID);
    await runtime.redo(WF_ID);

    // undo + redo 各触发一次 onChanged(单发,避免双发语义错误)
    expect(changedEvents.length).toBe(2);
    expect(changedEvents[0]!.workflowId).toBe(WF_ID);
  });
});

describe('集成:Runtime storageQuota 校验(W2.9)', () => {
  it('导入超过配额应抛 QuotaExceededError', async () => {
    const runtime = new LokvisRuntimeImpl({
      assetStore: createMemoryAssetStore(),
      storageQuota: 10, // 10 字节配额
    });
    const big = new Blob([new Uint8Array(20)], { type: 'image/png' });
    await expect(
      runtime.importAsset({ kind: 'blob', blob: big, name: 'big.png' })
    ).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it('配额内导入应成功,累计超限后抛错', async () => {
    const runtime = new LokvisRuntimeImpl({
      assetStore: createMemoryAssetStore(),
      storageQuota: 15, // 15 字节
    });
    // 第一次 8 字节,成功
    await runtime.importAsset({
      kind: 'blob',
      blob: new Blob([new Uint8Array(8)], { type: 'image/png' }),
      name: 'a.png',
    });
    // 第二次 8 字节,累计 16 > 15,应抛
    await expect(
      runtime.importAsset({
        kind: 'blob',
        blob: new Blob([new Uint8Array(8)], { type: 'image/png' }),
        name: 'b.png',
      })
    ).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it('remove 后释放配额可再次导入', async () => {
    const runtime = new LokvisRuntimeImpl({
      assetStore: createMemoryAssetStore(),
      storageQuota: 10,
    });
    const id = await runtime.importAsset({
      kind: 'blob',
      blob: new Blob([new Uint8Array(8)], { type: 'image/png' }),
      name: 'a.png',
    });
    await runtime.removeAsset(id);
    // 移除后配额释放,可再导入
    const id2 = await runtime.importAsset({
      kind: 'blob',
      blob: new Blob([new Uint8Array(8)], { type: 'image/png' }),
      name: 'b.png',
    });
    expect(id2).toBeTruthy();
  });

  it('并发导入应串行化校验,超限操作必须抛 QuotaExceededError', async () => {
    // D1 修复验证:两个并发 import 各 8 字节,配额 10 字节
    // 串行化后第二个必须基于第一个已更新的 usage(=8)校验 → 8+8>10 抛错
    const runtime = new LokvisRuntimeImpl({
      assetStore: createMemoryAssetStore(),
      storageQuota: 10,
    });
    const blob = () => new Blob([new Uint8Array(8)], { type: 'image/png' });
    // 并发发起两个 import(Promise.all 不 await 单独)
    const p1 = runtime.importAsset({ kind: 'blob', blob: blob(), name: 'a.png' });
    const p2 = runtime.importAsset({ kind: 'blob', blob: blob(), name: 'b.png' });
    const results = await Promise.allSettled([p1, p2]);
    // 恰好一个成功、一个因超限失败
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      QuotaExceededError
    );
  });
});
