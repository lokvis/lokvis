/**
 * Image Tools Plugin (Node) 单元测试
 *
 * 验证 imageToolsPluginNode() 的:
 * - 插件定义结构(engine='sharp')
 * - installer 注册行为(9 个能力实现 + EXIF reader)
 * - 5 个真实操作 + 4 个 stub 操作的 isStub 标记
 * - stub 操作执行时抛出明确错误
 *
 * engine-image/node 的 5 个操作通过 vi.mock 替换为桩函数,
 * 避免测试依赖真实 sharp/libvips 二进制。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  Asset,
  CapabilityImplementation,
  MetadataReader,
  PluginContext,
} from '@lokvis/schema';

// 桩 engine-image/node 操作,避免依赖真实 sharp
vi.mock('@lokvis/engine-image/node', () => ({
  sharpEngine: { name: 'sharp', version: '0.1.0' },
  resize: vi.fn(async (blob: Blob) => blob),
  compress: vi.fn(async (blob: Blob) => blob),
  convert: vi.fn(async (blob: Blob) => blob),
  crop: vi.fn(async (blob: Blob) => blob),
  watermark: vi.fn(async (blob: Blob) => blob),
}));

// exifr 是真实依赖,但 readExifFromBlob 会尝试解析 blob,
// 测试中不会走到 EXIF 路径,无需 mock

const { imageToolsPluginNode, PLUGIN_ENGINE_NODE } = await import('../node-plugin.js');
const { PLUGIN_NAME, PLUGIN_VERSION } = await import('../plugin.js');

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

describe('imageToolsPluginNode 定义', () => {
  it('PLUGIN_ENGINE_NODE 应为 sharp', () => {
    expect(PLUGIN_ENGINE_NODE).toBe('sharp');
  });

  it('应返回 config 与 install 函数', async () => {
    const plugin = await imageToolsPluginNode();
    expect(plugin.config.name).toBe(PLUGIN_NAME);
    expect(plugin.config.version).toBe(PLUGIN_VERSION);
    expect(plugin.config.engine).toBe('sharp');
    expect(typeof plugin.install).toBe('function');
  });

  it('config.capabilities 应包含全部 9 个图像能力声明', async () => {
    const plugin = await imageToolsPluginNode();
    expect(plugin.config.capabilities).toHaveLength(9);
    const names = plugin.config.capabilities.map((c) => c.name);
    expect(names).toContain('image.resize');
    expect(names).toContain('image.compress');
    expect(names).toContain('image.convert');
    expect(names).toContain('image.crop');
    expect(names).toContain('image.watermark');
    expect(names).toContain('image.rotate');
    expect(names).toContain('image.flip');
    expect(names).toContain('image.background');
    expect(names).toContain('image.filter');
  });
});

describe('imageToolsPluginNode install', () => {
  let mock: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    mock = createMockContext();
  });

  it('install 应注册 9 个能力实现', async () => {
    const plugin = await imageToolsPluginNode();
    await plugin.install(mock.ctx);
    expect(mock.registered).toHaveLength(9);
  });

  it('所有注册实现的 engine 应为 sharp', async () => {
    const plugin = await imageToolsPluginNode();
    await plugin.install(mock.ctx);
    expect(mock.registered.every((i) => i.engine === 'sharp')).toBe(true);
  });

  it('5 个真实操作的 status 应非 stub', async () => {
    const plugin = await imageToolsPluginNode();
    await plugin.install(mock.ctx);
    const realCaps = ['image.resize', 'image.compress', 'image.convert', 'image.crop', 'image.watermark'];
    for (const cap of realCaps) {
      const impl = mock.registered.find((i) => i.capability === cap)!;
      expect(impl.status).not.toBe('stub');
    }
  });

  it('4 个未实现操作的 status 应为 stub', async () => {
    const plugin = await imageToolsPluginNode();
    await plugin.install(mock.ctx);
    const stubCaps = ['image.rotate', 'image.flip', 'image.background', 'image.filter'];
    for (const cap of stubCaps) {
      const impl = mock.registered.find((i) => i.capability === cap)!;
      expect(impl.status).toBe('stub');
    }
  });

  it('install 应记录 info 日志,包含 sharp engine 字样', async () => {
    const plugin = await imageToolsPluginNode();
    await plugin.install(mock.ctx);
    expect(mock.logs).toHaveLength(1);
    expect(mock.logs[0]!.level).toBe('info');
    expect(mock.logs[0]!.message).toMatch(/sharp engine/);
    expect(mock.logs[0]!.message).toMatch(/5 real \+ 4 stub/);
  });

  it('install 应注册 EXIF metadata reader', async () => {
    const plugin = await imageToolsPluginNode();
    await plugin.install(mock.ctx);
    expect(mock.readers.has('image.read-exif')).toBe(true);
    expect(typeof mock.readers.get('image.read-exif')).toBe('function');
  });

  it('注册的实现 capability 名应与声明一一对应', async () => {
    const plugin = await imageToolsPluginNode();
    await plugin.install(mock.ctx);
    const implNames = mock.registered.map((i) => i.capability).sort();
    const declNames = plugin.config.capabilities.map((c) => c.name).sort();
    expect(implNames).toEqual(declNames);
  });
});

describe('imageToolsPluginNode stub 操作行为', () => {
  let mock: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    mock = createMockContext();
  });

  it('stub 操作(rotate)execute 应抛错包含不支持提示', async () => {
    const plugin = await imageToolsPluginNode();
    await plugin.install(mock.ctx);
    const rotateImpl = mock.registered.find((i) => i.capability === 'image.rotate')!;

    await expect(
      rotateImpl.execute([makeInputAsset()], {}, {
        workflowId: 'wf',
        nodeId: 'n1',
        signal: new AbortController().signal,
        log: () => {},
      })
    ).rejects.toThrow(/not supported by the sharp engine/);
  });

  it('stub 操作(filter)execute 应抛错列出支持的操作', async () => {
    const plugin = await imageToolsPluginNode();
    await plugin.install(mock.ctx);
    const filterImpl = mock.registered.find((i) => i.capability === 'image.filter')!;

    await expect(
      filterImpl.execute([makeInputAsset()], {}, {
        workflowId: 'wf',
        nodeId: 'n1',
        signal: new AbortController().signal,
        log: () => {},
      })
    ).rejects.toThrow(/resize, compress, convert, crop, watermark/);
  });

  it('stub 操作在 signal 已 abort 时应抛 AbortError', async () => {
    const plugin = await imageToolsPluginNode();
    await plugin.install(mock.ctx);
    const rotateImpl = mock.registered.find((i) => i.capability === 'image.rotate')!;

    const controller = new AbortController();
    controller.abort();

    await expect(
      rotateImpl.execute([makeInputAsset()], {}, {
        workflowId: 'wf',
        nodeId: 'n1',
        signal: controller.signal,
        log: () => {},
      })
    ).rejects.toThrow(/Aborted/);
  });
});

describe('imageToolsPluginNode 真实操作行为', () => {
  let mock: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    mock = createMockContext();
  });

  it('resize 操作 execute 应处理输入并返回输出 Asset', async () => {
    const plugin = await imageToolsPluginNode();
    await plugin.install(mock.ctx);
    const resizeImpl = mock.registered.find((i) => i.capability === 'image.resize')!;

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

  it('execute 在空输入时应抛错', async () => {
    const plugin = await imageToolsPluginNode();
    await plugin.install(mock.ctx);
    const resizeImpl = mock.registered.find((i) => i.capability === 'image.resize')!;

    await expect(
      resizeImpl.execute([], {}, {
        workflowId: 'wf',
        nodeId: 'n1',
        signal: new AbortController().signal,
        log: () => {},
      })
    ).rejects.toThrow(/at least one input/);
  });
});
