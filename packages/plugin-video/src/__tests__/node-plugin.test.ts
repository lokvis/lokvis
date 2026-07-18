/**
 * Video Tools Plugin (Node) 单元测试
 *
 * 验证 videoToolsPluginNode() 的:
 * - 插件定义结构(engine='ffmpeg-static')
 * - installer 注册行为(7 个能力实现,全部真实)
 * - 所有操作的 isStub=false(无 stub)
 * - 真实操作经 vi.mock 验证 execute 调用链
 * - MetadataReader 注册(video.read-info)
 *
 * engine-video/node 的 7 个真实操作通过 vi.mock 替换为桩函数,
 * 避免测试依赖真实 ffmpeg-static 二进制(已在 engine-video 包内端到端验证)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  Asset,
  CapabilityImplementation,
  PluginContext,
} from '@lokvis/schema';

// 桩 engine-video/node 操作,避免依赖真实 ffmpeg-static
vi.mock('@lokvis/engine-video/node', () => ({
  compressVideo: vi.fn(async () =>
    new Blob([new Uint8Array([0])], { type: 'video/mp4' })
  ),
  transcodeVideo: vi.fn(async () =>
    new Blob([new Uint8Array([0])], { type: 'video/mp4' })
  ),
  trimVideo: vi.fn(async () =>
    new Blob([new Uint8Array([0])], { type: 'video/mp4' })
  ),
  mergeVideos: vi.fn(async () =>
    new Blob([new Uint8Array([0])], { type: 'video/mp4' })
  ),
  extractAudio: vi.fn(async () =>
    new Blob([new Uint8Array([0])], { type: 'audio/mpeg' })
  ),
  toGif: vi.fn(async () =>
    new Blob([new Uint8Array([0])], { type: 'image/gif' })
  ),
  screenshotVideo: vi.fn(async () =>
    new Blob([new Uint8Array([0])], { type: 'image/png' })
  ),
  getVideoInfo: vi.fn(async () => ({
    width: 1920,
    height: 1080,
    duration: 10,
    fps: 30,
    codec: 'h264',
  })),
}));

const { videoToolsPluginNode, PLUGIN_ENGINE_NODE, VIDEO_INFO_READER_NAME } =
  await import('../node-plugin.js');
const { PLUGIN_NAME, PLUGIN_VERSION } = await import('../plugin.js');

/** 创建一个 Mock 的 PluginContext */
function createMockContext(): {
  ctx: PluginContext;
  registered: CapabilityImplementation[];
  readers: Array<{ name: string }>;
  logs: Array<{ level: string; message: string }>;
} {
  const registered: CapabilityImplementation[] = [];
  const readers: Array<{ name: string }> = [];
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
    registerMetadataReader: vi.fn((name: string) => readers.push({ name })),
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
    type: 'video',
    metadata: {
      mimeType: 'video/mp4',
      size: 100,
      format: 'mp4',
    },
    blob: { path: 'memory://src-1', size: 100, mimeType: 'video/mp4' },
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

describe('videoToolsPluginNode 定义', () => {
  it('PLUGIN_ENGINE_NODE 应为 ffmpeg-static', () => {
    expect(PLUGIN_ENGINE_NODE).toBe('ffmpeg-static');
  });

  it('VIDEO_INFO_READER_NAME 应为 video.read-info', () => {
    expect(VIDEO_INFO_READER_NAME).toBe('video.read-info');
  });

  it('应返回 config 与 install 函数', async () => {
    const plugin = await videoToolsPluginNode();
    expect(plugin.config.name).toBe(PLUGIN_NAME);
    expect(plugin.config.version).toBe(PLUGIN_VERSION);
    expect(plugin.config.engine).toBe('ffmpeg-static');
    expect(typeof plugin.install).toBe('function');
  });

  it('config.capabilities 应包含全部 7 个视频能力声明', async () => {
    const plugin = await videoToolsPluginNode();
    expect(plugin.config.capabilities).toHaveLength(7);
    const names = plugin.config.capabilities.map((c) => c.name);
    expect(names).toContain('video.compress');
    expect(names).toContain('video.transcode');
    expect(names).toContain('video.trim');
    expect(names).toContain('video.merge');
    expect(names).toContain('video.extract-audio');
    expect(names).toContain('video.to-gif');
    expect(names).toContain('video.screenshot');
  });
});

describe('videoToolsPluginNode install', () => {
  let mock: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    mock = createMockContext();
  });

  it('install 应注册 7 个能力实现', async () => {
    const plugin = await videoToolsPluginNode();
    await plugin.install(mock.ctx);
    expect(mock.registered).toHaveLength(7);
  });

  it('所有注册实现的 engine 应为 ffmpeg-static', async () => {
    const plugin = await videoToolsPluginNode();
    await plugin.install(mock.ctx);
    expect(mock.registered.every((i) => i.engine === 'ffmpeg-static')).toBe(true);
  });

  it('所有 7 个实现 status 应非 stub(全部真实)', async () => {
    const plugin = await videoToolsPluginNode();
    await plugin.install(mock.ctx);
    expect(mock.registered.every((i) => i.status !== 'stub')).toBe(true);
  });

  it('install 应注册 video.read-info MetadataReader', async () => {
    const plugin = await videoToolsPluginNode();
    await plugin.install(mock.ctx);
    expect(mock.readers).toHaveLength(1);
    expect(mock.readers[0]!.name).toBe('video.read-info');
  });

  it('install 应记录 info 日志,包含 ffmpeg-static engine 字样', async () => {
    const plugin = await videoToolsPluginNode();
    await plugin.install(mock.ctx);
    expect(mock.logs).toHaveLength(1);
    expect(mock.logs[0]!.level).toBe('info');
    expect(mock.logs[0]!.message).toMatch(/ffmpeg-static engine/);
    expect(mock.logs[0]!.message).toMatch(/all real/);
  });

  it('注册的实现 capability 名应与声明一一对应', async () => {
    const plugin = await videoToolsPluginNode();
    await plugin.install(mock.ctx);
    const implNames = mock.registered.map((i) => i.capability).sort();
    const declNames = plugin.config.capabilities.map((c) => c.name).sort();
    expect(implNames).toEqual(declNames);
  });
});

describe('videoToolsPluginNode 真实操作行为', () => {
  let mock: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    mock = createMockContext();
  });

  it('compress 操作 execute 应处理单输入并返回 video 输出 Asset', async () => {
    const plugin = await videoToolsPluginNode();
    await plugin.install(mock.ctx);
    const compressImpl = mock.registered.find((i) => i.capability === 'video.compress')!;

    const outputs = await compressImpl.execute(
      [makeInputAsset()],
      { crf: 23 },
      EXEC_CTX
    );

    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('video');
    expect(outputs[0]!.metadata.format).toBe('mp4');
  });

  it('transcode 操作 execute 应处理单输入并返回 video 输出 Asset', async () => {
    const plugin = await videoToolsPluginNode();
    await plugin.install(mock.ctx);
    const transcodeImpl = mock.registered.find((i) => i.capability === 'video.transcode')!;

    const outputs = await transcodeImpl.execute(
      [makeInputAsset()],
      { format: 'webm' },
      EXEC_CTX
    );

    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('video');
  });

  it('trim 操作 execute 应处理单输入并返回 video 输出 Asset', async () => {
    const plugin = await videoToolsPluginNode();
    await plugin.install(mock.ctx);
    const trimImpl = mock.registered.find((i) => i.capability === 'video.trim')!;

    const outputs = await trimImpl.execute(
      [makeInputAsset()],
      { start: 0, end: 5 },
      EXEC_CTX
    );

    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('video');
  });

  it('merge 操作 execute 应处理多输入并返回单输出 video Asset', async () => {
    const plugin = await videoToolsPluginNode();
    await plugin.install(mock.ctx);
    const mergeImpl = mock.registered.find((i) => i.capability === 'video.merge')!;

    const outputs = await mergeImpl.execute(
      [makeInputAsset(), makeInputAsset()],
      {},
      EXEC_CTX
    );

    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('video');
  });

  it('extract-audio 操作 execute 应返回 audio 输出 Asset', async () => {
    const plugin = await videoToolsPluginNode();
    await plugin.install(mock.ctx);
    const extractImpl = mock.registered.find((i) => i.capability === 'video.extract-audio')!;

    const outputs = await extractImpl.execute(
      [makeInputAsset()],
      { format: 'mp3' },
      EXEC_CTX
    );

    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('audio');
    // audio/mpeg → format 'mpeg'(MIME 子类型,与 file ext 'mp3' 不同)
    expect(outputs[0]!.metadata.format).toBe('mpeg');
  });

  it('to-gif 操作 execute 应返回 image 输出 Asset', async () => {
    const plugin = await videoToolsPluginNode();
    await plugin.install(mock.ctx);
    const gifImpl = mock.registered.find((i) => i.capability === 'video.to-gif')!;

    const outputs = await gifImpl.execute(
      [makeInputAsset()],
      { fps: 10 },
      EXEC_CTX
    );

    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('image');
  });

  it('screenshot 操作 execute 应返回 image 输出 Asset', async () => {
    const plugin = await videoToolsPluginNode();
    await plugin.install(mock.ctx);
    const screenshotImpl = mock.registered.find((i) => i.capability === 'video.screenshot')!;

    const outputs = await screenshotImpl.execute(
      [makeInputAsset()],
      { time: 1.5 },
      EXEC_CTX
    );

    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('image');
  });

  it('execute 在空输入时应抛错', async () => {
    const plugin = await videoToolsPluginNode();
    await plugin.install(mock.ctx);
    const compressImpl = mock.registered.find((i) => i.capability === 'video.compress')!;

    await expect(
      compressImpl.execute([], {}, EXEC_CTX)
    ).rejects.toThrow(/at least one input/);
  });
});
