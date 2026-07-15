/**
 * Audio Tools Plugin 单元测试
 *
 * 验证插件定义结构、installer 注册行为，以及 stub 能力实现。
 * engine-audio 为 stub 占位，所有操作抛 "not implemented in stub"，
 * 无需 mock 引擎操作（直接用真实 stub engine）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  Asset,
  CapabilityImplementation,
  PluginContext,
} from '@lokvis/schema';

const { audioToolsPlugin, PLUGIN_NAME, PLUGIN_VERSION } =
  await import('../plugin.js');
const {
  buildAudioCapabilityImplementations,
  AUDIO_OPERATION_ENTRIES,
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

describe('audioToolsPlugin 定义', () => {
  it('应暴露正确的插件常量', () => {
    expect(PLUGIN_NAME).toBe('lokvis-audio-tools');
    expect(PLUGIN_VERSION).toBe('0.1.0');
  });

  it('应返回 config 与 install 函数', () => {
    const plugin = audioToolsPlugin();
    expect(plugin.config.name).toBe(PLUGIN_NAME);
    expect(plugin.config.version).toBe(PLUGIN_VERSION);
    expect(typeof plugin.install).toBe('function');
  });

  it('config.capabilities 应包含全部 4 个音频能力声明', () => {
    const plugin = audioToolsPlugin();
    expect(plugin.config.capabilities).toHaveLength(4);
    const names = plugin.config.capabilities.map((c) => c.name);
    expect(names).toContain('audio.trim');
    expect(names).toContain('audio.normalize');
    expect(names).toContain('audio.merge');
    expect(names).toContain('audio.transcode');
  });

  it('config.permissions 应声明 asset:read / asset:write / network:none', () => {
    const plugin = audioToolsPlugin();
    expect(plugin.config.permissions).toContain('asset:read');
    expect(plugin.config.permissions).toContain('asset:write');
    expect(plugin.config.permissions).toContain('network:none');
  });
});

describe('audioToolsPlugin install', () => {
  let mock: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    mock = createMockContext();
  });

  it('install 应注册 4 个能力实现', async () => {
    const plugin = audioToolsPlugin();
    await plugin.install(mock.ctx);
    expect(mock.registered).toHaveLength(4);
  });

  it('install 应记录 info 日志', async () => {
    const plugin = audioToolsPlugin();
    await plugin.install(mock.ctx);
    expect(mock.logs).toHaveLength(1);
    expect(mock.logs[0]!.level).toBe('info');
    expect(mock.logs[0]!.message).toMatch(/4 audio capabilities/);
  });

  it('注册的实现 capability 名应与声明一一对应', async () => {
    const plugin = audioToolsPlugin();
    await plugin.install(mock.ctx);

    const implNames = mock.registered.map((i) => i.capability).sort();
    const declNames = plugin.config.capabilities.map((c) => c.name).sort();
    expect(implNames).toEqual(declNames);
  });
});

describe('buildAudioCapabilityImplementations', () => {
  it('AUDIO_OPERATION_ENTRIES 应有 4 个条目', () => {
    expect(AUDIO_OPERATION_ENTRIES).toHaveLength(4);
  });

  it('每个条目都应有 operation 函数', () => {
    expect(AUDIO_OPERATION_ENTRIES.every((e) => typeof e.operation === 'function')).toBe(true);
  });

  it('应生成 4 个实现', () => {
    const { ctx } = createMockContext();
    const impls = buildAudioCapabilityImplementations(ctx);
    expect(impls).toHaveLength(4);
  });

  it('所有实现 status 应为 stub（engine-audio 为 stub 占位）', () => {
    const { ctx } = createMockContext();
    const impls = buildAudioCapabilityImplementations(ctx);
    expect(impls.every((i) => i.status === 'stub')).toBe(true);
  });

  it('trim/normalize 实现的 engine 应为 web-audio', () => {
    const { ctx } = createMockContext();
    const impls = buildAudioCapabilityImplementations(ctx);
    const trimImpl = impls.find((i) => i.capability === 'audio.trim')!;
    const normalizeImpl = impls.find((i) => i.capability === 'audio.normalize')!;
    expect(trimImpl.engine).toBe('web-audio');
    expect(normalizeImpl.engine).toBe('web-audio');
  });

  it('transcode 实现的 engine 应为 lamejs', () => {
    const { ctx } = createMockContext();
    const impls = buildAudioCapabilityImplementations(ctx);
    const transcodeImpl = impls.find((i) => i.capability === 'audio.transcode')!;
    expect(transcodeImpl.engine).toBe('lamejs');
  });

  it('各 single 实现 execute 应抛 "not implemented in stub"', async () => {
    const { ctx } = createMockContext();
    const impls = buildAudioCapabilityImplementations(ctx);
    const singleImpls = impls.filter((i) => i.capability !== 'audio.merge');

    for (const impl of singleImpls) {
      await expect(
        impl.execute([makeInputAsset()], {}, EXEC_CTX)
      ).rejects.toThrow(/not implemented in stub/);
    }
  });

  it('audio.merge 实现 execute 应抛 "not implemented in stub"', async () => {
    const { ctx } = createMockContext();
    const impls = buildAudioCapabilityImplementations(ctx);
    const mergeImpl = impls.find((i) => i.capability === 'audio.merge')!;

    await expect(
      mergeImpl.execute([makeInputAsset(), makeInputAsset()], {}, EXEC_CTX)
    ).rejects.toThrow(/not implemented in stub/);
  });

  it('空输入时 single 实现应抛 "requires at least one input"', async () => {
    const { ctx } = createMockContext();
    const impls = buildAudioCapabilityImplementations(ctx);
    const trimImpl = impls.find((i) => i.capability === 'audio.trim')!;

    await expect(
      trimImpl.execute([], {}, EXEC_CTX)
    ).rejects.toThrow(/at least one input/);
  });
});
