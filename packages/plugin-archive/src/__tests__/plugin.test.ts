/**
 * Archive Tools Plugin 单元测试
 *
 * engine-archive 为 fflate 同构真实现(非 stub),故测试直接跑真实 zip/unzip/list,
 * 并验证插件定义结构、installer 注册行为、status='stable' 与 zip→unzip 往返。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  Asset,
  AssetMetadata,
  AssetType,
  CapabilityImplementation,
  PluginContext,
} from '@lokvis/schema';

const { archiveToolsPlugin, PLUGIN_NAME, PLUGIN_VERSION, PLUGIN_ENGINE } =
  await import('../plugin.js');
const { buildArchiveCapabilityImplementations } = await import(
  '../operations.js'
);

/** 创建带真实 Blob 存储的 Mock PluginContext(支持真实 zip/unzip 往返) */
function createMockContext(): {
  ctx: PluginContext;
  registered: CapabilityImplementation[];
  logs: Array<{ level: string; message: string }>;
  store: Map<string, Blob>;
} {
  const registered: CapabilityImplementation[] = [];
  const logs: Array<{ level: string; message: string }> = [];
  const store = new Map<string, Blob>();
  let seq = 0;
  const ctx: PluginContext = {
    runtime: {
      getAsset: vi.fn(async (id: string) => ({ id }) as Asset),
      importAsset: vi.fn(async () => 'asset-id'),
      getAssetBlob: vi.fn(async (asset: Asset) => store.get(asset.id)!),
      createAsset: vi.fn(
        async (blob: Blob, metadata: AssetMetadata, type: AssetType) => {
          const id = `out-${seq++}`;
          store.set(id, blob);
          return {
            id,
            type,
            metadata,
            blob: { path: `memory://${id}`, size: blob.size, mimeType: metadata.mimeType },
            history: [],
            tags: [],
            createdAt: 0,
            updatedAt: 0,
          } as Asset;
        }
      ),
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
  return { ctx, registered, logs, store };
}

/** 在 store 中登记一个输入 Asset(携带真实 Blob) */
function putInput(
  store: Map<string, Blob>,
  id: string,
  blob: Blob
): Asset {
  store.set(id, blob);
  return {
    id,
    type: 'data',
    metadata: { mimeType: blob.type, size: blob.size, format: 'bin' },
    blob: { path: `memory://${id}`, size: blob.size, mimeType: blob.type },
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

describe('archiveToolsPlugin 定义', () => {
  it('应暴露正确的插件常量', () => {
    expect(PLUGIN_NAME).toBe('lokvis-archive-tools');
    expect(PLUGIN_VERSION).toBe('0.1.0');
    expect(PLUGIN_ENGINE).toBe('fflate');
  });

  it('应返回 config 与 install 函数', () => {
    const plugin = archiveToolsPlugin();
    expect(plugin.config.name).toBe(PLUGIN_NAME);
    expect(plugin.config.version).toBe(PLUGIN_VERSION);
    expect(plugin.config.engine).toBe(PLUGIN_ENGINE);
    expect(typeof plugin.install).toBe('function');
  });

  it('config.capabilities 应包含全部 3 个归档能力声明', () => {
    const plugin = archiveToolsPlugin();
    expect(plugin.config.capabilities).toHaveLength(3);
    const names = plugin.config.capabilities.map((c) => c.name);
    expect(names).toContain('archive.zip');
    expect(names).toContain('archive.unzip');
    expect(names).toContain('archive.list');
  });

  it('config.permissions 应声明 asset:read / asset:write / network:none', () => {
    const plugin = archiveToolsPlugin();
    expect(plugin.config.permissions).toContain('asset:read');
    expect(plugin.config.permissions).toContain('asset:write');
    expect(plugin.config.permissions).toContain('network:none');
  });
});

describe('archiveToolsPlugin install', () => {
  let mock: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    mock = createMockContext();
  });

  it('install 应注册 3 个能力实现', async () => {
    const plugin = archiveToolsPlugin();
    await plugin.install(mock.ctx);
    expect(mock.registered).toHaveLength(3);
  });

  it('install 应记录 info 日志', async () => {
    const plugin = archiveToolsPlugin();
    await plugin.install(mock.ctx);
    expect(mock.logs).toHaveLength(1);
    expect(mock.logs[0]!.level).toBe('info');
    expect(mock.logs[0]!.message).toMatch(/3 archive capabilities/);
  });

  it('注册的实现 capability 名应与声明一一对应', async () => {
    const plugin = archiveToolsPlugin();
    await plugin.install(mock.ctx);
    const implNames = mock.registered.map((i) => i.capability).sort();
    const declNames = plugin.config.capabilities.map((c) => c.name).sort();
    expect(implNames).toEqual(declNames);
  });
});

describe('buildArchiveCapabilityImplementations', () => {
  it('应生成 3 个实现(zip merge + unzip split + list single)', () => {
    const { ctx } = createMockContext();
    const impls = buildArchiveCapabilityImplementations(ctx);
    expect(impls).toHaveLength(3);
  });

  it('所有实现 status 应为 stable(engine-archive 为真实现,非 stub)', () => {
    const { ctx } = createMockContext();
    const impls = buildArchiveCapabilityImplementations(ctx);
    expect(impls.every((i) => i.status === 'stable')).toBe(true);
  });

  it('所有实现 engine 应为 fflate', () => {
    const { ctx } = createMockContext();
    const impls = buildArchiveCapabilityImplementations(ctx);
    expect(impls.every((i) => i.engine === 'fflate')).toBe(true);
  });

  it('zip → unzip 应真实往返还原内容', async () => {
    const mock = createMockContext();
    const impls = buildArchiveCapabilityImplementations(mock.ctx);
    const zipImpl = impls.find((i) => i.capability === 'archive.zip')!;
    const unzipImpl = impls.find((i) => i.capability === 'archive.unzip')!;

    const a = putInput(mock.store, 'in-a', new Blob(['hello'], { type: 'text/plain' }));
    const b = putInput(mock.store, 'in-b', new Blob(['world'], { type: 'text/plain' }));

    const [zipAsset] = await zipImpl.execute(
      [a, b],
      { names: ['a.txt', 'b.txt'] },
      EXEC_CTX
    );
    expect(zipAsset!.metadata.mimeType).toBe('application/zip');

    const outAssets = await unzipImpl.execute([zipAsset!], {}, EXEC_CTX);
    expect(outAssets).toHaveLength(2);
    const texts = (
      await Promise.all(outAssets.map((asset) => mock.store.get(asset.id)!.text()))
    ).sort();
    expect(texts).toEqual(['hello', 'world']);
  });

  it('archive.list 应输出 application/json data Asset', async () => {
    const mock = createMockContext();
    const impls = buildArchiveCapabilityImplementations(mock.ctx);
    const zipImpl = impls.find((i) => i.capability === 'archive.zip')!;
    const listImpl = impls.find((i) => i.capability === 'archive.list')!;

    const a = putInput(mock.store, 'in-a', new Blob(['abc'], { type: 'text/plain' }));
    const [zipAsset] = await zipImpl.execute([a], { names: ['f.txt'] }, EXEC_CTX);

    const [listAsset] = await listImpl.execute([zipAsset!], {}, EXEC_CTX);
    expect(listAsset!.metadata.mimeType).toBe('application/json');
    const parsed = JSON.parse(await mock.store.get(listAsset!.id)!.text());
    expect(parsed.count).toBe(1);
    expect(parsed.entries[0].name).toBe('f.txt');
  });

  it('空输入时应抛 "requires at least one input"', async () => {
    const { ctx } = createMockContext();
    const impls = buildArchiveCapabilityImplementations(ctx);
    const listImpl = impls.find((i) => i.capability === 'archive.list')!;
    await expect(listImpl.execute([], {}, EXEC_CTX)).rejects.toThrow(
      /at least one input/
    );
  });
});
