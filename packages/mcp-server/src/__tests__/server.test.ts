/**
 * createLokvisMcpServer 单元测试
 *
 * mock createLokvis(避免初始化真实 Runtime),验证:
 * 1. 返回真实 server(非 null)
 * 2. server 注册了 3 个 image tools
 * 3. workdir 提供时创建 NodeAssetStore
 * 4. domains 控制注册的 tools
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// mock @lokvis/sdk 的 createLokvis,避免初始化真实 Runtime(OPFS/IDB)
const createLokvisMock = vi.fn();
vi.mock('@lokvis/sdk', () => ({ createLokvis: createLokvisMock }));

const { createLokvisMcpServer } = await import('../server.js');

/** 创建 mock runtime(仅含 toMcpManifest) */
function makeMockRuntime() {
  return {
    version: '0.1.0',
    toMcpManifest: vi.fn(() => ({
      serverName: 'lokvis',
      version: '0.1.0',
      tools: [
        {
          name: 'lokvis_image_resize',
          description: 'Resize image',
          inputSchema: {},
          capabilities: ['image.resize'],
        },
      ],
      resources: [],
    })),
  };
}

describe('createLokvisMcpServer', () => {
  let tmpDir: string;

  beforeEach(() => {
    createLokvisMock.mockReset();
    createLokvisMock.mockResolvedValue(makeMockRuntime());
  });

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it('应返回真实 server(非 null)', async () => {
    const { server } = await createLokvisMcpServer();
    expect(server).toBeDefined();
    expect(server).not.toBeNull();
    expect(typeof server.registerTool).toBe('function');
    expect(typeof server.start).toBe('function');
    expect(typeof server.close).toBe('function');
  });

  it('应返回 runtime 和 manifest', async () => {
    const { runtime, manifest } = await createLokvisMcpServer();
    expect(runtime).toBeDefined();
    expect(runtime.version).toBe('0.1.0');
    expect(manifest).toBeDefined();
    expect(manifest.serverName).toBe('lokvis');
  });

  it('默认 domains 应注册 3 个 image tools', async () => {
    const { server } = await createLokvisMcpServer();
    const toolNames = server.getRegisteredToolNames();
    expect(toolNames).toHaveLength(3);
    expect(toolNames).toContain('lokvis_image_resize');
    expect(toolNames).toContain('lokvis_image_compress');
    expect(toolNames).toContain('lokvis_image_convert');
  });

  it('domains=[] 不应注册任何 tool', async () => {
    const { server } = await createLokvisMcpServer({ domains: [] });
    expect(server.getRegisteredToolNames()).toHaveLength(0);
  });

  it('domains=[image] 应注册 image tools', async () => {
    const { server } = await createLokvisMcpServer({ domains: ['image'] });
    expect(server.getRegisteredToolNames()).toHaveLength(3);
  });

  it('提供 workdir 应创建 NodeAssetStore 并注入 runtime config', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'lokvis-mcp-test-'));
    createLokvisMock.mockReset();
    createLokvisMock.mockResolvedValue(makeMockRuntime());

    await createLokvisMcpServer({ workdir: tmpDir });

    expect(createLokvisMock).toHaveBeenCalledTimes(1);
    const config = createLokvisMock.mock.calls[0]![0];
    expect(config.enableOpfs).toBe(false);
    expect(config.enableIndexedDB).toBe(false);
    expect(config.assetStore).toBeDefined();
    expect(config.assetStore.init).toBeDefined(); // NodeAssetStore 有 init 方法
  });

  it('不提供 workdir 不应注入 assetStore', async () => {
    await createLokvisMcpServer();
    const config = createLokvisMock.mock.calls[0]![0];
    expect(config.assetStore).toBeUndefined();
  });

  it('应支持 transportFactory 注入(测试用)', async () => {
    const mockTransport = {
      start: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      send: vi.fn(async () => {}),
      onclose: undefined,
      onerror: undefined,
      onmessage: undefined,
    };
    const { server } = await createLokvisMcpServer({
      transportFactory: () => mockTransport as any,
    });
    // 验证 transportFactory 被传入(不实际启动)
    expect(server).toBeDefined();
  });

  it('runtime config 应透传给 createLokvis', async () => {
    await createLokvisMcpServer({
      runtime: { enableLog: false, storageQuota: 1024 },
    });
    const config = createLokvisMock.mock.calls[0]![0];
    expect(config.enableLog).toBe(false);
    expect(config.storageQuota).toBe(1024);
  });
});
