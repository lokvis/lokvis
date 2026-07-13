/**
 * workflow-coordinator 单元测试(W2.2)
 *
 * 直接测试 WorkflowCoordinator 类(不经过 Runtime),聚焦:
 * - status 状态机:idle → running → idle/error
 * - run:validateWorkflow 失败时返回 failed result + status=error + 发射 workflow:completed
 * - run:executor.execute 成功 + status=idle + recordRunResult 调用
 * - run:executor.execute 返回 failed + status=error
 * - run:executor.execute 抛错 + status=error + 透传异常
 * - run:appendHistory 选项透传给 historyManager.prepareForRun
 * - cancel/pause/resume 转发给 executor
 * - disposeWorkflow:cancel 失败不抛错(warn)+ historyManager.disposeHistory 调用
 * - collectInputAssetIds:AssetId[] 与 Asset[] 归一化(通过 run 间接测试)
 */
import { describe, it, expect, vi } from 'vitest';
import { WorkflowCoordinator } from '../managers/workflow-coordinator.js';
import { createEventBus } from '../event-bus.js';
import { CapabilityRegistry } from '../capability-registry.js';
import { HistoryManager } from '../managers/history-manager.js';
import { createMemoryAssetStore } from '../asset-store.js';
import { wrapAssetStoreWithQuota } from '../managers/quota-manager.js';
import type { Asset, LokvisEvent, Workflow, WorkflowResult } from '@lokvis/schema';
import type { WorkflowExecutor } from '../executor.js';

/** 构造一个线性 workflow(image.resize → image.compress) */
function makeWorkflow(id = 'wf-test'): Workflow {
  return {
    id,
    version: '1.0.0',
    name: 'test-wf',
    description: 'test',
    author: { id: 'a', name: 'tester' },
    category: 'image',
    tags: [],
    nodes: [
      { id: 'n1', type: 'transform', capability: 'image.resize', params: { width: 100 } },
      { id: 'n2', type: 'transform', capability: 'image.compress', params: { quality: 80 } },
    ],
    edges: [{ from: 'n1', to: 'n2' }],
    inputs: { type: 'image', multiple: false },
    outputs: { type: 'image', format: 'png' },
  };
}

/** 构造 mock executor:execute 返回可控结果 */
function makeMockExecutor(
  result: WorkflowResult | (() => WorkflowResult | Promise<WorkflowResult>) = {
    workflowId: 'wf-test',
    outputs: ['out-1'],
    duration: 10,
    status: 'completed',
  }
): WorkflowExecutor & { cancel: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn> } {
  const executeFn = typeof result === 'function' ? result : () => result;
  return {
    execute: vi.fn(executeFn),
    cancel: vi.fn(async () => {}),
    pause: vi.fn(async () => {}),
    resume: vi.fn(async () => {}),
  } as unknown as WorkflowExecutor & {
    cancel: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
  };
}

function makeFixture(executor?: ReturnType<typeof makeMockExecutor>) {
  const inner = createMemoryAssetStore();
  const assetStore = wrapAssetStoreWithQuota(inner, 1024 * 1024);
  const eventBus = createEventBus();
  const capabilityRegistry = new CapabilityRegistry();
  const historyManager = new HistoryManager({ eventBus, assetStore });
  const exec = executor ?? makeMockExecutor();
  const coordinator = new WorkflowCoordinator({
    executor: exec,
    capabilityRegistry,
    eventBus,
    historyManager,
  });
  const events: LokvisEvent[] = [];
  eventBus.onAny((e) => events.push(e));
  return { coordinator, executor: exec, eventBus, capabilityRegistry, historyManager, events };
}

describe('WorkflowCoordinator - status 状态机', () => {
  it('初始 status 为 idle', () => {
    const { coordinator } = makeFixture();
    expect(coordinator.status).toBe('idle');
  });

  it('run 成功后 status 回到 idle', async () => {
    const { coordinator, capabilityRegistry } = makeFixture();
    // 注册能力让 validateWorkflow 通过
    capabilityRegistry.registerCapability({
      name: 'image.resize',
      description: 'resize',
      inputTypes: ['image'],
      outputTypes: ['image'],
      params: [],
      performance: 'fast',
    });
    capabilityRegistry.registerCapability({
      name: 'image.compress',
      description: 'compress',
      inputTypes: ['image'],
      outputTypes: ['image'],
      params: [],
      performance: 'fast',
    });
    const wf = makeWorkflow();
    await coordinator.run(wf, ['in-1']);
    expect(coordinator.status).toBe('idle');
  });

  it('run 返回 failed result 时 status 为 error', async () => {
    const { coordinator, capabilityRegistry } = makeFixture(
      makeMockExecutor({
        workflowId: 'wf-test',
        outputs: [],
        duration: 0,
        status: 'failed',
        error: 'exec boom',
      })
    );
    capabilityRegistry.registerCapability({
      name: 'image.resize',
      description: 'resize',
      inputTypes: ['image'],
      outputTypes: ['image'],
      params: [],
      performance: 'fast',
    });
    capabilityRegistry.registerCapability({
      name: 'image.compress',
      description: 'compress',
      inputTypes: ['image'],
      outputTypes: ['image'],
      params: [],
      performance: 'fast',
    });
    await coordinator.run(makeWorkflow(), ['in-1']);
    expect(coordinator.status).toBe('error');
  });
});

describe('WorkflowCoordinator.run - validateWorkflow 错误处理', () => {
  it('validateWorkflow 失败时返回 failed result + status=error + 发射 workflow:completed', async () => {
    const { coordinator, events, executor } = makeFixture();
    // 不注册任何能力 → resolveCapability 返回 undefined → validateWorkflow 失败
    // 但 validateWorkflow 实际错误是结构性的,我们用自环节点触发
    const badWf: Workflow = {
      ...makeWorkflow(),
      nodes: [
        { id: 'n1', type: 'transform', capability: 'image.resize', params: {} },
      ],
      edges: [{ from: 'n1', to: 'n1' }], // 自环
    };
    const result = await coordinator.run(badWf, ['in-1']);
    expect(result.status).toBe('failed');
    expect(result.outputs).toEqual([]);
    expect(result.error).toBeTruthy();
    expect(coordinator.status).toBe('error');
    // executor.execute 不应被调用
    expect(executor.execute).not.toHaveBeenCalled();
    // 应发射 workflow:completed 事件
    const completed = events.find((e) => e.type === 'workflow:completed');
    expect(completed).toBeDefined();
  });

  it('validateWorkflow 失败时 error 信息包含 issues', async () => {
    const { coordinator } = makeFixture();
    const badWf: Workflow = {
      ...makeWorkflow(),
      nodes: [
        { id: 'dup', type: 'transform', capability: 'image.resize', params: {} },
        { id: 'dup', type: 'transform', capability: 'image.compress', params: {} },
      ],
      edges: [],
    };
    const result = await coordinator.run(badWf, ['in-1']);
    expect(result.status).toBe('failed');
    expect(result.error).toBeTruthy();
  });
});

describe('WorkflowCoordinator.run - executor.execute 路径', () => {
  function registerCaps(reg: CapabilityRegistry): void {
    reg.registerCapability({
      name: 'image.resize',
      description: 'resize',
      inputTypes: ['image'],
      outputTypes: ['image'],
      params: [],
      performance: 'fast',
    });
    reg.registerCapability({
      name: 'image.compress',
      description: 'compress',
      inputTypes: ['image'],
      outputTypes: ['image'],
      params: [],
      performance: 'fast',
    });
  }

  it('execute 成功后调用 historyManager.recordRunResult(含 outputs)', async () => {
    const { coordinator, capabilityRegistry, historyManager } = makeFixture();
    registerCaps(capabilityRegistry);
    const wf = makeWorkflow();
    const inputAsset: Asset = {
      id: 'in-1',
      type: 'image',
      metadata: { mimeType: 'image/png', size: 1, format: 'png' },
      blob: { path: 'memory://in-1', size: 1, mimeType: 'image/png' },
      history: [],
      tags: [],
      createdAt: 0,
      updatedAt: 0,
    };
    await coordinator.run(wf, [inputAsset]);
    // recordRunResult 应更新 currentOutputs
    expect(historyManager.getCurrentOutputs(wf.id)).toEqual(['out-1']);
  });

  it('execute 成功但 outputs 为空时不调用 recordRunResult', async () => {
    const { coordinator, capabilityRegistry, historyManager } = makeFixture(
      makeMockExecutor({
        workflowId: 'wf-test',
        outputs: [],
        duration: 5,
        status: 'completed',
      })
    );
    registerCaps(capabilityRegistry);
    const wf = makeWorkflow();
    await coordinator.run(wf, ['in-1']);
    // outputs 为空,currentOutputs 保持 prepareForRun 设置的 inputs
    expect(historyManager.getCurrentOutputs(wf.id)).toEqual(['in-1']);
  });

  it('execute 抛错时 status=error 并透传异常', async () => {
    const { coordinator, capabilityRegistry } = makeFixture(
      makeMockExecutor(() => {
        throw new Error('execute boom');
      })
    );
    registerCaps(capabilityRegistry);
    await expect(coordinator.run(makeWorkflow(), ['in-1'])).rejects.toThrow(
      'execute boom'
    );
    expect(coordinator.status).toBe('error');
  });

  it('appendHistory 选项透传给 historyManager.prepareForRun', async () => {
    const { coordinator, capabilityRegistry, historyManager } = makeFixture();
    registerCaps(capabilityRegistry);
    const wf = makeWorkflow();
    // 第一次 run(默认 appendHistory=false)
    await coordinator.run(wf, ['in-1'], { appendHistory: false });
    // 第二次 run(appendHistory=true):历史栈应保留
    const spy = vi.spyOn(historyManager, 'prepareForRun');
    await coordinator.run(wf, ['in-1'], { appendHistory: true });
    expect(spy).toHaveBeenCalledWith(wf.id, ['in-1'], true);
  });

  it('inputs 为 Asset[] 时归一化为 AssetId[] 传给 prepareForRun', async () => {
    const { coordinator, capabilityRegistry, historyManager } = makeFixture();
    registerCaps(capabilityRegistry);
    const wf = makeWorkflow();
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
    const spy = vi.spyOn(historyManager, 'prepareForRun');
    await coordinator.run(wf, [inputAsset]);
    expect(spy).toHaveBeenCalledWith(wf.id, ['asset-input'], false);
  });

  it('空 inputs 时 collectInputAssetIds 返回 []', async () => {
    const { coordinator, capabilityRegistry, historyManager } = makeFixture();
    registerCaps(capabilityRegistry);
    const wf = makeWorkflow();
    const spy = vi.spyOn(historyManager, 'prepareForRun');
    await coordinator.run(wf, []);
    expect(spy).toHaveBeenCalledWith(wf.id, [], false);
  });
});

describe('WorkflowCoordinator - cancel/pause/resume 转发', () => {
  it('cancel 转发给 executor.cancel', async () => {
    const { coordinator, executor } = makeFixture();
    await coordinator.cancel('wf-1');
    expect(executor.cancel).toHaveBeenCalledWith('wf-1');
  });

  it('pause 转发给 executor.pause', async () => {
    const { coordinator, executor } = makeFixture();
    await coordinator.pause('wf-1');
    expect(executor.pause).toHaveBeenCalledWith('wf-1');
  });

  it('resume 转发给 executor.resume', async () => {
    const { coordinator, executor } = makeFixture();
    await coordinator.resume('wf-1');
    expect(executor.resume).toHaveBeenCalledWith('wf-1');
  });
});

describe('WorkflowCoordinator.disposeWorkflow', () => {
  it('cancel 失败时不抛错(warn)+ 仍调用 historyManager.disposeHistory', async () => {
    const inner = createMemoryAssetStore();
    const assetStore = wrapAssetStoreWithQuota(inner, 1024 * 1024);
    const eventBus = createEventBus();
    const historyManager = new HistoryManager({ eventBus, assetStore });
    // 让 executor.cancel 抛错
    const exec = makeMockExecutor();
    exec.cancel = vi.fn(async () => {
      throw new Error('cancel boom');
    });
    const coordinator = new WorkflowCoordinator({
      executor: exec,
      capabilityRegistry: new CapabilityRegistry(),
      eventBus,
      historyManager,
    });
    const spy = vi.spyOn(historyManager, 'disposeHistory');
    // 不应抛错
    await coordinator.disposeWorkflow('wf-1');
    expect(spy).toHaveBeenCalledWith('wf-1');
  });

  it('cancel 成功后调用 historyManager.disposeHistory', async () => {
    const { coordinator, historyManager } = makeFixture();
    const spy = vi.spyOn(historyManager, 'disposeHistory');
    await coordinator.disposeWorkflow('wf-1');
    expect(spy).toHaveBeenCalledWith('wf-1');
  });
});
