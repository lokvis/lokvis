/**
 * Image Tools Plugin 单元测试
 *
 * 验证插件定义结构、installer 注册行为，以及 capability 实现的包装逻辑。
 * engine-image 的实际渲染操作通过 vi.mock 替换为桩函数。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  Asset,
  CapabilityImplementation,
  MetadataReader,
  PluginContext,
} from '@lokvis/schema';

// 桩 engine-image 操作，避免依赖 Canvas / createImageBitmap
vi.mock('@lokvis/engine-image', () => ({
  canvasEngine: { version: '0.1.0' },
  resize: vi.fn(async (blob: Blob) => blob),
  compress: vi.fn(async (blob: Blob) => blob),
  convert: vi.fn(async (blob: Blob) => blob),
  crop: vi.fn(async (blob: Blob) => blob),
  rotate: vi.fn(async (blob: Blob) => blob),
  flip: vi.fn(async (blob: Blob) => blob),
  watermark: vi.fn(async (blob: Blob) => blob),
  setBackground: vi.fn(async (blob: Blob) => blob),
  filter: vi.fn(async (blob: Blob) => blob),
  encodeIco: vi.fn(async (blob: Blob) => blob),
}));

// 在 vi.mock 之后导入被测模块
const { imageToolsPlugin, PLUGIN_NAME, PLUGIN_VERSION, PLUGIN_ENGINE } =
  await import('../plugin.js');
const { buildImageCapabilityImplementations, IMAGE_OPERATION_ENTRIES } =
  await import('../operations.js');

/** 创建一个 Mock 的 PluginContext */
function createMockContext(): {
  ctx: PluginContext;
  registered: CapabilityImplementation[];
  readers: Map<string, MetadataReader>;
  logs: Array<{ level: string; message: string }>;
} {
  const registered: CapabilityImplementation[] = [];
  const readers = new Map<string, MetadataReader>();
  const logs: Array<{ level: string; message: string }> = [];
  const ctx: PluginContext = {
    runtime: {
      getAsset: vi.fn(async (id: string) => ({ id }) as Asset),
      importAsset: vi.fn(async () => 'asset-id'),
      getAssetBlob: vi.fn(async (asset: Asset) => new Blob([new Uint8Array([0])], { type: asset.metadata.mimeType })),
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
    registerMetadataReader: vi.fn((name: string, reader: MetadataReader) => {
      readers.set(name, reader);
    }),
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
  return { ctx, registered, readers, logs };
}

/** 构造一个输入 Asset */
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

describe('imageToolsPlugin 定义', () => {
  it('应暴露正确的插件常量', () => {
    expect(PLUGIN_NAME).toBe('lokvis-image-tools');
    expect(PLUGIN_VERSION).toBe('0.1.0');
    expect(PLUGIN_ENGINE).toBe('canvas');
  });

  it('应返回 config 与 install 函数', () => {
    const plugin = imageToolsPlugin();
    expect(plugin.config.name).toBe(PLUGIN_NAME);
    expect(plugin.config.version).toBe(PLUGIN_VERSION);
    expect(plugin.config.engine).toBe(PLUGIN_ENGINE);
    expect(typeof plugin.install).toBe('function');
  });

  it('config.capabilities 应包含全部 10 个图像能力声明', () => {
    const plugin = imageToolsPlugin();
    expect(plugin.config.capabilities).toHaveLength(10);
    const names = plugin.config.capabilities.map((c) => c.name);
    expect(names).toContain('image.resize');
    expect(names).toContain('image.compress');
    expect(names).toContain('image.convert');
    expect(names).toContain('image.crop');
    expect(names).toContain('image.rotate');
    expect(names).toContain('image.flip');
    expect(names).toContain('image.watermark');
    expect(names).toContain('image.background');
    expect(names).toContain('image.favicon');
  });

  it('config.permissions 应声明 asset:read / asset:write / network:none', () => {
    const plugin = imageToolsPlugin();
    expect(plugin.config.permissions).toContain('asset:read');
    expect(plugin.config.permissions).toContain('asset:write');
    expect(plugin.config.permissions).toContain('network:none');
  });
});

describe('imageToolsPlugin install', () => {
  let mock: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    mock = createMockContext();
  });

  it('install 应注册 10 个能力实现', async () => {
    const plugin = imageToolsPlugin();
    await plugin.install(mock.ctx);
    expect(mock.registered).toHaveLength(10);
  });

  it('install 应记录 info 日志', async () => {
    const plugin = imageToolsPlugin();
    await plugin.install(mock.ctx);
    expect(mock.logs).toHaveLength(1);
    expect(mock.logs[0]!.level).toBe('info');
    expect(mock.logs[0]!.message).toMatch(/10 image capabilities \+ EXIF reader/);
  });

  it('install 应注册 EXIF metadata reader', async () => {
    const plugin = imageToolsPlugin();
    await plugin.install(mock.ctx);
    expect(mock.readers.has('image.read-exif')).toBe(true);
    expect(typeof mock.readers.get('image.read-exif')).toBe('function');
  });

  it('注册的实现 capability 名应与声明一一对应', async () => {
    const plugin = imageToolsPlugin();
    await plugin.install(mock.ctx);

    const implNames = mock.registered.map((i) => i.capability).sort();
    const declNames = plugin.config.capabilities.map((c) => c.name).sort();
    expect(implNames).toEqual(declNames);
  });

  it('所有注册实现的 engine 应为 canvas', async () => {
    const plugin = imageToolsPlugin();
    await plugin.install(mock.ctx);
    expect(mock.registered.every((i) => i.engine === 'canvas')).toBe(true);
  });
});

describe('buildImageCapabilityImplementations', () => {
  it('IMAGE_OPERATION_ENTRIES 应有 10 个条目', () => {
    expect(IMAGE_OPERATION_ENTRIES).toHaveLength(10);
  });

  it('每个条目的 engine 应为 canvas', () => {
    expect(IMAGE_OPERATION_ENTRIES.every((e) => e.engine === 'canvas')).toBe(true);
  });

  it('每个条目都应有 operation 函数', () => {
    expect(IMAGE_OPERATION_ENTRIES.every((e) => typeof e.operation === 'function')).toBe(true);
  });

  it('生成的实现 execute 在空输入时应抛错', async () => {
    const { ctx } = createMockContext();
    const impls = buildImageCapabilityImplementations(ctx);
    const resizeImpl = impls.find((i) => i.capability === 'image.resize')!;

    await expect(
      resizeImpl.execute([], {}, {
        workflowId: 'wf',
        nodeId: 'n1',
        signal: new AbortController().signal,
        log: () => {},
      })
    ).rejects.toThrow(/at least one input/);
  });

  it('execute 应处理输入并返回输出 Asset', async () => {
    const { ctx, registered: _r } = createMockContext();
    const impls = buildImageCapabilityImplementations(ctx);
    const resizeImpl = impls.find((i) => i.capability === 'image.resize')!;

    const outputs = await resizeImpl.execute(
      [makeInputAsset()],
      { width: 100, height: 50 },
      {
        workflowId: 'wf',
        nodeId: 'n1',
        signal: new AbortController().signal,
        log: () => {},
      }
    );

    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('image');
    expect(outputs[0]!.metadata.format).toBe('png');
  });

  it('execute 在 signal 已 abort 时应抛 AbortError', async () => {
    const { ctx } = createMockContext();
    const impls = buildImageCapabilityImplementations(ctx);
    const resizeImpl = impls.find((i) => i.capability === 'image.resize')!;

    const controller = new AbortController();
    controller.abort();

    await expect(
      resizeImpl.execute([makeInputAsset()], { width: 100 }, {
        workflowId: 'wf',
        nodeId: 'n1',
        signal: controller.signal,
        log: () => {},
      })
    ).rejects.toThrow(/Aborted/);
  });
});
