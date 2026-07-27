/**
 * Runtime Panel 注册表测试(UI 扩展点)
 *
 * 验证 registerPanel 依赖反转机制端到端工作:
 * - Plugin 通过 ctx.registerPanel() 注册 PanelDefinition
 * - runtime.listPanels() 返回注册的定义(公共 API)
 * - 注册时同步发射 panel:registered 事件(供 UI 层订阅)
 * - 同 id 重复注册覆盖前者(热更新语义)
 * - dispose() 清空注册表
 *
 * 与 read-asset-exif.test.ts 同为依赖反转机制测试:
 * runtime 只持有数据定义,不持有 React 组件。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LokvisRuntimeImpl } from '../runtime.js';
import type { PluginInstallEntry } from '../types.js';
import type { PanelDefinition } from '@lokvis/schema';

/** 构造一个内存 runtime(不依赖 OPFS/IDB) */
function makeRuntime(): LokvisRuntimeImpl {
  return new LokvisRuntimeImpl({ enableOpfs: false, enableIndexedDB: false });
}

function makePanel(id: string, overrides: Partial<PanelDefinition> = {}): PanelDefinition {
  return {
    id,
    name: `Panel ${id}`,
    location: 'inspector',
    component: `test.${id}`,
    ...overrides,
  };
}

/** 构造一个在安装时注册指定 Panel 的插件 */
function makePlugin(panels: PanelDefinition[]): PluginInstallEntry {
  return {
    config: { name: 'test-plugin', version: '1.0.0', capabilities: [] },
    install: (ctx) => {
      for (const panel of panels) ctx.registerPanel(panel);
    },
  };
}

describe('Runtime Panel 注册表', () => {
  let runtime: LokvisRuntimeImpl;

  beforeEach(() => {
    runtime = makeRuntime();
  });

  it('初始 listPanels 为空数组', () => {
    expect(runtime.listPanels()).toEqual([]);
  });

  it('installPlugin 期间 ctx.registerPanel 注册的 Panel 可通过 listPanels 查询', async () => {
    const panel = makePanel('histogram');
    await runtime.installPlugin(makePlugin([panel]));
    expect(runtime.listPanels()).toEqual([panel]);
  });

  it('多个 Panel 按注册顺序返回', async () => {
    const a = makePanel('a', { location: 'sidebar' });
    const b = makePanel('b', { location: 'toolbar' });
    await runtime.installPlugin(makePlugin([a, b]));
    expect(runtime.listPanels()).toEqual([a, b]);
  });

  it('注册 Panel 时同步发射 panel:registered 事件(携带定义)', async () => {
    const panel = makePanel('histogram');
    const events: PanelDefinition[] = [];
    runtime.eventBus.on('panel:registered', (e) => events.push(e.panel));
    await runtime.installPlugin(makePlugin([panel]));
    expect(events).toEqual([panel]);
  });

  it('同 id 重复注册覆盖前者(热更新语义)', async () => {
    await runtime.installPlugin(makePlugin([makePanel('p', { name: 'v1' })]));
    await runtime.installPlugin(makePlugin([makePanel('p', { name: 'v2' })]));
    const panels = runtime.listPanels();
    expect(panels).toHaveLength(1);
    expect(panels[0]!.name).toBe('v2');
  });

  it('listPanels 返回快照数组(外部修改不影响注册表)', async () => {
    await runtime.installPlugin(makePlugin([makePanel('p')]));
    const snapshot = runtime.listPanels();
    snapshot.pop();
    expect(runtime.listPanels()).toHaveLength(1);
  });

  it('dispose 清空 Panel 注册表', async () => {
    await runtime.installPlugin(makePlugin([makePanel('p')]));
    expect(runtime.listPanels()).toHaveLength(1);
    await runtime.dispose();
    expect(runtime.listPanels()).toEqual([]);
  });

  it('_registerPanel 直接调用同样发射事件(内部 API 一致性)', () => {
    const handler = vi.fn();
    runtime.eventBus.on('panel:registered', handler);
    const panel = makePanel('direct');
    runtime._registerPanel(panel);
    expect(handler).toHaveBeenCalledWith({ type: 'panel:registered', panel });
  });
});
