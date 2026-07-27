// @vitest-environment jsdom
/**
 * runtime-slice plugin:loaded 事件桥接单测(gap 分析 #16)。
 *
 * 验证初始化完成后经 loadPlugin() 加载的插件无需三方手动调用
 * refreshCapabilities()——store 监听 plugin:loaded 事件自动刷新能力列表。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LokvisRuntime } from '@lokvis/runtime';
import type { EventBus, LokvisEvent, LokvisEventType, Capability } from '@lokvis/schema';
import { useWorkspaceStore } from '../store/index.js';

// ─── 测试基建 ───────────────────────────────────────────────

/** 最小可用 EventBus:按 type 分发,支持 off */
function makeEventBus(): EventBus {
  type AnyHandler = (e: LokvisEvent) => void;
  const handlers = new Map<LokvisEventType, Set<AnyHandler>>();
  return {
    on(type, handler) {
      let set = handlers.get(type);
      if (!set) {
        set = new Set();
        handlers.set(type, set);
      }
      // 分发按 type 键控,handler 只会收到自己订阅的事件,
      // 收窄事件 handler 拓宽为通用 handler 是事件总线的标准类型擦除
      const anyHandler = handler as AnyHandler;
      set.add(anyHandler);
      return () => {
        set.delete(anyHandler);
      };
    },
    onAny() {
      return () => {};
    },
    emit(e) {
      for (const h of handlers.get(e.type) ?? []) h(e);
    },
    clear() {
      handlers.clear();
    },
  };
}

function makeCap(name: string): Capability {
  return {
    name,
    description: `${name} description`,
    inputTypes: ['image'],
    outputTypes: ['image'],
    params: [],
    performance: 'fast',
  };
}

function makeRuntime(initialCaps: Capability[]) {
  const eventBus = makeEventBus();
  const capabilities = vi.fn(async () => initialCaps);
  const runtime = {
    eventBus,
    listAssets: async () => [],
    capabilities,
    isStubOnly: async () => false,
    listPanels: () => [],
    getStorageUsage: async () => null,
  } as unknown as LokvisRuntime;
  return { runtime, eventBus, capabilities };
}

beforeEach(() => {
  useWorkspaceStore.setState({
    runtime: null,
    initializing: false,
    initError: null,
    capabilities: [],
    capabilityMap: {},
    stubCapabilities: new Set(),
  });
});

// ─── 测试 ───────────────────────────────────────────────────

describe('runtime-slice plugin:loaded 事件桥接', () => {
  it('init 后发射 plugin:loaded 自动刷新能力列表', async () => {
    const capA = makeCap('image.a');
    const capB = makeCap('audio.b');
    const { runtime, eventBus, capabilities } = makeRuntime([capA]);

    await useWorkspaceStore.getState().init(runtime);
    expect(capabilities).toHaveBeenCalledTimes(1);
    expect(useWorkspaceStore.getState().capabilities).toHaveLength(1);

    // 模拟 loadPlugin:runtime 能力集合增长后发射 plugin:loaded
    capabilities.mockResolvedValue([capA, capB]);
    eventBus.emit({ type: 'plugin:loaded', name: 'audio-tools', version: '1.0.0' });

    await vi.waitFor(() => {
      expect(useWorkspaceStore.getState().capabilities).toHaveLength(2);
    });
    expect(capabilities).toHaveBeenCalledTimes(2);
    expect(useWorkspaceStore.getState().capabilityMap['audio.b']).toBeDefined();
  });

  it('重入 init 不重复订阅(单次事件只刷新一次)', async () => {
    const { runtime, eventBus, capabilities } = makeRuntime([makeCap('image.a')]);

    await useWorkspaceStore.getState().init(runtime);
    await useWorkspaceStore.getState().init(runtime);
    capabilities.mockClear();

    eventBus.emit({ type: 'plugin:loaded', name: 'p', version: '1.0.0' });

    await vi.waitFor(() => {
      expect(capabilities).toHaveBeenCalledTimes(1);
    });
    // 再等一拍,确认不会有第二次刷新(重复订阅会在此暴露)
    await new Promise((r) => setTimeout(r, 10));
    expect(capabilities).toHaveBeenCalledTimes(1);
  });

  it('刷新失败不抛未捕获 rejection,也不影响后续事件', async () => {
    const { runtime, eventBus, capabilities } = makeRuntime([makeCap('image.a')]);
    await useWorkspaceStore.getState().init(runtime);

    capabilities.mockRejectedValueOnce(new Error('refresh boom'));
    expect(() =>
      eventBus.emit({ type: 'plugin:loaded', name: 'p', version: '1.0.0' })
    ).not.toThrow();
    await vi.waitFor(() => {
      expect(capabilities).toHaveBeenCalledTimes(2);
    });

    // 失败后订阅仍然存活:再次发射事件继续刷新
    capabilities.mockResolvedValue([makeCap('image.a'), makeCap('image.b')]);
    eventBus.emit({ type: 'plugin:loaded', name: 'q', version: '1.0.0' });
    await vi.waitFor(() => {
      expect(useWorkspaceStore.getState().capabilities).toHaveLength(2);
    });
  });
});
