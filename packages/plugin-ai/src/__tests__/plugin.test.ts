/**
 * AI Tools Plugin 单元测试(F1)
 *
 * 验证插件定义结构、installer 注册行为,以及 stub/live 实现路径。
 *
 * F1 变更:
 * - 6 个能力(原 5 个 + 新增 ai.diagnose-error)
 * - 测试 cloudCaller 注入与不注入两种路径
 *   - 不注入:3 个 cloud-proxy 能力 status='stub',execute 抛错
 *   - 注入  :3 个 cloud-proxy 能力 status='stable',execute 委托 caller
 *
 * AI 能力形态异构:
 * - ocr/caption/background-remove:Blob→Blob,走 createBlobCapabilityImpl
 * - generate-workflow/optimize-workflow/diagnose-error:params→data,自定义 impl
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  Asset,
  CapabilityImplementation,
  PluginContext,
} from '@lokvis/schema';
import type { AiCloudCaller, DiagnoseErrorReport } from '@lokvis/engine-ai';

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

/** 构造一个输入 Asset(图像类型,用于 ocr/caption/background-remove) */
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

/** Mock AiCloudCaller:回显参数,便于验证 caller 调用 */
function createMockCaller(): AiCloudCaller & {
  calls: Array<{ method: string; params: unknown }>;
} {
  const calls: Array<{ method: string; params: unknown }> = [];
  return {
    calls,
    generateWorkflow: async (params) => {
      calls.push({ method: 'generateWorkflow', params });
      return { generated: true, prompt: params.prompt };
    },
    optimizeWorkflow: async (params) => {
      calls.push({ method: 'optimizeWorkflow', params });
      return { optimized: true };
    },
    diagnoseError: async (params): Promise<DiagnoseErrorReport> => {
      calls.push({ method: 'diagnoseError', params });
      return {
        rootCause: 'mock cause',
        remediation: ['fix1'],
        suspectNodeId: params.nodeId,
        severity: 'error',
      };
    },
  };
}

describe('aiToolsPlugin 定义', () => {
  it('应暴露正确的插件常量', () => {
    expect(PLUGIN_NAME).toBe('lokvis-ai-tools');
    expect(PLUGIN_VERSION).toBe('0.2.0');
  });

  it('应返回 config 与 install 函数', () => {
    const plugin = aiToolsPlugin();
    expect(plugin.config.name).toBe(PLUGIN_NAME);
    expect(plugin.config.version).toBe(PLUGIN_VERSION);
    expect(typeof plugin.install).toBe('function');
  });

  it('config.capabilities 应包含全部 6 个 AI 能力声明', () => {
    const plugin = aiToolsPlugin();
    expect(plugin.config.capabilities).toHaveLength(6);
    const names = plugin.config.capabilities.map((c) => c.name);
    expect(names).toContain('ai.ocr');
    expect(names).toContain('ai.caption');
    expect(names).toContain('ai.background-remove');
    expect(names).toContain('ai.generate-workflow');
    expect(names).toContain('ai.optimize-workflow');
    expect(names).toContain('ai.diagnose-error');
  });

  it('config.permissions 应声明 asset:read / asset:write / network:none', () => {
    const plugin = aiToolsPlugin();
    expect(plugin.config.permissions).toContain('asset:read');
    expect(plugin.config.permissions).toContain('asset:write');
    expect(plugin.config.permissions).toContain('network:none');
  });
});

describe('aiToolsPlugin install(无 cloudCaller)', () => {
  let mock: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    mock = createMockContext();
  });

  it('install 应注册 6 个能力实现', async () => {
    const plugin = aiToolsPlugin();
    await plugin.install(mock.ctx);
    expect(mock.registered).toHaveLength(6);
  });

  it('install 应记录 info 日志含 "stub"', async () => {
    const plugin = aiToolsPlugin();
    await plugin.install(mock.ctx);
    expect(mock.logs).toHaveLength(1);
    expect(mock.logs[0]!.level).toBe('info');
    expect(mock.logs[0]!.message).toMatch(/6 AI capabilities/);
    expect(mock.logs[0]!.message).toMatch(/cloud-proxy: stub/);
  });

  it('注册的实现 capability 名应与声明一一对应', async () => {
    const plugin = aiToolsPlugin();
    await plugin.install(mock.ctx);

    const implNames = mock.registered.map((i) => i.capability).sort();
    const declNames = plugin.config.capabilities.map((c) => c.name).sort();
    expect(implNames).toEqual(declNames);
  });
});

describe('aiToolsPlugin install(有 cloudCaller)', () => {
  let mock: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    mock = createMockContext();
  });

  it('install 应注册 6 个能力实现', async () => {
    const plugin = aiToolsPlugin({ cloudCaller: createMockCaller() });
    await plugin.install(mock.ctx);
    expect(mock.registered).toHaveLength(6);
  });

  it('install 应记录 info 日志含 "live"', async () => {
    const plugin = aiToolsPlugin({ cloudCaller: createMockCaller() });
    await plugin.install(mock.ctx);
    expect(mock.logs[0]!.message).toMatch(/cloud-proxy: live/);
  });
});

describe('buildAiCapabilityImplementations(无 caller)', () => {
  it('应生成 6 个实现', () => {
    const { ctx } = createMockContext();
    const impls = buildAiCapabilityImplementations(ctx);
    expect(impls).toHaveLength(6);
  });

  it('所有实现 status 应为 stub(无 caller + transformers stub)', () => {
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

  it('generate-workflow/optimize-workflow/diagnose-error 的 engine 应为 cloud-proxy', () => {
    const { ctx } = createMockContext();
    const impls = buildAiCapabilityImplementations(ctx);
    const genImpl = impls.find((i) => i.capability === 'ai.generate-workflow')!;
    const optImpl = impls.find((i) => i.capability === 'ai.optimize-workflow')!;
    const diagImpl = impls.find((i) => i.capability === 'ai.diagnose-error')!;
    expect(genImpl.engine).toBe('cloud-proxy');
    expect(optImpl.engine).toBe('cloud-proxy');
    expect(diagImpl.engine).toBe('cloud-proxy');
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

  it('ai.diagnose-error execute 应抛 "not implemented in stub"', async () => {
    const { ctx } = createMockContext();
    const impls = buildAiCapabilityImplementations(ctx);
    const diagImpl = impls.find((i) => i.capability === 'ai.diagnose-error')!;

    await expect(
      diagImpl.execute([], { error: { message: 'fail' } }, EXEC_CTX)
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

describe('buildAiCapabilityImplementations(有 caller)', () => {
  it('3 个 cloud-proxy 实现 status 应为 stable', () => {
    const { ctx } = createMockContext();
    const caller = createMockCaller();
    const impls = buildAiCapabilityImplementations(ctx, caller);
    const cloudImpls = impls.filter((i) => i.engine === 'cloud-proxy');
    expect(cloudImpls).toHaveLength(3);
    expect(cloudImpls.every((i) => i.status === 'stable')).toBe(true);
  });

  it('3 个 transformers 实现 status 仍为 stub', () => {
    const { ctx } = createMockContext();
    const caller = createMockCaller();
    const impls = buildAiCapabilityImplementations(ctx, caller);
    const trImpls = impls.filter((i) => i.engine === 'transformers-js');
    expect(trImpls).toHaveLength(3);
    expect(trImpls.every((i) => i.status === 'stub')).toBe(true);
  });

  it('ai.generate-workflow 应委托 caller.generateWorkflow', async () => {
    const { ctx } = createMockContext();
    const caller = createMockCaller();
    const impls = buildAiCapabilityImplementations(ctx, caller);
    const genImpl = impls.find((i) => i.capability === 'ai.generate-workflow')!;

    const outputs = await genImpl.execute(
      [],
      { prompt: 'resize to 800x600' },
      EXEC_CTX
    );
    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('data');
    expect(caller.calls[0]!.method).toBe('generateWorkflow');
    expect(caller.calls[0]!.params).toMatchObject({
      prompt: 'resize to 800x600',
    });
  });

  it('ai.optimize-workflow 应委托 caller.optimizeWorkflow', async () => {
    const { ctx } = createMockContext();
    const caller = createMockCaller();
    const impls = buildAiCapabilityImplementations(ctx, caller);
    const optImpl = impls.find((i) => i.capability === 'ai.optimize-workflow')!;

    const outputs = await optImpl.execute(
      [],
      { workflow: { id: 'wf' }, prompt: 'faster' },
      EXEC_CTX
    );
    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('data');
    expect(caller.calls[0]!.method).toBe('optimizeWorkflow');
  });

  it('ai.diagnose-error 应委托 caller.diagnoseError', async () => {
    const { ctx } = createMockContext();
    const caller = createMockCaller();
    const impls = buildAiCapabilityImplementations(ctx, caller);
    const diagImpl = impls.find((i) => i.capability === 'ai.diagnose-error')!;

    const outputs = await diagImpl.execute(
      [],
      { error: { message: 'exec failed' }, nodeId: 'node-3' },
      EXEC_CTX
    );
    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('data');
    expect(caller.calls[0]!.method).toBe('diagnoseError');
    expect(caller.calls[0]!.params).toMatchObject({
      nodeId: 'node-3',
    });
  });

  it('cloud-proxy execute 成功时应报告进度 onProgress', async () => {
    const { ctx } = createMockContext();
    const caller = createMockCaller();
    const impls = buildAiCapabilityImplementations(ctx, caller);
    const genImpl = impls.find((i) => i.capability === 'ai.generate-workflow')!;
    const onProgress = vi.fn();

    await genImpl.execute([], { prompt: 'x' }, { ...EXEC_CTX, onProgress });
    expect(onProgress).toHaveBeenCalled();
    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
    expect(lastCall![0]).toBe(1);
  });
});
