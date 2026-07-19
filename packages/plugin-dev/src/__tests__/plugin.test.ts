/**
 * devToolsPlugin 定义与 install 行为测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  devToolsPlugin,
  PLUGIN_NAME,
  PLUGIN_VERSION,
} from '../plugin.js';
import { buildDevCapabilityImplementations } from '../capabilities/index.js';
import { createMockContext } from './helpers.js';

describe('devToolsPlugin 定义', () => {
  it('应暴露正确的插件常量', () => {
    expect(PLUGIN_NAME).toBe('lokvis-dev-tools');
    expect(PLUGIN_VERSION).toBe('0.1.0');
  });

  it('应返回 config 与 install 函数', () => {
    const plugin = devToolsPlugin();
    expect(plugin.config.name).toBe(PLUGIN_NAME);
    expect(plugin.config.version).toBe(PLUGIN_VERSION);
    expect(typeof plugin.install).toBe('function');
  });

  it('config.capabilities 应包含全部 9 个开发者能力声明', () => {
    const plugin = devToolsPlugin();
    expect(plugin.config.capabilities).toHaveLength(9);
    const names = plugin.config.capabilities.map((c) => c.name);
    expect(names).toContain('developer.inspect.capabilities');
    expect(names).toContain('developer.inspect.asset');
    expect(names).toContain('developer.validate.workflow');
    expect(names).toContain('developer.profile');
    expect(names).toContain('developer.regex.test');
    expect(names).toContain('developer.diff');
    expect(names).toContain('developer.base64');
    expect(names).toContain('developer.hash');
    expect(names).toContain('developer.jwt.decode');
  });

  it('config.permissions 应声明 asset:read / asset:write / network:none', () => {
    const plugin = devToolsPlugin();
    expect(plugin.config.permissions).toContain('asset:read');
    expect(plugin.config.permissions).toContain('asset:write');
    expect(plugin.config.permissions).toContain('network:none');
  });
});

describe('devToolsPlugin install', () => {
  let mock: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    mock = createMockContext();
  });

  it('install 应注册 9 个能力实现', async () => {
    const plugin = devToolsPlugin();
    await plugin.install(mock.ctx);
    expect(mock.registered).toHaveLength(9);
  });

  it('install 应记录 info 日志', async () => {
    const plugin = devToolsPlugin();
    await plugin.install(mock.ctx);
    expect(mock.ctx.log).toHaveBeenCalledWith(
      'info',
      expect.stringMatching(/9 developer capabilities/)
    );
  });

  it('注册的实现 capability 名应与声明一一对应', async () => {
    const plugin = devToolsPlugin();
    await plugin.install(mock.ctx);

    const implNames = mock.registered.map((i) => i.capability).sort();
    const declNames = plugin.config.capabilities.map((c) => c.name).sort();
    expect(implNames).toEqual(declNames);
  });

  it('所有注册实现的 engine 应为 builtin(内联实现)', async () => {
    const plugin = devToolsPlugin();
    await plugin.install(mock.ctx);
    expect(mock.registered.every((i) => i.engine === 'builtin')).toBe(true);
  });

  it('所有实现的 status 应为 stable(非 stub)', async () => {
    const plugin = devToolsPlugin();
    await plugin.install(mock.ctx);
    expect(
      mock.registered.every((i) => i.status === 'stable' || i.status === undefined)
    ).toBe(true);
  });
});

describe('buildDevCapabilityImplementations', () => {
  it('应返回 9 个实现', () => {
    const { ctx } = createMockContext();
    const impls = buildDevCapabilityImplementations(ctx);
    expect(impls).toHaveLength(9);
  });

  it('每个实现的 execute 应为函数', () => {
    const { ctx } = createMockContext();
    const impls = buildDevCapabilityImplementations(ctx);
    expect(impls.every((i) => typeof i.execute === 'function')).toBe(true);
  });

  it('应包含 5 个新开发者工具实现', () => {
    const { ctx } = createMockContext();
    const impls = buildDevCapabilityImplementations(ctx);
    const names = impls.map((i) => i.capability);
    expect(names).toContain('developer.regex.test');
    expect(names).toContain('developer.diff');
    expect(names).toContain('developer.base64');
    expect(names).toContain('developer.hash');
    expect(names).toContain('developer.jwt.decode');
  });
});
