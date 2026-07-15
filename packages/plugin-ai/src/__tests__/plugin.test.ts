/**
 * AI Tools Plugin 单元测试
 *
 * 验证插件定义结构、installer 注册行为，以及 stub 能力实现。
 * engine-ai 为 stub 占位，所有操作抛 "not implemented in stub"，
 * 无需 mock 引擎操作（直接用真实 stub engine）。
 *
 * AI 能力形态异构：
 * - ocr/caption/background-remove：Blob→Blob，走 createBlobCapabilityImpl
 * - generate-workflow/optimize-workflow：params→data，自定义 impl
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  Asset,
  CapabilityImplementation,
  PluginContext,
} from '@lokvis/schema';

const { aiToolsPlugin, PLUGIN_NAME, PLUGIN_VERSION } =
  await import('../plugin.js');
const { buildAiCapabilityImplementations } = await import('../operations.js');

/** 创建一个 Mock 的 PluginContext */
function createMockContext(): {
  ctx: PluginContext;
  registered: CapabilityImplementation[];
  logs: Array<{ level: string; message: string }>;
} {
  const registered: CapabilityImplementation[] = [];
  const logs: Array<{ level: string; message: string }> = [];
  const ctx: PluginContext = {
    runtime: {
      getAsset: vi.fn(async (id: string) => ({ id }) as Asset),
      importAsset: vi.fn(async () => 'asset-id'),
      getAssetBlob: vi.fn(async (asset: Asset) =>
        new Blob([new Uint8Array([0])], { type: asset.metadata.mimeType })
      ),
      createAsset: vi.fn(async (blob: Blob, metadata, type) => ({
        id: `out-${Math.random().toString(36).slice(2)}`,
        type,
        metadata,
        blob: { path: 'memory://x', size: blob.size, mimeType: metadata.mimeType },
        history: [],
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }) as Asset),
      listCapabilities: vi.fn(async () => []),
    },
    eventBus: { on: vi.fn(), onAny: vi.fn(), emit: vi.fn(), clear: vi.fn() },
    registerCapability: vi.fn((impl) => registered.push(impl)),
    registerMetadataReader: vi.fn(),
    registerPanel: vi.fn(),
    sandbox: {
      pluginName: 'mock',
      declared: new Set(['asset:read', 'asset:write'] as const),
      has: () => true,
      assertNetworkAllowed: () => {},
      assertFilesystemAllowed: () => {},
    },
    log: vi.fn((level, message) => logs.push({ level, message })),
  };
  return { ctx, registered, logs };
}

/** 构造一个输入 Asset（图像类型，用于 ocr/caption/background-remove） */
function makeInputAsset(): Asset {
  return {
    id: 'src-1',
    type: 'image',
    metadata: {
      mimeType: 'image/png',
      size: 100,
      format: 'png',
      dimensions: { width: 200, height: 100 },
    },
    blob: { path: 'memory://src-1', size: 100, mimeType: 'image/png' },
    history: [],
    tags: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

const EXEC_CTX = {
  workflowId: 'wf',
  nodeId: 'n1',
  signal: new AbortController().signal,
  log: () => {},
};

describe('aiToolsPlugin 定义', () => {
  it('应暴露正确的插件常量', () => {
    expect(PLUGIN_NAME).toBe('lokvis-ai-tools');
    expect(PLUGIN_VERSION).toBe('0.1.0');
  });

  it('应返回 config 与 install 函数', () => {
    const plugin = aiToolsPlugin();
    expect(plugin.config.name).toBe(PLUGIN_NAME);
    expect(plugin.config.version).toBe(PLUGIN_VERSION);
    expect(typeof plugin.install).toBe('function');
  });

  it('config.capabilities 应包含全部 5 个 AI 能力声明', () => {
    const plugin = aiToolsPlugin();
    expect(plugin.config.capabilities).toHaveLength(5);
    const names = plugin.config.capabilities.map((c) => c.name);
    expect(names).toContain('ai.ocr');
    expect(names).toContain('ai.caption');
    expect(names).toContain('ai.background-remove');
    expect(names).toContain('ai.generate-workflow');
    expect(names).toContain('ai.optimize-workflow');
  });

  it('config.permissions 应声明 asset:read / asset:write / network:none', () => {
    const plugin = aiToolsPlugin();
    expect(plugin.config.permissions).toContain('asset:read');
    expect(plugin.config.permissions).toContain('asset:write');
    expect(plugin.config.permissions).toContain('network:none');
  });
});

describe('aiToolsPlugin install', () => {
  let mock: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    mock = createMockContext();
  });

  it('install 应注册 5 个能力实现', async () => {
    const plugin = aiToolsPlugin();
    await plugin.install(mock.ctx);
    expect(mock.registered).toHaveLength(5);
  });

  it('install 应记录 info 日志', async () => {
    const plugin = aiToolsPlugin();
    await plugin.install(mock.ctx);
    expect(mock.logs).toHaveLength(1);
    expect(mock.logs[0]!.level).toBe('info');
    expect(mock.logs[0]!.message).toMatch(/5 AI capabilities/);
  });

  it('注册的实现 capability 名应与声明一一对应', async () => {
    const plugin = aiToolsPlugin();
    await plugin.install(mock.ctx);

    const implNames = mock.registered.map((i) => i.capability).sort();
    const declNames = plugin.config.capabilities.map((c) => c.name).sort();
    expect(implNames).toEqual(declNames);
  });
});

describe('buildAiCapabilityImplementations', () => {
  it('应生成 5 个实现', () => {
    const { ctx } = createMockContext();
    const impls = buildAiCapabilityImplementations(ctx);
    expect(impls).toHaveLength(5);
  });

  it('所有实现 status 应为 stub（engine-ai 为 stub 占位）', () => {
    const { ctx } = createMockContext();
    const impls = buildAiCapabilityImplementations(ctx);
    expect(impls.every((i) => i.status === 'stub')).toBe(true);
  });

  it('ocr/caption/background-remove 的 engine 应为 transformers-js', () => {
    const { ctx } = createMockContext();
    const impls = buildAiCapabilityImplementations(ctx);
    const ocrImpl = impls.find((i) => i.capability === 'ai.ocr')!;
    const captionImpl = impls.find((i) => i.capability === 'ai.caption')!;
    const bgImpl = impls.find((i) => i.capability === 'ai.background-remove')!;
    expect(ocrImpl.engine).toBe('transformers-js');
    expect(captionImpl.engine).toBe('transformers-js');
    expect(bgImpl.engine).toBe('transformers-js');
  });

  it('generate-workflow/optimize-workflow 的 engine 应为 cloud-proxy', () => {
    const { ctx } = createMockContext();
    const impls = buildAiCapabilityImplementations(ctx);
    const genImpl = impls.find((i) => i.capability === 'ai.generate-workflow')!;
    const optImpl = impls.find((i) => i.capability === 'ai.optimize-workflow')!;
    expect(genImpl.engine).toBe('cloud-proxy');
    expect(optImpl.engine).toBe('cloud-proxy');
  });

  it('ocr/caption/background-remove execute 应抛 "not implemented in stub"', async () => {
    const { ctx } = createMockContext();
    const impls = buildAiCapabilityImplementations(ctx);
    const blobImpls = impls.filter((i) =>
      ['ai.ocr', 'ai.caption', 'ai.background-remove'].includes(i.capability)
    );

    for (const impl of blobImpls) {
      await expect(
        impl.execute([makeInputAsset()], {}, EXEC_CTX)
      ).rejects.toThrow(/not implemented in stub/);
    }
  });

  it('ai.generate-workflow execute 应抛 "not implemented in stub"', async () => {
    const { ctx } = createMockContext();
    const impls = buildAiCapabilityImplementations(ctx);
    const genImpl = impls.find((i) => i.capability === 'ai.generate-workflow')!;

    await expect(
      genImpl.execute([], { prompt: 'resize image' }, EXEC_CTX)
    ).rejects.toThrow(/not implemented in stub/);
  });

  it('ai.optimize-workflow execute 应抛 "not implemented in stub"', async () => {
    const { ctx } = createMockContext();
    const impls = buildAiCapabilityImplementations(ctx);
    const optImpl = impls.find((i) => i.capability === 'ai.optimize-workflow')!;

    await expect(
      optImpl.execute([], { workflow: { id: 'wf' } }, EXEC_CTX)
    ).rejects.toThrow(/not implemented in stub/);
  });

  it('空输入时 ocr 实现应抛 "requires at least one input"', async () => {
    const { ctx } = createMockContext();
    const impls = buildAiCapabilityImplementations(ctx);
    const ocrImpl = impls.find((i) => i.capability === 'ai.ocr')!;

    await expect(
      ocrImpl.execute([], {}, EXEC_CTX)
    ).rejects.toThrow(/at least one input/);
  });
});
