/**
 * ImageNodeEngineAdapter + ToolRouter 集成测试(M2.3)。
 *
 * 验证:
 * - adapter 从 tool 注册记录正确建立 capability → handler 映射
 * - supports / execute 行为
 * - ToolRouter 在浏览器未连接时走 adapter(Node 降级)
 * - ToolRouter 在浏览器已连接时走 browserBridge
 */
import { describe, it, expect, vi } from 'vitest';
import { ImageNodeEngineAdapter } from '../node-engine-adapter.js';
import { ToolRouter } from '../router.js';
import type { NodeEngineAdapter } from '../router.js';

describe('ImageNodeEngineAdapter', () => {
  it('应把 lokvis_image_resize 注册为 image.resize', () => {
    const adapter = new ImageNodeEngineAdapter([
      {
        name: 'lokvis_image_resize',
        handler: async () => ({ ok: true }),
      },
    ]);
    expect(adapter.supports('image.resize')).toBe(true);
    expect(adapter.supports('image.compress')).toBe(false);
    expect(adapter.supports('video.trim')).toBe(false);
  });

  it('应按下划线还原多词 verb(image.batch_process)', () => {
    const adapter = new ImageNodeEngineAdapter([
      {
        name: 'lokvis_image_batch_process',
        handler: async () => ({ ok: true }),
      },
    ]);
    expect(adapter.supports('image.batch_process')).toBe(true);
  });

  it('execute 应调用对应 handler 并透传 params', async () => {
    const handler = vi.fn(async (p: Record<string, unknown>) => ({
      content: [{ type: 'text' as const, text: `w=${p.width}` }],
    }));
    const adapter = new ImageNodeEngineAdapter([
      { name: 'lokvis_image_resize', handler },
    ]);

    const result = await adapter.execute('image.resize', { width: 200 });

    expect(handler).toHaveBeenCalledWith({ width: 200 });
    expect(result).toEqual({ content: [{ type: 'text', text: 'w=200' }] });
  });

  it('execute 不支持的 capability 应抛错', async () => {
    const adapter = new ImageNodeEngineAdapter([
      { name: 'lokvis_image_resize', handler: async () => ({}) },
    ]);
    await expect(adapter.execute('video.trim', {})).rejects.toThrow(
      /does not support capability: video\.trim/
    );
  });

  it('supportedCapabilities 应列出全部已注册 capability', () => {
    const adapter = new ImageNodeEngineAdapter([
      { name: 'lokvis_image_resize', handler: async () => ({}) },
      { name: 'lokvis_image_compress', handler: async () => ({}) },
      { name: 'lokvis_image_convert', handler: async () => ({}) },
    ]);
    expect(adapter.supportedCapabilities().sort()).toEqual([
      'image.compress',
      'image.convert',
      'image.resize',
    ]);
  });
});

describe('ToolRouter + ImageNodeEngineAdapter 集成', () => {
  it('浏览器未连接时应走 Node adapter', async () => {
    const adapter = new ImageNodeEngineAdapter([
      {
        name: 'lokvis_image_resize',
        handler: async () => ({ content: [{ type: 'text', text: 'node-result' }] }),
      },
    ]);
    const bridge = {
      isConnected: vi.fn(() => false),
      callTool: vi.fn(async () => {
        throw new Error('should not be called');
      }),
    };
    const router = new ToolRouter(bridge, adapter as unknown as NodeEngineAdapter);

    const result = await router.execute('lokvis_image_resize', { width: 50 });

    expect(bridge.isConnected).toHaveBeenCalled();
    expect(bridge.callTool).not.toHaveBeenCalled();
    expect(result).toEqual({ content: [{ type: 'text', text: 'node-result' }] });
  });

  it('浏览器已连接时应优先走 browserBridge', async () => {
    const adapter = new ImageNodeEngineAdapter([
      {
        name: 'lokvis_image_resize',
        handler: async () => ({ content: [{ type: 'text', text: 'node' }] }),
      },
    ]);
    const bridge = {
      isConnected: vi.fn(() => true),
      callTool: vi.fn(async () => ({
        content: [{ type: 'text', text: 'browser' }],
      })),
    };
    const router = new ToolRouter(bridge, adapter as unknown as NodeEngineAdapter);

    const result = await router.execute('lokvis_image_resize', { width: 50 });

    expect(bridge.callTool).toHaveBeenCalledWith('lokvis_image_resize', { width: 50 });
    expect(result).toEqual({ content: [{ type: 'text', text: 'browser' }] });
  });

  it('浏览器调用失败时降级到 Node adapter', async () => {
    const adapter = new ImageNodeEngineAdapter([
      {
        name: 'lokvis_image_resize',
        handler: async () => ({ content: [{ type: 'text', text: 'node-fallback' }] }),
      },
    ]);
    const bridge = {
      isConnected: vi.fn(() => true),
      callTool: vi.fn(async () => {
        throw new Error('browser crashed');
      }),
    };
    const router = new ToolRouter(bridge, adapter as unknown as NodeEngineAdapter);

    const result = await router.execute('lokvis_image_resize', {});

    expect(result).toEqual({ content: [{ type: 'text', text: 'node-fallback' }] });
  });
});
