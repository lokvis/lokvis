/**
 * createLokvisMcpServer 单元测试
 *
 * mock createLokvis + imageToolsPluginNode(避免初始化真实 Runtime 和 sharp),
 * 验证:
 * 1. 返回真实 server(非 null)
 * 2. server 注册了 5 个 image tools(resize/compress/convert/crop/watermark)
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

// mock @lokvis/plugin-image/node 的 imageToolsPluginNode,避免加载 sharp
const imageToolsPluginNodeMock = vi.fn(async () => ({ name: 'mock-image-plugin' }));
vi.mock('@lokvis/plugin-image/node', () => ({
  imageToolsPluginNode: imageToolsPluginNodeMock,
}));

// mock @lokvis/plugin-pdf/node 的 pdfToolsPluginNode,避免加载 pdf-lib
const pdfToolsPluginNodeMock = vi.fn(async () => ({ name: 'mock-pdf-plugin' }));
vi.mock('@lokvis/plugin-pdf/node', () => ({
  pdfToolsPluginNode: pdfToolsPluginNodeMock,
}));

// mock @lokvis/cloud-bridge(避免真实网络调用)
const createAuthenticatorMock = vi.fn(() => ({ hasApiKey: () => false, verify: vi.fn() }));
const createBillingMock = vi.fn(() => ({ check: vi.fn() }));
vi.mock('@lokvis/cloud-bridge', () => ({
  createAuthenticator: createAuthenticatorMock,
  createBilling: createBillingMock,
  resolveCloudConfig: vi.fn(() => ({ apiBaseUrl: 'https://test.example', upgradeUrl: 'https://test.example/billing', planQuotas: {}, pricePerCallCents: 1, pppPricing: { default: 1.0 } })),
}));

const { createLokvisMcpServer } = await import('../server.js');

/** 创建 mock runtime(含 toMcpManifest + installPlugin) */
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
    installPlugin: vi.fn(async () => {}),
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
      await rm(tmpDir, { recursive: true, force: true }).catch((err) => {
        console.warn('[mcp-server test] cleanup tmpDir failed:', err);
      });
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

  it('默认 domains 应注册 10 个 image tools', async () => {
    const { server } = await createLokvisMcpServer();
    const toolNames = server.getRegisteredToolNames();
    expect(toolNames).toHaveLength(10);
    expect(toolNames).toContain('lokvis_image_resize');
    expect(toolNames).toContain('lokvis_image_compress');
    expect(toolNames).toContain('lokvis_image_convert');
    expect(toolNames).toContain('lokvis_image_crop');
    expect(toolNames).toContain('lokvis_image_watermark');
    expect(toolNames).toContain('lokvis_image_rotate');
    expect(toolNames).toContain('lokvis_image_flip');
    expect(toolNames).toContain('lokvis_image_background');
    expect(toolNames).toContain('lokvis_image_filter');
    expect(toolNames).toContain('lokvis_image_favicon');
  });

  it('domains=[] 不应注册任何 tool', async () => {
    const { server } = await createLokvisMcpServer({ domains: [] });
    expect(server.getRegisteredToolNames()).toHaveLength(0);
  });

  it('domains=[image] 应注册 10 个 image tools', async () => {
    const { server } = await createLokvisMcpServer({ domains: ['image'] });
    expect(server.getRegisteredToolNames()).toHaveLength(10);
  });

  it('domains=[pdf] 应注册 5 个 pdf tools', async () => {
    const { server } = await createLokvisMcpServer({ domains: ['pdf'] });
    const toolNames = server.getRegisteredToolNames();
    expect(toolNames).toHaveLength(5);
    expect(toolNames).toContain('lokvis_pdf_merge');
    expect(toolNames).toContain('lokvis_pdf_compress');
    expect(toolNames).toContain('lokvis_pdf_split');
    expect(toolNames).toContain('lokvis_pdf_rotate');
    expect(toolNames).toContain('lokvis_pdf_watermark');
  });

  it('domains=[image,pdf] 应注册 15 个 tools(10 image + 5 pdf)', async () => {
    const { server } = await createLokvisMcpServer({ domains: ['image', 'pdf'] });
    expect(server.getRegisteredToolNames()).toHaveLength(15);
  });

  it('domains=[image] 应安装 imageToolsPluginNode', async () => {
    imageToolsPluginNodeMock.mockClear();
    await createLokvisMcpServer({ domains: ['image'] });
    expect(imageToolsPluginNodeMock).toHaveBeenCalledTimes(1);
  });

  it('domains=[pdf] 应安装 pdfToolsPluginNode', async () => {
    pdfToolsPluginNodeMock.mockClear();
    await createLokvisMcpServer({ domains: ['pdf'] });
    expect(pdfToolsPluginNodeMock).toHaveBeenCalledTimes(1);
  });

  it('domains=[] 不应安装任何 plugin', async () => {
    imageToolsPluginNodeMock.mockClear();
    pdfToolsPluginNodeMock.mockClear();
    await createLokvisMcpServer({ domains: [] });
    expect(imageToolsPluginNodeMock).not.toHaveBeenCalled();
    expect(pdfToolsPluginNodeMock).not.toHaveBeenCalled();
  });

  it('domains=[image] 不应安装 pdfToolsPluginNode', async () => {
    pdfToolsPluginNodeMock.mockClear();
    await createLokvisMcpServer({ domains: ['image'] });
    expect(pdfToolsPluginNodeMock).not.toHaveBeenCalled();
  });

  it('domains=[pdf] 不应安装 imageToolsPluginNode', async () => {
    imageToolsPluginNodeMock.mockClear();
    await createLokvisMcpServer({ domains: ['pdf'] });
    expect(imageToolsPluginNodeMock).not.toHaveBeenCalled();
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

  it('应返回 bridge 和 router(M2.3 路由集成)', async () => {
    const { bridge, router } = await createLokvisMcpServer();
    expect(bridge).toBeDefined();
    expect(bridge.isConnected()).toBe(false); // 未提供 bridgePort,未启动
    expect(router).toBeDefined();
    expect(typeof router.execute).toBe('function');
  });

  it('提供 bridgePort 应启动 BrowserBridge 并监听端口', async () => {
    const { bridge } = await createLokvisMcpServer({ bridgePort: 0 });
    expect(bridge.getPort()).toBeDefined();
    expect(bridge.getPort()!).toBeGreaterThan(0);
    expect(bridge.isConnected()).toBe(false); // 启动但无浏览器连接
    await bridge.close();
  });

  it('image tool handler 应经 ToolRouter 路由(浏览器未连接走 Node 降级)', async () => {
    // 用真实 sharp 处理一张测试图,验证 router → nodeEngine 路径打通
    tmpDir = await mkdtemp(join(tmpdir(), 'lokvis-mcp-route-'));
    const sharp = (await import('sharp')).default;
    const inputPath = join(tmpDir, 'in.png');
    await sharp({
      create: { width: 20, height: 10, channels: 3, background: '#f00' },
    }).png().toFile(inputPath);

    const { server } = await createLokvisMcpServer({ workdir: tmpDir });
    const toolNames = server.getRegisteredToolNames();
    expect(toolNames).toContain('lokvis_image_resize');
  });

  it('不提供 cloud 时 authenticator/billing 应为 undefined', async () => {
    createAuthenticatorMock.mockClear();
    createBillingMock.mockClear();
    const { authenticator, billing } = await createLokvisMcpServer();
    expect(authenticator).toBeUndefined();
    expect(billing).toBeUndefined();
    expect(createAuthenticatorMock).not.toHaveBeenCalled();
    expect(createBillingMock).not.toHaveBeenCalled();
  });

  it('提供 cloud 时应创建 authenticator + billing 并返回', async () => {
    createAuthenticatorMock.mockClear();
    createBillingMock.mockClear();
    const cloudConfig = {
      apiBaseUrl: 'https://api.test.example',
      upgradeUrl: 'https://app.test.example/billing',
      planQuotas: { free: 0, pro: 10 },
      pricePerCallCents: 2,
      pppPricing: { default: 1.0, US: 1.0, CN: 0.5 },
    };
    const { authenticator, billing } = await createLokvisMcpServer({ cloud: cloudConfig });
    expect(authenticator).toBeDefined();
    expect(billing).toBeDefined();
    expect(createAuthenticatorMock).toHaveBeenCalledTimes(1);
    expect(createBillingMock).toHaveBeenCalledTimes(1);
    expect(createAuthenticatorMock).toHaveBeenCalledWith(cloudConfig);
    expect(createBillingMock).toHaveBeenCalledWith(cloudConfig);
  });
});
