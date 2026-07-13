/**
 * toolToCapability 单元测试(T1/T4)
 *
 * 验证 MCP tool 名 → Lokvis capability 名的反向推断:
 * - 默认 tool 名 `lokvis_<domain>_<verb>` → `<domain>.<verb>`(domain 在前)
 * - 去掉 `lokvis_` 前缀
 * - 单段名原样返回
 * - 多词 verb 用下划线还原(而非点号)
 *
 * 覆盖 B1 修复:此前实现误把 domain 放在末尾且用点号拼接 verb,
 * 导致 `lokvis_image_resize` → `resize.image`(错误)。
 */
import { describe, it, expect, vi } from 'vitest';
import { toolToCapability, ToolRouter } from '../router.js';
import type { NodeEngineAdapter } from '../router.js';

describe('toolToCapability', () => {
  it('应把默认 tool 名反推为 <domain>.<verb>(domain 在前)', () => {
    // 默认映射:image.resize → lokvis_image_resize(domain 在前)
    expect(toolToCapability('lokvis_image_resize')).toBe('image.resize');
    expect(toolToCapability('lokvis_pdf_merge')).toBe('pdf.merge');
    expect(toolToCapability('lokvis_image_compress')).toBe('image.compress');
  });

  it('应按下划线还原多词 verb(而非点号)', () => {
    // image.batch_process → lokvis_image_batch_process
    // 反推应得回 image.batch_process(用下划线,不是 image.batch.process)
    expect(toolToCapability('lokvis_image_batch_process')).toBe(
      'image.batch_process'
    );
    expect(toolToCapability('lokvis_pdf_split_pages')).toBe('pdf.split_pages');
  });

  it('无 lokvis_ 前缀时应直接按 body 推断', () => {
    expect(toolToCapability('image_resize')).toBe('image.resize');
  });

  it('单段名(无下划线)应原样返回', () => {
    expect(toolToCapability('lokvis_image')).toBe('image');
    expect(toolToCapability('image')).toBe('image');
  });

  it('空前缀 lokvis_ 后无内容时应返回空串', () => {
    expect(toolToCapability('lokvis_')).toBe('');
  });

  it('与 toMcpManifest 默认 tool 名约定互为逆运算', () => {
    // 默认 tool 名 = lokvis_${name.replace(/\./g, '_')}
    const cases = ['image.resize', 'pdf.merge', 'image.batch_process'];
    for (const name of cases) {
      const tool = `lokvis_${name.replace(/\./g, '_')}`;
      expect(toolToCapability(tool)).toBe(name);
    }
  });
});

describe('ToolRouter', () => {
  /** 创建 mock browserBridge */
  function makeBrowserBridge(opts: { connected: boolean; callResult?: unknown; callError?: Error }) {
    return {
      isConnected: vi.fn(() => opts.connected),
      callTool: vi.fn(async () => {
        if (opts.callError) throw opts.callError;
        return opts.callResult;
      }),
    };
  }

  /** 创建 mock nodeEngine */
  function makeNodeEngine(opts: { supports: boolean; executeResult?: unknown }) {
    return {
      supports: vi.fn(() => opts.supports),
      execute: vi.fn(async () => opts.executeResult),
    } as unknown as NodeEngineAdapter;
  }

  it('浏览器连接时优先转发到 browserBridge', async () => {
    const bridge = makeBrowserBridge({
      connected: true,
      callResult: { ok: true, from: 'browser' },
    });
    const engine = makeNodeEngine({ supports: true, executeResult: { from: 'node' } });
    const router = new ToolRouter(bridge, engine);

    const result = await router.execute('lokvis_image_resize', { width: 100 });

    expect(bridge.callTool).toHaveBeenCalledWith('lokvis_image_resize', { width: 100 });
    expect(engine.execute).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, from: 'browser' });
  });

  it('浏览器调用失败时降级到 Node engine', async () => {
    const bridge = makeBrowserBridge({
      connected: true,
      callError: new Error('browser crashed'),
    });
    const engine = makeNodeEngine({ supports: true, executeResult: { from: 'node' } });
    const router = new ToolRouter(bridge, engine);

    const result = await router.execute('lokvis_image_resize', {});

    expect(bridge.callTool).toHaveBeenCalled();
    expect(engine.execute).toHaveBeenCalledWith('image.resize', {});
    expect(result).toEqual({ from: 'node' });
  });

  it('浏览器未连接且 Node 支持,直接走 Node engine', async () => {
    const bridge = makeBrowserBridge({ connected: false });
    const engine = makeNodeEngine({ supports: true, executeResult: { from: 'node' } });
    const router = new ToolRouter(bridge, engine);

    const result = await router.execute('lokvis_image_resize', {});

    expect(bridge.callTool).not.toHaveBeenCalled();
    expect(engine.execute).toHaveBeenCalledWith('image.resize', {});
    expect(result).toEqual({ from: 'node' });
  });

  it('浏览器未连接且 Node 不支持,抛错并提示打开 lokvis.app', async () => {
    const bridge = makeBrowserBridge({ connected: false });
    const engine = makeNodeEngine({ supports: false });
    const router = new ToolRouter(bridge, engine);

    await expect(router.execute('lokvis_image_resize', {})).rejects.toThrow(
      /Browser not connected/
    );
    expect(engine.execute).not.toHaveBeenCalled();
  });

  it('浏览器调用失败后 Node 也不支持,抛错并提示 Browser 不支持', async () => {
    const bridge = makeBrowserBridge({
      connected: true,
      callError: new Error('browser failed'),
    });
    const engine = makeNodeEngine({ supports: false });
    const router = new ToolRouter(bridge, engine);

    // bridge 失败降级到 Node,Node 不支持。bridge 仍 isConnected=true,
    // 错误信息应为 "Browser runtime does not support this capability."
    await expect(router.execute('lokvis_image_resize', {})).rejects.toThrow(
      /Browser runtime does not support/
    );
  });

  it('tool 名应通过 toolToCapability 转换为 capability 后传给 nodeEngine', async () => {
    const bridge = makeBrowserBridge({ connected: false });
    const engine = makeNodeEngine({ supports: true, executeResult: null });
    const router = new ToolRouter(bridge, engine);

    await router.execute('lokvis_pdf_merge', { files: ['a.pdf', 'b.pdf'] });

    expect(engine.supports).toHaveBeenCalledWith('pdf.merge');
    expect(engine.execute).toHaveBeenCalledWith('pdf.merge', {
      files: ['a.pdf', 'b.pdf'],
    });
  });
});
