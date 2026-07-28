/**
 * PDF Tools Plugin (Node) 单元测试
 *
 * 验证 pdfToolsPluginNode() 的:
 * - 插件定义结构(engine='pdf-lib')
 * - installer 注册行为(8 个能力实现:6 真实 + 2 stub)
 * - 6 个真实操作(merge/split/compress/rotate/watermark/add-page-numbers)的 isStub 标记
 * - 2 个 stub 操作(ocr/sign)的 isStub 标记
 * - stub 操作执行时抛出明确错误
 *
 * engine-pdf 的 6 个真实操作通过 vi.mock 替换为桩函数,
 * 避免测试依赖真实 pdf-lib 二进制加载(已在 engine-pdf 包内端到端验证)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  Asset,
  CapabilityImplementation,
  PluginContext,
} from '@lokvis/schema';

// 桩 engine-pdf 操作,避免依赖真实 pdf-lib
vi.mock('@lokvis/engine-pdf', () => ({
  mergePdfs: vi.fn(async () =>
    new Blob([new Uint8Array([0])], { type: 'application/pdf' })
  ),
  splitPdf: vi.fn(async () => [
    new Blob([new Uint8Array([0])], { type: 'application/pdf' }),
  ]),
  compressPdf: vi.fn(async () =>
    new Blob([new Uint8Array([0])], { type: 'application/pdf' })
  ),
  rotatePdf: vi.fn(async () =>
    new Blob([new Uint8Array([0])], { type: 'application/pdf' })
  ),
  addWatermark: vi.fn(async () =>
    new Blob([new Uint8Array([0])], { type: 'application/pdf' })
  ),
  addPageNumbers: vi.fn(async () =>
    new Blob([new Uint8Array([0])], { type: 'application/pdf' })
  ),
  getPdfInfo: vi.fn(async () => ({ pages: 1 })),
}));

const { pdfToolsPluginNode, PLUGIN_ENGINE_NODE } = await import('../node-plugin.js');
const { PLUGIN_NAME, PLUGIN_VERSION } = await import('../plugin.js');

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

describe('pdfToolsPluginNode 定义', () => {
  it('PLUGIN_ENGINE_NODE 应为 pdf-lib', () => {
    expect(PLUGIN_ENGINE_NODE).toBe('pdf-lib');
  });

  it('应返回 config 与 install 函数', async () => {
    const plugin = await pdfToolsPluginNode();
    expect(plugin.config.name).toBe(PLUGIN_NAME);
    expect(plugin.config.version).toBe(PLUGIN_VERSION);
    expect(plugin.config.engine).toBe('pdf-lib');
    expect(typeof plugin.install).toBe('function');
  });

  it('config.capabilities 应包含全部 8 个 PDF 能力声明', async () => {
    const plugin = await pdfToolsPluginNode();
    expect(plugin.config.capabilities).toHaveLength(8);
    const names = plugin.config.capabilities.map((c) => c.name);
    expect(names).toContain('pdf.merge');
    expect(names).toContain('pdf.split');
    expect(names).toContain('pdf.compress');
    expect(names).toContain('pdf.rotate');
    expect(names).toContain('pdf.watermark');
    expect(names).toContain('pdf.add-page-numbers');
    expect(names).toContain('pdf.ocr');
    expect(names).toContain('pdf.sign');
  });
});

describe('pdfToolsPluginNode install', () => {
  let mock: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    mock = createMockContext();
  });

  it('install 应注册 8 个能力实现', async () => {
    const plugin = await pdfToolsPluginNode();
    await plugin.install(mock.ctx);
    expect(mock.registered).toHaveLength(8);
  });

  it('所有注册实现的 engine 应为 pdf-lib', async () => {
    const plugin = await pdfToolsPluginNode();
    await plugin.install(mock.ctx);
    expect(mock.registered.every((i) => i.engine === 'pdf-lib')).toBe(true);
  });

  it('6 个真实操作(merge/split/compress/rotate/watermark/add-page-numbers)的 status 应非 stub', async () => {
    const plugin = await pdfToolsPluginNode();
    await plugin.install(mock.ctx);
    const realCaps = ['pdf.merge', 'pdf.split', 'pdf.compress', 'pdf.rotate', 'pdf.watermark', 'pdf.add-page-numbers'];
    for (const cap of realCaps) {
      const impl = mock.registered.find((i) => i.capability === cap)!;
      expect(impl.status).not.toBe('stub');
    }
  });

  it('2 个 stub 操作(ocr/sign)的 status 应为 stub', async () => {
    const plugin = await pdfToolsPluginNode();
    await plugin.install(mock.ctx);
    const stubCaps = ['pdf.ocr', 'pdf.sign'];
    for (const cap of stubCaps) {
      const impl = mock.registered.find((i) => i.capability === cap)!;
      expect(impl.status).toBe('stub');
    }
  });

  it('install 应记录 info 日志,包含 pdf-lib engine 字样', async () => {
    const plugin = await pdfToolsPluginNode();
    await plugin.install(mock.ctx);
    expect(mock.logs).toHaveLength(1);
    expect(mock.logs[0]!.level).toBe('info');
    expect(mock.logs[0]!.message).toMatch(/pdf-lib engine/);
    expect(mock.logs[0]!.message).toMatch(/6 real \+ 2 stub/);
  });

  it('注册的实现 capability 名应与声明一一对应', async () => {
    const plugin = await pdfToolsPluginNode();
    await plugin.install(mock.ctx);
    const implNames = mock.registered.map((i) => i.capability).sort();
    const declNames = plugin.config.capabilities.map((c) => c.name).sort();
    expect(implNames).toEqual(declNames);
  });
});

describe('pdfToolsPluginNode stub 操作行为', () => {
  let mock: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    mock = createMockContext();
  });

  it('stub 操作(ocr)execute 应抛错包含不支持提示', async () => {
    const plugin = await pdfToolsPluginNode();
    await plugin.install(mock.ctx);
    const ocrImpl = mock.registered.find((i) => i.capability === 'pdf.ocr')!;

    await expect(
      ocrImpl.execute([makeInputAsset()], {}, EXEC_CTX)
    ).rejects.toThrow(/not supported by the pdf-lib engine/);
  });

  it('stub 操作(ocr)execute 应抛错列出支持的操作', async () => {
    const plugin = await pdfToolsPluginNode();
    await plugin.install(mock.ctx);
    const ocrImpl = mock.registered.find((i) => i.capability === 'pdf.ocr')!;

    await expect(
      ocrImpl.execute([makeInputAsset()], {}, EXEC_CTX)
    ).rejects.toThrow(/merge, split, compress, rotate, watermark/);
  });

  it('stub 操作(sign)execute 应抛错列出未来支持的操作', async () => {
    const plugin = await pdfToolsPluginNode();
    await plugin.install(mock.ctx);
    const signImpl = mock.registered.find((i) => i.capability === 'pdf.sign')!;

    await expect(
      signImpl.execute([makeInputAsset()], {}, EXEC_CTX)
    ).rejects.toThrow(/ocr \(Phase 3\), sign \(Phase 4\)/);
  });
});

describe('pdfToolsPluginNode 真实操作行为', () => {
  let mock: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    mock = createMockContext();
  });

  it('merge 操作 execute 应处理多输入并返回单输出 Asset', async () => {
    const plugin = await pdfToolsPluginNode();
    await plugin.install(mock.ctx);
    const mergeImpl = mock.registered.find((i) => i.capability === 'pdf.merge')!;

    const outputs = await mergeImpl.execute(
      [makeInputAsset(), makeInputAsset()],
      {},
      EXEC_CTX
    );

    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('pdf');
    expect(outputs[0]!.metadata.format).toBe('pdf');
  });

  it('compress 操作 execute 应处理单输入并返回单输出 Asset', async () => {
    const plugin = await pdfToolsPluginNode();
    await plugin.install(mock.ctx);
    const compressImpl = mock.registered.find((i) => i.capability === 'pdf.compress')!;

    const outputs = await compressImpl.execute(
      [makeInputAsset()],
      { level: 6 },
      EXEC_CTX
    );

    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('pdf');
    expect(outputs[0]!.metadata.format).toBe('pdf');
  });

  it('split 操作 execute 应返回多输出 Asset(1→N)', async () => {
    const plugin = await pdfToolsPluginNode();
    await plugin.install(mock.ctx);
    const splitImpl = mock.registered.find((i) => i.capability === 'pdf.split')!;

    const outputs = await splitImpl.execute(
      [makeInputAsset()],
      { pagesPerFile: 1 },
      EXEC_CTX
    );

    // vi.mock 的 splitPdf 返回 1 个 Blob → 1 个输出 Asset
    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('data');
  });

  it('rotate 操作 execute 应处理单输入并返回单输出 Asset', async () => {
    const plugin = await pdfToolsPluginNode();
    await plugin.install(mock.ctx);
    const rotateImpl = mock.registered.find((i) => i.capability === 'pdf.rotate')!;

    const outputs = await rotateImpl.execute(
      [makeInputAsset()],
      { angle: 90 },
      EXEC_CTX
    );

    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('pdf');
    expect(outputs[0]!.metadata.format).toBe('pdf');
  });

  it('watermark 操作 execute 应处理单输入并返回单输出 Asset', async () => {
    const plugin = await pdfToolsPluginNode();
    await plugin.install(mock.ctx);
    const watermarkImpl = mock.registered.find((i) => i.capability === 'pdf.watermark')!;

    const outputs = await watermarkImpl.execute(
      [makeInputAsset()],
      { text: 'CONFIDENTIAL' },
      EXEC_CTX
    );

    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('pdf');
    expect(outputs[0]!.metadata.format).toBe('pdf');
  });

  it('add-page-numbers 操作 execute 应处理单输入并返回单输出 Asset', async () => {
    const plugin = await pdfToolsPluginNode();
    await plugin.install(mock.ctx);
    const pageNumbersImpl = mock.registered.find((i) => i.capability === 'pdf.add-page-numbers')!;

    const outputs = await pageNumbersImpl.execute(
      [makeInputAsset()],
      { position: 'bottom-center' },
      EXEC_CTX
    );

    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('pdf');
    expect(outputs[0]!.metadata.format).toBe('pdf');
  });

  it('execute 在空输入时应抛错', async () => {
    const plugin = await pdfToolsPluginNode();
    await plugin.install(mock.ctx);
    const compressImpl = mock.registered.find((i) => i.capability === 'pdf.compress')!;

    await expect(
      compressImpl.execute([], {}, EXEC_CTX)
    ).rejects.toThrow(/at least one input/);
  });
});
