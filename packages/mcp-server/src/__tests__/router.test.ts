/**
 * ToolRouter 单元测试(TD-1.1 改造后)
 *
 * 验证路由优先级:
 * - 浏览器已连接时优先转发到 browserBridge
 * - 浏览器调用失败时降级到 toolHandlers
 * - 浏览器未连接时直接走 toolHandlers
 * - tool 未注册且浏览器未连接时抛错
 *
 * TD-1.1 改造:移除 NodeEngineAdapter 中间层,ToolRouter 直接接收
 * toolHandlers Map,Node 降级路径直接调用 tool handler(不再做 capability 转换)。
 */
import { describe, it, expect, vi } from 'vitest';
import { ToolRouter } from '../router.js';
import type { ToolHandler } from '../router.js';

describe('ToolRouter', () => {
  /** 创建 mock browserBridge */
  function makeBrowserBridge(opts: {
    connected: boolean;
    callResult?: unknown;
    callError?: Error;
  }) {
    return {
      isConnected: vi.fn(() => opts.connected),
      callTool: vi.fn(async () => {
        if (opts.callError) throw opts.callError;
        return opts.callResult;
      }),
    };
  }

  /** 创建 mock toolHandler */
  function makeToolHandler(opts: { result?: unknown; error?: Error }) {
    return vi.fn(async () => {
      if (opts.error) throw opts.error;
      return opts.result;
    }) as unknown as ToolHandler;
  }

  /** 构造单 tool 的 handlers Map */
  function makeHandlers(name: string, handler: ToolHandler): Map<string, ToolHandler> {
    return new Map([[name, handler]]);
  }

  it('浏览器连接时优先转发到 browserBridge', async () => {
    const bridge = makeBrowserBridge({
      connected: true,
      callResult: { ok: true, from: 'browser' },
    });
    const handler = makeToolHandler({ result: { from: 'node' } });
    const router = new ToolRouter(bridge, makeHandlers('lokvis_image_resize', handler));

    const result = await router.execute('lokvis_image_resize', { width: 100 });

    expect(bridge.callTool).toHaveBeenCalledWith('lokvis_image_resize', { width: 100 });
    expect(handler).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, from: 'browser' });
  });

  it('浏览器调用失败时降级到 toolHandler', async () => {
    const bridge = makeBrowserBridge({
      connected: true,
      callError: new Error('browser crashed'),
    });
    const handler = makeToolHandler({ result: { from: 'node' } });
    const router = new ToolRouter(bridge, makeHandlers('lokvis_image_resize', handler));

    const result = await router.execute('lokvis_image_resize', {});

    expect(bridge.callTool).toHaveBeenCalled();
    expect(handler).toHaveBeenCalledWith({});
    expect(result).toEqual({ from: 'node' });
  });

  it('浏览器未连接且 tool 已注册,直接走 toolHandler', async () => {
    const bridge = makeBrowserBridge({ connected: false });
    const handler = makeToolHandler({ result: { from: 'node' } });
    const router = new ToolRouter(bridge, makeHandlers('lokvis_image_resize', handler));

    const result = await router.execute('lokvis_image_resize', { width: 50 });

    expect(bridge.callTool).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledWith({ width: 50 });
    expect(result).toEqual({ from: 'node' });
  });

  it('浏览器未连接且 tool 未注册,抛错并提示打开 lokvis.app', async () => {
    const bridge = makeBrowserBridge({ connected: false });
    const handler = makeToolHandler({ result: {} });
    const router = new ToolRouter(bridge, makeHandlers('lokvis_image_resize', handler));

    await expect(router.execute('lokvis_image_unknown', {})).rejects.toThrow(
      /Browser not connected/
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it('浏览器调用失败后 tool 也未注册,抛错并提示 Browser 不支持', async () => {
    const bridge = makeBrowserBridge({
      connected: true,
      callError: new Error('browser failed'),
    });
    const handler = makeToolHandler({ result: {} });
    const router = new ToolRouter(bridge, makeHandlers('lokvis_image_resize', handler));

    // bridge 失败降级到 toolHandlers,tool 未注册。bridge 仍 isConnected=true,
    // 错误信息应为 "Browser runtime does not support this capability."
    await expect(router.execute('lokvis_image_unknown', {})).rejects.toThrow(
      /Browser runtime does not support/
    );
  });

  it('tool name 直接作为 key 查找 handler(不做 capability 转换)', async () => {
    const bridge = makeBrowserBridge({ connected: false });
    const handler = makeToolHandler({ result: null });
    const handlers = new Map<string, ToolHandler>([
      ['lokvis_pdf_merge', handler],
    ]);
    const router = new ToolRouter(bridge, handlers);

    await router.execute('lokvis_pdf_merge', { files: ['a.pdf', 'b.pdf'] });

    expect(handler).toHaveBeenCalledWith({ files: ['a.pdf', 'b.pdf'] });
  });
});
