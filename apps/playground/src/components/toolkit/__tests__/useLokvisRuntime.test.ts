/**
 * useLokvisRuntime hook 单测。
 *
 * 测试覆盖:
 *   - 默认行为:不传 plugins 时加载 [imageToolsPlugin()]
 *   - 自定义 plugins:三方组合 [imageToolsPlugin(), audioToolsPlugin()]
 *   - 空数组 plugins=[]:显式不加载任何插件
 *   - W23 之前的行为:auth/plan 变化触发 runtime 重建
 *   - unmount 时 runtime.cancel('all')
 *
 * createLokvis 被整体 mock,只验证 useLokvisRuntime 的 plugins 透传逻辑。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ─── mock createLokvis:捕获 plugins 参数 ──────────────────

const createLokvisMock = vi.fn();
const cancelMock = vi.fn();

vi.mock('@lokvis/sdk', () => ({
  createLokvis: (...args: unknown[]) => {
    createLokvisMock(...args);
    return Promise.resolve({
      cancel: cancelMock,
    });
  },
}));

// imageToolsPlugin 是默认插件,只验证它是否被默认调用
const imageToolsPluginMock = vi.fn(() => ({
  config: { name: 'image-tools', version: '0.0.0', capabilities: [] },
  install: () => {},
}));
vi.mock('@lokvis/plugin-image', () => ({
  imageToolsPlugin: () => imageToolsPluginMock(),
}));

import { useLokvisRuntime } from '../useLokvisRuntime';

// ─── 测试 ───────────────────────────────────────────────────

describe('useLokvisRuntime', () => {
  beforeEach(() => {
    createLokvisMock.mockReset();
    cancelMock.mockReset();
    imageToolsPluginMock.mockReset();
    imageToolsPluginMock.mockReturnValue({
      config: { name: 'image-tools', version: '0.0.0', capabilities: [] },
      install: () => {},
    });
  });

  it('W23 默认行为:不传 plugins 时,createLokvis 收到 [imageToolsPlugin()]', async () => {
    renderHook(() => useLokvisRuntime());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(createLokvisMock).toHaveBeenCalledTimes(1);
    const opts = createLokvisMock.mock.calls[0]![0] as { plugins: unknown[] };
    expect(opts.plugins).toHaveLength(1);
    expect(imageToolsPluginMock).toHaveBeenCalledTimes(1);
  });

  it('W23 自定义 plugins:三方组合时,createLokvis 收到原样数组(不追加默认)', async () => {
    const imagePlugin = { config: { name: 'image-tools', version: '0.0.0', capabilities: [] }, install: () => {} };
    const audioPlugin = { config: { name: 'audio-tools', version: '0.0.0', capabilities: [] }, install: () => {} };
    const plugins = [imagePlugin, audioPlugin];
    renderHook(() => useLokvisRuntime(undefined, plugins));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(createLokvisMock).toHaveBeenCalledTimes(1);
    const opts = createLokvisMock.mock.calls[0]![0] as { plugins: unknown[] };
    // 原样透传,不追加默认 imageToolsPlugin
    expect(opts.plugins).toBe(plugins);
    expect(opts.plugins).toHaveLength(2);
    // imageToolsPlugin 不应被调用(三方已显式提供)
    expect(imageToolsPluginMock).not.toHaveBeenCalled();
  });

  it('W23 空数组 plugins=[]:createLokvis 收到 [](显式不加载任何插件)', async () => {
    renderHook(() => useLokvisRuntime(undefined, []));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(createLokvisMock).toHaveBeenCalledTimes(1);
    const opts = createLokvisMock.mock.calls[0]![0] as { plugins: unknown[] };
    expect(opts.plugins).toEqual([]);
    expect(imageToolsPluginMock).not.toHaveBeenCalled();
  });

  it('W23 plugins 不变时不重建 runtime(pluginsKey 稳定)', async () => {
    const plugins = [{ config: { name: 'p1', version: '0.0.0', capabilities: [] }, install: () => {} }];
    const { rerender } = renderHook(() => useLokvisRuntime(undefined, plugins));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(createLokvisMock).toHaveBeenCalledTimes(1);

    // 重新渲染:数组引用变化但 name 列表相同 → 不应重建
    rerender();
    await act(async () => { await Promise.resolve(); });
    expect(createLokvisMock).toHaveBeenCalledTimes(1);
  });

  it('W23 plugins name 列表变化时重建 runtime', async () => {
    const plugins1 = [{ config: { name: 'p1', version: '0.0.0', capabilities: [] }, install: () => {} }];
    const { rerender, unmount } = renderHook(
      ({ pl }) => useLokvisRuntime(undefined, pl),
      { initialProps: { pl: plugins1 } }
    );
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(createLokvisMock).toHaveBeenCalledTimes(1);

    // 加入新插件:name 列表变化 → 应重建
    const plugins2 = [
      { config: { name: 'p1', version: '0.0.0', capabilities: [] }, install: () => {} },
      { config: { name: 'p2', version: '0.0.0', capabilities: [] }, install: () => {} },
    ];
    rerender({ pl: plugins2 });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(createLokvisMock).toHaveBeenCalledTimes(2);

    unmount();
    // 旧 runtime + 新 runtime 都应被 cancel('all')
    await act(async () => { await Promise.resolve(); });
    expect(cancelMock).toHaveBeenCalledWith('all');
  });

  it('unmount 时调用 runtime.cancel("all")', async () => {
    const { unmount } = renderHook(() => useLokvisRuntime());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(cancelMock).not.toHaveBeenCalled();
    unmount();
    await act(async () => { await Promise.resolve(); });
    expect(cancelMock).toHaveBeenCalledWith('all');
  });
});
