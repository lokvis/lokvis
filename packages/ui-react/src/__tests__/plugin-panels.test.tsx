// @vitest-environment jsdom
/**
 * PluginPanels + panels-slice + panel renderer 注册表单元测试
 *
 * 验证 UI 扩展点消费链路:
 * - panels-slice.refreshPanels 从 runtime.listPanels() 同步定义
 * - PluginPanels 按 location 过滤、按 show({ selectedAssets }) 求值
 * - component 标识经注册表解析为 React 组件;未注册静默跳过
 * - registerPanelRenderer 覆盖语义 + 反注册函数不误删后注册者
 *
 * 使用真实 useWorkspaceStore + 真实注册表(每个测试后 clearPanelRenderers)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import type { PanelDefinition } from '@lokvis/schema';
import type { LokvisRuntime } from '@lokvis/runtime';
import { PluginPanels } from '../components/PluginPanels.js';
import {
  registerPanelRenderer,
  clearPanelRenderers,
  getPanelRenderer,
  type PanelRendererProps,
} from '../panels/registry.js';
import { useWorkspaceStore } from '../store/index.js';

function makePanel(id: string, overrides: Partial<PanelDefinition> = {}): PanelDefinition {
  return {
    id,
    name: `Panel ${id}`,
    location: 'inspector',
    component: `test.${id}`,
    ...overrides,
  };
}

/** 简单渲染器:输出 panel name 与选中资产数 */
function makeRenderer(label: string) {
  return ({ panel, selectedAssets }: { panel: PanelDefinition; selectedAssets: string[] }) =>
    React.createElement(
      'div',
      { 'data-testid': `panel-${panel.id}` },
      `${label}:${selectedAssets.join(',')}`
    );
}

beforeEach(() => {
  clearPanelRenderers();
  useWorkspaceStore.setState({
    runtime: null,
    panels: [],
    selectedAssetId: null,
  });
});

afterEach(() => {
  cleanup();
  clearPanelRenderers();
  vi.restoreAllMocks();
});

describe('panels-slice.refreshPanels', () => {
  it('从 runtime.listPanels() 同步 Panel 定义', () => {
    const panels = [makePanel('a'), makePanel('b', { location: 'sidebar' })];
    const runtime = { listPanels: () => panels } as unknown as LokvisRuntime;
    useWorkspaceStore.setState({ runtime });

    useWorkspaceStore.getState().refreshPanels();
    expect(useWorkspaceStore.getState().panels).toEqual(panels);
  });

  it('runtime 未就绪时为空操作', () => {
    useWorkspaceStore.setState({ panels: [makePanel('keep')] });
    useWorkspaceStore.getState().refreshPanels();
    expect(useWorkspaceStore.getState().panels).toHaveLength(1);
  });
});

describe('panel renderer 注册表', () => {
  it('registerPanelRenderer 注册后可按 component 解析', () => {
    const renderer = makeRenderer('x');
    registerPanelRenderer('my.panel', renderer);
    expect(getPanelRenderer('my.panel')).toBe(renderer);
    expect(getPanelRenderer('other.panel')).toBeUndefined();
  });

  it('同 component 重复注册覆盖前者', () => {
    const first = makeRenderer('first');
    const second = makeRenderer('second');
    registerPanelRenderer('my.panel', first);
    registerPanelRenderer('my.panel', second);
    expect(getPanelRenderer('my.panel')).toBe(second);
  });

  it('反注册函数仅移除自己注册的 renderer', () => {
    const first = makeRenderer('first');
    const second = makeRenderer('second');
    const unregisterFirst = registerPanelRenderer('my.panel', first);
    registerPanelRenderer('my.panel', second);
    unregisterFirst(); // 不应误删 second
    expect(getPanelRenderer('my.panel')).toBe(second);
  });
});

describe('PluginPanels 渲染', () => {
  it('无 Panel 时不渲染任何内容', () => {
    const { container } = render(React.createElement(PluginPanels, { location: 'inspector' }));
    expect(container.firstChild).toBeNull();
  });

  it('按 location 过滤,只渲染本槽位的 Panel', () => {
    registerPanelRenderer('test.a', makeRenderer('A'));
    registerPanelRenderer('test.b', makeRenderer('B'));
    useWorkspaceStore.setState({
      panels: [makePanel('a', { location: 'inspector' }), makePanel('b', { location: 'sidebar' })],
    });

    render(React.createElement(PluginPanels, { location: 'inspector' }));
    expect(screen.getByTestId('panel-a')).toBeTruthy();
    expect(screen.queryByTestId('panel-b')).toBeNull();
  });

  it('show 谓词以 selectedAssets 求值,返回 false 时不渲染', () => {
    registerPanelRenderer('test.a', makeRenderer('A'));
    const show = vi.fn(({ selectedAssets }: { selectedAssets: string[] }) => selectedAssets.length > 0);
    useWorkspaceStore.setState({
      panels: [makePanel('a', { show })],
      selectedAssetId: null,
    });

    const { rerender } = render(React.createElement(PluginPanels, { location: 'inspector' }));
    expect(show).toHaveBeenCalledWith({ selectedAssets: [] });
    expect(screen.queryByTestId('panel-a')).toBeNull();

    useWorkspaceStore.setState({ selectedAssetId: 'asset-1' });
    rerender(React.createElement(PluginPanels, { location: 'inspector' }));
    expect(show).toHaveBeenLastCalledWith({ selectedAssets: ['asset-1'] });
    expect(screen.getByTestId('panel-a').textContent).toBe('A:asset-1');
  });

  it('未注册 component 的 Panel 静默跳过,不影响其他 Panel', () => {
    registerPanelRenderer('test.b', makeRenderer('B'));
    useWorkspaceStore.setState({
      panels: [makePanel('a'), makePanel('b')], // test.a 未注册
    });

    render(React.createElement(PluginPanels, { location: 'inspector' }));
    expect(screen.queryByTestId('panel-a')).toBeNull();
    expect(screen.getByTestId('panel-b')).toBeTruthy();
  });

  it('渲染器收到 runtime 实例', () => {
    const runtime = { listPanels: () => [] } as unknown as LokvisRuntime;
    const renderer = vi.fn((_props: PanelRendererProps) => React.createElement('div', null, 'ok'));
    registerPanelRenderer('test.a', renderer);
    useWorkspaceStore.setState({ panels: [makePanel('a')], runtime });

    render(React.createElement(PluginPanels, { location: 'inspector' }));
    expect(renderer).toHaveBeenCalledTimes(1);
    expect(renderer.mock.calls[0]![0]).toMatchObject({
      panel: expect.objectContaining({ id: 'a' }),
      selectedAssets: [],
      runtime,
    });
  });
});
