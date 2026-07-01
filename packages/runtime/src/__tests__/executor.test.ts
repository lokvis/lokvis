/**
 * WorkflowExecutor 单元测试(T3 + T4)
 *
 * T3:pause/resume/cancel 控制流(Promise resolver 唤醒模式,无轮询)
 * T4:错误路径(无 capability / 无实现 / 执行抛错 / 输入缺失 / 环 / 事件发射)
 */
import { describe, it, expect } from 'vitest';
import type {
  Asset,
  Capability,
  CapabilityImplementation,
  LokvisEvent,
  Workflow,
} from '@lokvis/schema';
import { WorkflowExecutor } from '../executor.js';
import { createMemoryAssetStore } from '../asset-store.js';
import { CapabilityRegistry } from '../capability-registry.js';
import { createEventBus } from '../event-bus.js';

const WF_ID = 'wf-exec';

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

function makeFakeImpl(
  capability: string,
  marker: string
): CapabilityImplementation {
  return {
    capability,
    engine: 'fake',
    execute: async () => [makeAsset(`asset-${marker}`)],
  };
}

function buildWorkflow(
  nodes: Workflow['nodes'],
  edges: Workflow['edges']
): Workflow {
  return {
    id: WF_ID,
    version: '1.0.0',
    name: 'exec-test',
    description: 'test',
    author: { id: 'a', name: 'tester' },
    category: 'image',
    tags: [],
    nodes,
    edges,
    inputs: { type: 'image', multiple: false },
    outputs: { type: 'image', format: 'png' },
  };
}

interface Setup {
  executor: WorkflowExecutor;
  registry: CapabilityRegistry;
  eventBus: ReturnType<typeof createEventBus>;
  events: LokvisEvent[];
}

function makeSetup(): Setup {
  const assetStore = createMemoryAssetStore();
  const registry = new CapabilityRegistry('first');
  const eventBus = createEventBus();
  const events: LokvisEvent[] = [];
  eventBus.onAny((e) => events.push(e));
  const executor = new WorkflowExecutor({
    assetStore,
    capabilityRegistry: registry,
    eventBus,
    enableLog: false,
  });
  return { executor, registry, eventBus, events };
}

/** 构造 a→b 线性工作流的节点与边 */
const LINEAR_NODES: Workflow['nodes'] = [
  { id: 'n-a', type: 'transform', capability: 'cap.a', params: {} },
  { id: 'n-b', type: 'transform', capability: 'cap.b', params: {} },
];
const LINEAR_EDGES: Workflow['edges'] = [{ from: 'n-a', to: 'n-b' }];

describe('WorkflowExecutor:pause/resume/cancel(T3)', () => {
  it('pause 在节点间挂起,resume 后继续执行后续节点', async () => {
    const { executor, registry } = makeSetup();
    registry.registerCapability(makeCapabilityDecl('cap.a'));
    registry.registerCapability(makeCapabilityDecl('cap.b'));

    let resolveNodeADone!: () => void;
    const nodeADone = new Promise<void>((r) => {
      resolveNodeADone = r;
    });
    let nodeBExecuted = false;

    // node a 执行完成后请求 pause,下一轮循环将挂起在 waitForResume
    registry.registerImplementation({
      capability: 'cap.a',
      engine: 'fake',
      execute: async () => {
        await executor.pause(WF_ID);
        resolveNodeADone();
        return [makeAsset('out-a')];
      },
    });
    registry.registerImplementation({
      capability: 'cap.b',
      engine: 'fake',
      execute: async () => {
        nodeBExecuted = true;
        return [makeAsset('out-b')];
      },
    });

    const execPromise = executor.execute(
      buildWorkflow(LINEAR_NODES, LINEAR_EDGES),
      [makeAsset('in')]
    );
    await nodeADone;
    // node a 已执行并触发 pause;node b 因 waitForResume 挂起而未执行
    expect(nodeBExecuted).toBe(false);

    await executor.resume(WF_ID);
    const result = await execPromise;
    expect(result.status).toBe('completed');
    expect(result.outputs).toEqual(['out-b']);
    expect(nodeBExecuted).toBe(true);
  });

  it('cancel 在暂停期间唤醒并跳出,后续节点不执行', async () => {
    const { executor, registry, events } = makeSetup();
    registry.registerCapability(makeCapabilityDecl('cap.a'));
    registry.registerCapability(makeCapabilityDecl('cap.b'));

    let resolveNodeADone!: () => void;
    const nodeADone = new Promise<void>((r) => {
      resolveNodeADone = r;
    });
    let nodeBExecuted = false;

    registry.registerImplementation({
      capability: 'cap.a',
      engine: 'fake',
      execute: async () => {
        await executor.pause(WF_ID);
        resolveNodeADone();
        return [makeAsset('out-a')];
      },
    });
    registry.registerImplementation({
      capability: 'cap.b',
      engine: 'fake',
      execute: async () => {
        nodeBExecuted = true;
        return [makeAsset('out-b')];
      },
    });

    const execPromise = executor.execute(
      buildWorkflow(LINEAR_NODES, LINEAR_EDGES),
      [makeAsset('in')]
    );
    await nodeADone;

    await executor.cancel(WF_ID);
    const result = await execPromise;
    expect(result.status).toBe('cancelled');
    // 取消后保留最后一步成功输出(node a),node b 未执行
    expect(result.outputs).toEqual(['out-a']);
    expect(nodeBExecuted).toBe(false);
    expect(events.some((e) => e.type === 'workflow:cancelled')).toBe(true);
  });

  it('cancel 未运行的工作流为无操作', async () => {
    const { executor, events } = makeSetup();
    await expect(executor.cancel('nonexistent')).resolves.toBeUndefined();
    expect(events.some((e) => e.type === 'workflow:cancelled')).toBe(false);
  });

  it('pause 未运行的工作流为无操作', async () => {
    const { executor, events } = makeSetup();
    await expect(executor.pause('nonexistent')).resolves.toBeUndefined();
    expect(events.some((e) => e.type === 'workflow:paused')).toBe(false);
  });

  it('resume 未暂停的工作流为无操作', async () => {
    const { executor, events } = makeSetup();
    await expect(executor.resume('nonexistent')).resolves.toBeUndefined();
    expect(events.some((e) => e.type === 'workflow:resumed')).toBe(false);
  });
});

describe('WorkflowExecutor:错误路径(T4)', () => {
  it('transform 节点无 capability 应返回 failed 结果', async () => {
    const { executor } = makeSetup();
    const wf = buildWorkflow(
      [{ id: 'n-a', type: 'transform', params: {} }],
      []
    );
    const result = await executor.execute(wf, [makeAsset('in')]);
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/no capability/i);
  });

  it('capability 无实现应返回 failed 结果', async () => {
    const { executor, registry } = makeSetup();
    registry.registerCapability(makeCapabilityDecl('cap.a')); // 仅声明,无实现
    const wf = buildWorkflow(
      [{ id: 'n-a', type: 'transform', capability: 'cap.a', params: {} }],
      []
    );
    const result = await executor.execute(wf, [makeAsset('in')]);
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/No implementation/i);
  });

  it('能力执行抛错应返回 failed 结果并保留 error message,同时发射 node:failed 与 workflow:completed', async () => {
    const { executor, registry, events } = makeSetup();
    registry.registerCapability(makeCapabilityDecl('cap.a'));
    registry.registerImplementation({
      capability: 'cap.a',
      engine: 'fake',
      execute: async () => {
        throw new Error('boom');
      },
    });
    const wf = buildWorkflow(
      [{ id: 'n-a', type: 'transform', capability: 'cap.a', params: {} }],
      []
    );
    const result = await executor.execute(wf, [makeAsset('in')]);
    expect(result.status).toBe('failed');
    expect(result.error).toBe('boom');
    expect(events.some((e) => e.type === 'node:failed')).toBe(true);
    expect(events.some((e) => e.type === 'workflow:completed')).toBe(true);
    const completed = events.find(
      (e) => e.type === 'workflow:completed'
    ) as Extract<LokvisEvent, { type: 'workflow:completed' }>;
    expect(completed.result.status).toBe('failed');
  });

  it('输入 AssetId 不存在应 reject(Asset not found,在执行前校验)', async () => {
    const { executor, registry } = makeSetup();
    registry.registerCapability(makeCapabilityDecl('cap.a'));
    registry.registerImplementation(makeFakeImpl('cap.a', 'out'));
    const wf = buildWorkflow(
      [{ id: 'n-a', type: 'transform', capability: 'cap.a', params: {} }],
      []
    );
    await expect(executor.execute(wf, ['nonexistent-id'])).rejects.toThrow(
      /Asset not found/i
    );
  });

  it('工作流含环应返回 failed 结果', async () => {
    const { executor, registry } = makeSetup();
    registry.registerCapability(makeCapabilityDecl('cap.a'));
    registry.registerCapability(makeCapabilityDecl('cap.b'));
    registry.registerImplementation(makeFakeImpl('cap.a', 'a'));
    registry.registerImplementation(makeFakeImpl('cap.b', 'b'));
    const wf = buildWorkflow(
      [
        { id: 'n-a', type: 'transform', capability: 'cap.a', params: {} },
        { id: 'n-b', type: 'transform', capability: 'cap.b', params: {} },
      ],
      [
        { from: 'n-a', to: 'n-b' },
        { from: 'n-b', to: 'n-a' }, // 形成环
      ]
    );
    const result = await executor.execute(wf, [makeAsset('in')]);
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/cycle/i);
  });
});

describe('WorkflowExecutor:节点空输出处理(T6)', () => {
  it('能力返回空输出时工作流应完成,result.outputs 为空', async () => {
    const { executor, registry } = makeSetup();
    registry.registerCapability(makeCapabilityDecl('cap.noop'));
    registry.registerImplementation({
      capability: 'cap.noop',
      engine: 'fake',
      execute: async () => [],
    });
    const wf = buildWorkflow(
      [{ id: 'n-noop', type: 'transform', capability: 'cap.noop', params: {} }],
      []
    );
    const result = await executor.execute(wf, [makeAsset('in')]);
    expect(result.status).toBe('completed');
    expect(result.outputs).toEqual([]);
  });

  it('能力返回空输出时后续节点应收到空输入', async () => {
    const { executor, registry } = makeSetup();
    registry.registerCapability(makeCapabilityDecl('cap.empty'));
    registry.registerCapability(makeCapabilityDecl('cap.next'));
    let receivedByB: Asset[] = [{ id: 'sentinel' } as Asset];
    registry.registerImplementation({
      capability: 'cap.empty',
      engine: 'fake',
      execute: async () => [],
    });
    registry.registerImplementation({
      capability: 'cap.next',
      engine: 'fake',
      execute: async (inputs) => {
        receivedByB = inputs;
        return [makeAsset('out-b')];
      },
    });
    const wf = buildWorkflow(
      [
        { id: 'n-a', type: 'transform', capability: 'cap.empty', params: {} },
        { id: 'n-b', type: 'transform', capability: 'cap.next', params: {} },
      ],
      [{ from: 'n-a', to: 'n-b' }]
    );
    const result = await executor.execute(wf, [makeAsset('in')]);
    expect(result.status).toBe('completed');
    expect(result.outputs).toEqual(['out-b']);
    // node a 返回 [],node b 收到空输入数组
    expect(receivedByB).toEqual([]);
  });

  it('能力返回空输出时仍发射 node:finished(空 outputs)', async () => {
    const { executor, registry, events } = makeSetup();
    registry.registerCapability(makeCapabilityDecl('cap.noop'));
    registry.registerImplementation({
      capability: 'cap.noop',
      engine: 'fake',
      execute: async () => [],
    });
    const wf = buildWorkflow(
      [{ id: 'n-noop', type: 'transform', capability: 'cap.noop', params: {} }],
      []
    );
    await executor.execute(wf, [makeAsset('in')]);
    const finished = events.find(
      (e) => e.type === 'node:finished'
    ) as Extract<LokvisEvent, { type: 'node:finished' }> | undefined;
    expect(finished).toBeDefined();
    expect(finished!.outputs).toEqual([]);
  });
});
