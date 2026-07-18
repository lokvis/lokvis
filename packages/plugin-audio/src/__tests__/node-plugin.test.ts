/**
 * Audio Tools Plugin (Node) 单元测试
 *
 * 验证 audioToolsPluginNode() 的:
 * - 插件定义结构(engine='ffmpeg-static')
 * - installer 注册行为(4 个能力实现,全部真实)
 * - 所有操作的 isStub=false(无 stub)
 * - 真实操作经 vi.mock 验证 execute 调用链
 *
 * engine-audio/node 的 4 个真实操作通过 vi.mock 替换为桩函数,
 * 避免测试依赖真实 ffmpeg-static 二进制(已在 engine-audio 包内端到端验证)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  Asset,
  CapabilityImplementation,
  PluginContext,
} from '@lokvis/schema';

// 桩 engine-audio/node 操作,避免依赖真实 ffmpeg-static
vi.mock('@lokvis/engine-audio/node', () => ({
  trimAudio: vi.fn(async () =>
    new Blob([new Uint8Array([0])], { type: 'audio/mpeg' })
  ),
  mergeAudios: vi.fn(async () =>
    new Blob([new Uint8Array([0])], { type: 'audio/mpeg' })
  ),
  transcodeAudio: vi.fn(async () =>
    new Blob([new Uint8Array([0])], { type: 'audio/mpeg' })
  ),
  normalizeAudio: vi.fn(async () =>
    new Blob([new Uint8Array([0])], { type: 'audio/mpeg' })
  ),
}));

const { audioToolsPluginNode, PLUGIN_ENGINE_NODE } =
  await import('../node-plugin.js');
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
    type: 'audio',
    metadata: {
      mimeType: 'audio/mpeg',
      size: 100,
      format: 'mp3',
    },
    blob: { path: 'memory://src-1', size: 100, mimeType: 'audio/mpeg' },
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

describe('audioToolsPluginNode 定义', () => {
  it('PLUGIN_ENGINE_NODE 应为 ffmpeg-static', () => {
    expect(PLUGIN_ENGINE_NODE).toBe('ffmpeg-static');
  });

  it('应返回 config 与 install 函数', async () => {
    const plugin = await audioToolsPluginNode();
    expect(plugin.config.name).toBe(PLUGIN_NAME);
    expect(plugin.config.version).toBe(PLUGIN_VERSION);
    expect(plugin.config.engine).toBe('ffmpeg-static');
    expect(typeof plugin.install).toBe('function');
  });

  it('config.capabilities 应包含全部 4 个音频能力声明', async () => {
    const plugin = await audioToolsPluginNode();
    expect(plugin.config.capabilities).toHaveLength(4);
    const names = plugin.config.capabilities.map((c) => c.name);
    expect(names).toContain('audio.trim');
    expect(names).toContain('audio.normalize');
    expect(names).toContain('audio.merge');
    expect(names).toContain('audio.transcode');
  });
});

describe('audioToolsPluginNode install', () => {
  let mock: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    mock = createMockContext();
  });

  it('install 应注册 4 个能力实现', async () => {
    const plugin = await audioToolsPluginNode();
    await plugin.install(mock.ctx);
    expect(mock.registered).toHaveLength(4);
  });

  it('所有注册实现的 engine 应为 ffmpeg-static', async () => {
    const plugin = await audioToolsPluginNode();
    await plugin.install(mock.ctx);
    expect(mock.registered.every((i) => i.engine === 'ffmpeg-static')).toBe(true);
  });

  it('所有 4 个实现 status 应非 stub(全部真实)', async () => {
    const plugin = await audioToolsPluginNode();
    await plugin.install(mock.ctx);
    expect(mock.registered.every((i) => i.status !== 'stub')).toBe(true);
  });

  it('install 应记录 info 日志,包含 ffmpeg-static engine 字样', async () => {
    const plugin = await audioToolsPluginNode();
    await plugin.install(mock.ctx);
    expect(mock.logs).toHaveLength(1);
    expect(mock.logs[0]!.level).toBe('info');
    expect(mock.logs[0]!.message).toMatch(/ffmpeg-static engine/);
    expect(mock.logs[0]!.message).toMatch(/all real/);
  });

  it('注册的实现 capability 名应与声明一一对应', async () => {
    const plugin = await audioToolsPluginNode();
    await plugin.install(mock.ctx);
    const implNames = mock.registered.map((i) => i.capability).sort();
    const declNames = plugin.config.capabilities.map((c) => c.name).sort();
    expect(implNames).toEqual(declNames);
  });
});

describe('audioToolsPluginNode 真实操作行为', () => {
  let mock: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    mock = createMockContext();
  });

  it('trim 操作 execute 应处理单输入并返回 audio 输出 Asset', async () => {
    const plugin = await audioToolsPluginNode();
    await plugin.install(mock.ctx);
    const trimImpl = mock.registered.find((i) => i.capability === 'audio.trim')!;

    const outputs = await trimImpl.execute(
      [makeInputAsset()],
      { start: 0, end: 10 },
      EXEC_CTX
    );

    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('audio');
  });

  it('normalize 操作 execute 应处理单输入并返回 audio 输出 Asset', async () => {
    const plugin = await audioToolsPluginNode();
    await plugin.install(mock.ctx);
    const normalizeImpl = mock.registered.find((i) => i.capability === 'audio.normalize')!;

    const outputs = await normalizeImpl.execute(
      [makeInputAsset()],
      { level: -16 },
      EXEC_CTX
    );

    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('audio');
  });

  it('transcode 操作 execute 应处理单输入并返回 audio 输出 Asset', async () => {
    const plugin = await audioToolsPluginNode();
    await plugin.install(mock.ctx);
    const transcodeImpl = mock.registered.find((i) => i.capability === 'audio.transcode')!;

    const outputs = await transcodeImpl.execute(
      [makeInputAsset()],
      { format: 'mp3' },
      EXEC_CTX
    );

    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('audio');
  });

  it('merge 操作 execute 应处理多输入并返回单输出 audio Asset', async () => {
    const plugin = await audioToolsPluginNode();
    await plugin.install(mock.ctx);
    const mergeImpl = mock.registered.find((i) => i.capability === 'audio.merge')!;

    const outputs = await mergeImpl.execute(
      [makeInputAsset(), makeInputAsset()],
      {},
      EXEC_CTX
    );

    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('audio');
  });

  it('execute 在空输入时应抛错', async () => {
    const plugin = await audioToolsPluginNode();
    await plugin.install(mock.ctx);
    const trimImpl = mock.registered.find((i) => i.capability === 'audio.trim')!;

    await expect(
      trimImpl.execute([], {}, EXEC_CTX)
    ).rejects.toThrow(/at least one input/);
  });
});
