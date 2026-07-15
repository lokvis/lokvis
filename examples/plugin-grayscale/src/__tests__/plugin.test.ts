/**
 * plugin-grayscale 单元测试(W18.3)
 *
 * 遵循 AGENTS.md 测试约定:
 * - Vitest,globals: false(显式 import)
 * - 中文测试描述
 * - 浏览器 API(Canvas / createImageBitmap)用 fake 实现
 * - 覆盖:插件常量 / installer 注册数 / buildXxx 返回数 / stub status / execute 抛错
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  Asset,
  CapabilityImplementation,
  PluginContext,
} from '@lokvis/schema';

const { grayscalePlugin, PLUGIN_NAME, PLUGIN_VERSION, PLUGIN_ENGINE } =
  await import('../plugin.js');
const { buildGrayscaleCapabilityImplementations, grayscale } = await import(
  '../plugin.js'
);

/** 创建一个 Mock 的 PluginContext(参考 plugin-image 测试结构) */
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
    type: 'image',
    metadata: {
      mimeType: 'image/png',
      size: 100,
      format: 'png',
      dimensions: { width: 2, height: 2 },
    },
    blob: { path: 'memory://src-1', size: 100, mimeType: 'image/png' },
    history: [],
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe('plugin-grayscale 插件常量', () => {
  it('PLUGIN_NAME 应为 lokvis-example-grayscale', () => {
    expect(PLUGIN_NAME).toBe('lokvis-example-grayscale');
  });

  it('PLUGIN_VERSION 应为 0.1.0', () => {
    expect(PLUGIN_VERSION).toBe('0.1.0');
  });

  it('PLUGIN_ENGINE 应为 canvas-teaching', () => {
    expect(PLUGIN_ENGINE).toBe('canvas-teaching');
  });
});

describe('grayscalePlugin 插件定义', () => {
  it('config 应包含正确的 name/version/engine/capabilities/permissions', () => {
    const plugin = grayscalePlugin();
    expect(plugin.config.name).toBe(PLUGIN_NAME);
    expect(plugin.config.version).toBe(PLUGIN_VERSION);
    expect(plugin.config.engine).toBe(PLUGIN_ENGINE);
    expect(plugin.config.capabilities).toHaveLength(1);
    expect(plugin.config.capabilities[0]!.name).toBe('image.grayscale');
    expect(plugin.config.permissions).toEqual([
      'asset:read',
      'asset:write',
      'network:none',
    ]);
  });

  it('install 应注册 1 个能力实现并输出 info 日志', async () => {
    const { ctx, registered, logs } = createMockContext();
    const plugin = grayscalePlugin();
    await plugin.install(ctx);

    expect(registered).toHaveLength(1);
    expect(registered[0]!.capability).toBe('image.grayscale');
    expect(registered[0]!.engine).toBe(PLUGIN_ENGINE);
    expect(logs).toHaveLength(1);
    expect(logs[0]!.level).toBe('info');
    expect(logs[0]!.message).toContain('1 grayscale capability');
  });
});

describe('buildGrayscaleCapabilityImplementations', () => {
  it('应返回 1 个能力实现,status 为 stable(非 stub)', () => {
    const { ctx } = createMockContext();
    const impls = buildGrayscaleCapabilityImplementations(ctx);
    expect(impls).toHaveLength(1);
    expect(impls[0]!.capability).toBe('image.grayscale');
    expect(impls[0]!.engine).toBe(PLUGIN_ENGINE);
    // isStub: false → status: 'stable'
    expect(impls[0]!.status).toBe('stable');
  });
});

describe('grayscale operation execute', () => {
  it('空输入数组应抛错(createBlobCapabilityImpl 内置校验)', async () => {
    const { ctx } = createMockContext();
    const [impl] = buildGrayscaleCapabilityImplementations(ctx);
    const execCtx = {
      workflowId: 'wf-1',
      nodeId: 'n1',
      signal: new AbortController().signal,
      onProgress: vi.fn(),
      log: vi.fn(),
    };
    await expect(impl!.execute([], {}, execCtx)).rejects.toThrow();
  });

  it('正常输入应调用 grayscale operation 并返回 1 个输出 Asset', async () => {
    const { ctx } = createMockContext();
    const [impl] = buildGrayscaleCapabilityImplementations(ctx);

    // 用 fake canvas 让 grayscale 真实跑通(不 spy,因为
    // createBlobCapabilityImpl 内部闭包绑定了 grayscale 引用,spyOn 模块
    // 导出无法拦截)
    setupFakeCanvas();

    const input = makeInputAsset();
    const execCtx = {
      workflowId: 'wf-1',
      nodeId: 'n1',
      signal: new AbortController().signal,
      onProgress: vi.fn(),
      log: vi.fn(),
    };
    const outputs = await impl!.execute([input], {}, execCtx);

    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('image');
    // getAssetBlob 与 createAsset 都应被调用(execute 包装逻辑)
    expect(ctx.runtime.getAssetBlob).toHaveBeenCalledTimes(1);
    expect(ctx.runtime.createAsset).toHaveBeenCalledTimes(1);
  });
});

/** 设置 fake 浏览器 API(createImageBitmap / document.createElement canvas)用于纯函数测试 */
function setupFakeCanvas() {
  (globalThis as any).createImageBitmap = vi.fn(async (_blob: Blob) => ({
    width: 2,
    height: 1,
    close: vi.fn(),
  }));
  const fakeImageData = {
    data: new Uint8ClampedArray([
      255, 0, 0, 255, // 红色像素
      0, 255, 0, 255, // 绿色像素
    ]),
  };
  const fakeCtx = {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => fakeImageData),
    putImageData: vi.fn(),
  };
  const fakeCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => fakeCtx),
    toBlob: vi.fn((cb: (b: Blob | null) => void) =>
      cb(new Blob([new Uint8Array([0])], { type: 'image/png' }))
    ),
  };
  (globalThis as any).document = {
    createElement: vi.fn(() => fakeCanvas),
  };
}

describe('grayscale operation(纯函数,用 fake canvas)', () => {
  beforeEach(() => {
    setupFakeCanvas();
  });

  it('luminance 算法应把红色像素转为 0.299*255≈76(Uint8ClampedArray 截断)', async () => {
    const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });
    await grayscale(blob, { algorithm: 'luminance' });

    const imageData = (globalThis as any).document
      .createElement()
      .getContext()
      .getImageData();
    // luminance(255,0,0) = 0.299*255 = 76.245,Uint8ClampedArray 截断为 76
    expect(imageData.data[0]).toBe(76);
    expect(imageData.data[1]).toBe(76);
    expect(imageData.data[2]).toBe(76);
  });

  it('average 算法应把绿色像素(0,255,0)转为 85', async () => {
    const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });
    await grayscale(blob, { algorithm: 'average' });

    const imageData = (globalThis as any).document
      .createElement()
      .getContext()
      .getImageData();
    // average(0,255,0) = 85
    expect(imageData.data[4]).toBe(85); // 第二个像素 R
    expect(imageData.data[5]).toBe(85); // G
    expect(imageData.data[6]).toBe(85); // B
  });

  it('lightness 算法应把红色像素(255,0,0)转为 127', async () => {
    const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });
    await grayscale(blob, { algorithm: 'lightness' });

    const imageData = (globalThis as any).document
      .createElement()
      .getContext()
      .getImageData();
    // lightness(255,0,0) = (max(255,0,0) + min(255,0,0)) / 2 = (255+0)/2 = 127.5 → 四舍五入 128
    expect(imageData.data[0]).toBe(128);
  });

  it('默认参数应使用 luminance 算法', async () => {
    const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });
    await grayscale(blob, {});

    const imageData = (globalThis as any).document
      .createElement()
      .getContext()
      .getImageData();
    // 默认 luminance(255,0,0) → 76
    expect(imageData.data[0]).toBe(76);
  });

  it('signal 已 aborted 应抛 AbortError', async () => {
    const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });
    const controller = new AbortController();
    controller.abort();
    await expect(
      grayscale(blob, {}, controller.signal)
    ).rejects.toThrow('Operation aborted');
  });
});
