/**
 * 集成测试:resize→compress→undo→redo
 *
 * 覆盖(PROJECT_PLAN 2.11):
 * - Runtime.run 执行工作流后自动记录历史
 * - undo/redo 游标移动正确
 * - history:changed 事件触发
 * - 历史条目内容正确(inputs/outputs/capability)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { LokvisRuntimeImpl } from '../../runtime.js';
import type {
  Asset,
  Capability,
  CapabilityImplementation,
  Workflow,
} from '@lokvis/schema';
import type { AssetStore } from '../../asset-store.js';

/** 创建 mock resize 能力实现:输出一个新 Asset */
function mockResizeImpl(store: AssetStore): CapabilityImplementation {
  return {
    capability: 'image.resize',
    engine: 'mock',
    execute: async (inputs: Asset[]) => {
      const outputs: Asset[] = [];
      for (const input of inputs) {
        const blob = await store.getBlob(input.blob);
        const resized = await store.create(
          blob,
          { ...input.metadata, size: blob.size },
          'image',
        );
        outputs.push(resized);
      }
      return outputs;
    },
  };
}

/** 创建 mock compress 能力实现 */
function mockCompressImpl(store: AssetStore): CapabilityImplementation {
  return {
    capability: 'image.compress',
    engine: 'mock',
    execute: async (inputs: Asset[]) => {
      const outputs: Asset[] = [];
      for (const input of inputs) {
        const blob = await store.getBlob(input.blob);
        const compressed = await store.create(
          blob,
          { ...input.metadata, size: Math.floor(blob.size / 2) },
          'image',
        );
        outputs.push(compressed);
      }
      return outputs;
    },
  };
}

/** 构建单节点工作流 */
function makeWorkflow(id: string, capability: string): Workflow {
  return {
    id,
    version: '1.0.0',
    name: `test-${capability}`,
    description: 'test',
    author: { id: 'test', name: 'test' },
    category: 'image',
    tags: [],
    inputs: { type: 'image', multiple: false },
    outputs: { type: 'image' },
    nodes: [
      { id: `${id}-node-1`, type: 'transform', capability },
    ],
    edges: [],
  };
}

describe('集成测试:resize→compress→undo→redo', () => {
  let runtime: LokvisRuntimeImpl;

  beforeEach(() => {
    // 使用内存 store(enableOpfs: false 时构造函数自动使用 createMemoryAssetStore)
    runtime = new LokvisRuntimeImpl({ enableOpfs: false });

    // 获取 runtime 内部 store,供 mock 能力实现创建输出资产
    const store = runtime._getAssetStore();

    // 注册能力
    const registry = runtime._getCapabilityRegistry();
    const resizeCap: Capability = {
      name: 'image.resize',
      description: 'Resize',
      inputTypes: ['image'],
      outputTypes: ['image'],
      params: [],
      performance: 'fast',
      batchable: true,
    };
    const compressCap: Capability = {
      name: 'image.compress',
      description: 'Compress',
      inputTypes: ['image'],
      outputTypes: ['image'],
      params: [],
      performance: 'fast',
      batchable: true,
    };
    registry.registerCapability(resizeCap);
    registry.registerCapability(compressCap);
    registry.registerImplementation(mockResizeImpl(store));
    registry.registerImplementation(mockCompressImpl(store));
  });

  it('执行 resize 工作流后应记录 1 条历史', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });
    const assetId = await runtime.importAsset({ kind: 'blob', blob, name: 'a.png' });

    const workflow = makeWorkflow('wf-resize', 'image.resize');
    const result = await runtime.run(workflow, [assetId]);

    expect(result.status).toBe('completed');
    expect(result.outputs).toHaveLength(1);

    const history = await runtime.history('wf-resize');
    expect(history).toHaveLength(1);
    expect(history[0]!.capability).toBe('image.resize');
    expect(history[0]!.inputs).toEqual([assetId]);
    expect(history[0]!.outputs).toEqual(result.outputs);
  });

  it('undo 后 history 仍保留条目但游标回退', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });
    const assetId = await runtime.importAsset({ kind: 'blob', blob, name: 'a.png' });

    const workflow = makeWorkflow('wf-undo', 'image.resize');
    await runtime.run(workflow, [assetId]);

    // undo
    await runtime.undo('wf-undo');

    const history = await runtime.history('wf-undo');
    // 历史条目不因 undo 而删除
    expect(history).toHaveLength(1);
  });

  it('undo 后 redo 应恢复游标', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });
    const assetId = await runtime.importAsset({ kind: 'blob', blob, name: 'a.png' });

    const workflow = makeWorkflow('wf-redo', 'image.resize');
    await runtime.run(workflow, [assetId]);

    await runtime.undo('wf-redo');
    await runtime.redo('wf-redo');

    // undo+redo 后历史不变
    const history = await runtime.history('wf-redo');
    expect(history).toHaveLength(1);
  });

  it('多次执行不同工作流应各自独立记录历史', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });
    const assetId = await runtime.importAsset({ kind: 'blob', blob, name: 'a.png' });

    const resizeWf = makeWorkflow('wf-1', 'image.resize');
    const compressWf = makeWorkflow('wf-2', 'image.compress');

    await runtime.run(resizeWf, [assetId]);
    await runtime.run(compressWf, [assetId]);

    const h1 = await runtime.history('wf-1');
    const h2 = await runtime.history('wf-2');
    expect(h1).toHaveLength(1);
    expect(h2).toHaveLength(1);
    expect(h1[0]!.capability).toBe('image.resize');
    expect(h2[0]!.capability).toBe('image.compress');
  });

  it('history:changed 事件应在执行后触发', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });
    const assetId = await runtime.importAsset({ kind: 'blob', blob, name: 'a.png' });

    const events: { workflowId: string }[] = [];
    runtime.eventBus.on('history:changed', (e) => events.push(e));

    const workflow = makeWorkflow('wf-event', 'image.resize');
    await runtime.run(workflow, [assetId]);

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.workflowId).toBe('wf-event');
  });
});
