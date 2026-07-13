/**
 * PDF Tools Plugin 单元测试
 *
 * 验证插件定义结构、installer 注册行为，以及 stub 能力实现。
 * engine-pdf 为 stub 占位，所有操作抛 "not implemented in stub"，
 * 无需 mock 引擎操作（直接用真实 stub engine）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  Asset,
  CapabilityImplementation,
  PluginContext,
} from '@lokvis/schema';

const { pdfToolsPlugin, PLUGIN_NAME, PLUGIN_VERSION, PLUGIN_ENGINE } =
  await import('../plugin.js');
const {
  buildPdfCapabilityImplementations,
  PDF_OPERATION_ENTRIES,
} = await import('../operations.js');

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
    log: vi.fn((level, message) => logs.push({ level, message })),
  };
  return { ctx, registered, logs };
}

/** 构造一个输入 Asset */
function makeInputAsset(): Asset {
  return {
    id: 'src-1',
    type: 'pdf',
    metadata: {
      mimeType: 'application/pdf',
      size: 100,
      format: 'pdf',
    },
    blob: { path: 'memory://src-1', size: 100, mimeType: 'application/pdf' },
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

describe('pdfToolsPlugin 定义', () => {
  it('应暴露正确的插件常量', () => {
    expect(PLUGIN_NAME).toBe('lokvis-pdf-tools');
    expect(PLUGIN_VERSION).toBe('0.1.0');
    expect(PLUGIN_ENGINE).toBe('pdf-lib');
  });

  it('应返回 config 与 install 函数', () => {
    const plugin = pdfToolsPlugin();
    expect(plugin.config.name).toBe(PLUGIN_NAME);
    expect(plugin.config.version).toBe(PLUGIN_VERSION);
    expect(plugin.config.engine).toBe(PLUGIN_ENGINE);
    expect(typeof plugin.install).toBe('function');
  });

  it('config.capabilities 应包含全部 7 个 PDF 能力声明', () => {
    const plugin = pdfToolsPlugin();
    expect(plugin.config.capabilities).toHaveLength(7);
    const names = plugin.config.capabilities.map((c) => c.name);
    expect(names).toContain('pdf.merge');
    expect(names).toContain('pdf.split');
    expect(names).toContain('pdf.compress');
    expect(names).toContain('pdf.rotate');
    expect(names).toContain('pdf.watermark');
    expect(names).toContain('pdf.ocr');
    expect(names).toContain('pdf.sign');
  });

  it('config.permissions 应声明 asset:read / asset:write / network:none', () => {
    const plugin = pdfToolsPlugin();
    expect(plugin.config.permissions).toContain('asset:read');
    expect(plugin.config.permissions).toContain('asset:write');
    expect(plugin.config.permissions).toContain('network:none');
  });
});

describe('pdfToolsPlugin install', () => {
  let mock: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    mock = createMockContext();
  });

  it('install 应注册 7 个能力实现', async () => {
    const plugin = pdfToolsPlugin();
    await plugin.install(mock.ctx);
    expect(mock.registered).toHaveLength(7);
  });

  it('install 应记录 info 日志', async () => {
    const plugin = pdfToolsPlugin();
    await plugin.install(mock.ctx);
    expect(mock.logs).toHaveLength(1);
    expect(mock.logs[0]!.level).toBe('info');
    expect(mock.logs[0]!.message).toMatch(/7 pdf capabilities/);
  });

  it('注册的实现 capability 名应与声明一一对应', async () => {
    const plugin = pdfToolsPlugin();
    await plugin.install(mock.ctx);

    const implNames = mock.registered.map((i) => i.capability).sort();
    const declNames = plugin.config.capabilities.map((c) => c.name).sort();
    expect(implNames).toEqual(declNames);
  });
});

describe('buildPdfCapabilityImplementations', () => {
  it('PDF_OPERATION_ENTRIES 应有 7 个条目', () => {
    expect(PDF_OPERATION_ENTRIES).toHaveLength(7);
  });

  it('每个条目的 engine 应为 pdf-lib', () => {
    expect(PDF_OPERATION_ENTRIES.every((e) => e.engine === 'pdf-lib')).toBe(true);
  });

  it('每个条目都应有 operation 函数', () => {
    expect(PDF_OPERATION_ENTRIES.every((e) => typeof e.operation === 'function')).toBe(true);
  });

  it('应生成 7 个实现', () => {
    const { ctx } = createMockContext();
    const impls = buildPdfCapabilityImplementations(ctx);
    expect(impls).toHaveLength(7);
  });

  it('所有实现 status 应为 stub（engine-pdf 为 stub 占位）', () => {
    const { ctx } = createMockContext();
    const impls = buildPdfCapabilityImplementations(ctx);
    expect(impls.every((i) => i.status === 'stub')).toBe(true);
  });

  it('所有实现 engine 应为 pdf-lib', () => {
    const { ctx } = createMockContext();
    const impls = buildPdfCapabilityImplementations(ctx);
    expect(impls.every((i) => i.engine === 'pdf-lib')).toBe(true);
  });

  it('各 single 实现 execute 应抛 "not implemented in stub"', async () => {
    const { ctx } = createMockContext();
    const impls = buildPdfCapabilityImplementations(ctx);
    const singleImpls = impls.filter(
      (i) => !['pdf.merge', 'pdf.split'].includes(i.capability)
    );

    for (const impl of singleImpls) {
      await expect(
        impl.execute([makeInputAsset()], {}, EXEC_CTX)
      ).rejects.toThrow(/not implemented in stub/);
    }
  });

  it('pdf.merge 实现 execute 应抛 "not implemented in stub"', async () => {
    const { ctx } = createMockContext();
    const impls = buildPdfCapabilityImplementations(ctx);
    const mergeImpl = impls.find((i) => i.capability === 'pdf.merge')!;

    await expect(
      mergeImpl.execute([makeInputAsset(), makeInputAsset()], {}, EXEC_CTX)
    ).rejects.toThrow(/not implemented in stub/);
  });

  it('pdf.split 实现 execute 应抛 "not implemented in stub"', async () => {
    const { ctx } = createMockContext();
    const impls = buildPdfCapabilityImplementations(ctx);
    const splitImpl = impls.find((i) => i.capability === 'pdf.split')!;

    await expect(
      splitImpl.execute([makeInputAsset()], {}, EXEC_CTX)
    ).rejects.toThrow(/not implemented in stub/);
  });

  it('空输入时 single 实现应抛 "requires at least one input"', async () => {
    const { ctx } = createMockContext();
    const impls = buildPdfCapabilityImplementations(ctx);
    const compressImpl = impls.find((i) => i.capability === 'pdf.compress')!;

    await expect(
      compressImpl.execute([], {}, EXEC_CTX)
    ).rejects.toThrow(/at least one input/);
  });
});
