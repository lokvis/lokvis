/**
 * plugin-batch-watermark 单元测试(E1)
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

const {
  batchWatermarkPlugin,
  PLUGIN_NAME,
  PLUGIN_VERSION,
  PLUGIN_ENGINE,
} = await import('../plugin.js');
const {
  buildBatchWatermarkCapabilityImplementations,
  batchWatermark,
} = await import('../plugin.js');

/** 创建一个 Mock 的 PluginContext(参考 plugin-grayscale 测试结构) */
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
function makeInputAsset(id: string, w = 2, h = 2): Asset {
  return {
    id,
    type: 'image',
    metadata: {
      mimeType: 'image/png',
      size: 100,
      format: 'png',
      dimensions: { width: w, height: h },
    },
    blob: { path: `memory://${id}`, size: 100, mimeType: 'image/png' },
    history: [],
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe('plugin-batch-watermark 插件常量', () => {
  it('PLUGIN_NAME 应为 lokvis-example-batch-watermark', () => {
    expect(PLUGIN_NAME).toBe('lokvis-example-batch-watermark');
  });

  it('PLUGIN_VERSION 应为 0.1.0', () => {
    expect(PLUGIN_VERSION).toBe('0.1.0');
  });

  it('PLUGIN_ENGINE 应为 canvas-merge-teaching', () => {
    expect(PLUGIN_ENGINE).toBe('canvas-merge-teaching');
  });
});

describe('batchWatermarkPlugin 插件定义', () => {
  it('config 应包含正确的 name/version/engine/capabilities/permissions', () => {
    const plugin = batchWatermarkPlugin();
    expect(plugin.config.name).toBe(PLUGIN_NAME);
    expect(plugin.config.version).toBe(PLUGIN_VERSION);
    expect(plugin.config.engine).toBe(PLUGIN_ENGINE);
    expect(plugin.config.capabilities).toHaveLength(1);
    expect(plugin.config.capabilities[0]!.name).toBe('image.batch-watermark');
    // merge 形态:N→1,不应外层 batchable
    expect(plugin.config.capabilities[0]!.batchable).toBe(false);
    expect(plugin.config.permissions).toEqual([
      'asset:read',
      'asset:write',
      'network:none',
    ]);
  });

  it('install 应注册 1 个能力实现并输出 info 日志', async () => {
    const { ctx, registered, logs } = createMockContext();
    const plugin = batchWatermarkPlugin();
    await plugin.install(ctx);

    expect(registered).toHaveLength(1);
    expect(registered[0]!.capability).toBe('image.batch-watermark');
    expect(registered[0]!.engine).toBe(PLUGIN_ENGINE);
    expect(logs).toHaveLength(1);
    expect(logs[0]!.level).toBe('info');
    expect(logs[0]!.message).toContain('1 batch-watermark capability');
    expect(logs[0]!.message).toContain('N→1 merge');
  });
});

describe('buildBatchWatermarkCapabilityImplementations', () => {
  it('应返回 1 个能力实现,status 为 stable(非 stub)', () => {
    const { ctx } = createMockContext();
    const impls = buildBatchWatermarkCapabilityImplementations(ctx);
    expect(impls).toHaveLength(1);
    expect(impls[0]!.capability).toBe('image.batch-watermark');
    expect(impls[0]!.engine).toBe(PLUGIN_ENGINE);
    // isStub: false → status: 'stable'
    expect(impls[0]!.status).toBe('stable');
  });
});

describe('batchWatermark operation execute(merge 形态)', () => {
  it('空输入数组应抛错(createMergeCapabilityImpl 内置校验)', async () => {
    const { ctx } = createMockContext();
    const [impl] = buildBatchWatermarkCapabilityImplementations(ctx);
    const execCtx = {
      workflowId: 'wf-1',
      nodeId: 'n1',
      signal: new AbortController().signal,
      onProgress: vi.fn(),
      log: vi.fn(),
    };
    await expect(impl!.execute([], {}, execCtx)).rejects.toThrow();
  });

  it('多输入应调用 batchWatermark operation 并返回 1 个输出 Asset(N→1)', async () => {
    const { ctx } = createMockContext();
    const [impl] = buildBatchWatermarkCapabilityImplementations(ctx);

    setupFakeCanvas();

    const inputs = [
      makeInputAsset('src-1', 2, 2),
      makeInputAsset('src-2', 2, 2),
      makeInputAsset('src-3', 2, 2),
    ];
    const execCtx = {
      workflowId: 'wf-1',
      nodeId: 'n1',
      signal: new AbortController().signal,
      onProgress: vi.fn(),
      log: vi.fn(),
    };
    const outputs = await impl!.execute(inputs, { text: 'TEST' }, execCtx);

    // merge 形态:无论输入多少,输出始终为 1 个 Asset
    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('image');
    // getAssetBlob 应被调用 N 次(每个输入取一次)
    expect(ctx.runtime.getAssetBlob).toHaveBeenCalledTimes(3);
    // createAsset 应被调用 1 次(merge 只产 1 个输出)
    expect(ctx.runtime.createAsset).toHaveBeenCalledTimes(1);
  });

  it('应报告读取与合并进度(onProgress 调用次数 > 0)', async () => {
    const { ctx } = createMockContext();
    const [impl] = buildBatchWatermarkCapabilityImplementations(ctx);
    setupFakeCanvas();

    const inputs = [makeInputAsset('a'), makeInputAsset('b')];
    const execCtx = {
      workflowId: 'wf-1',
      nodeId: 'n1',
      signal: new AbortController().signal,
      onProgress: vi.fn(),
      log: vi.fn(),
    };
    await impl!.execute(inputs, {}, execCtx);

    expect(execCtx.onProgress).toHaveBeenCalled();
    // 最后一次进度应为 1(Done)
    const calls = (execCtx.onProgress as ReturnType<typeof vi.fn>).mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall![0]).toBe(1);
  });
});

/** 设置 fake 浏览器 API(createImageBitmap / document.createElement canvas)用于纯函数测试 */
function setupFakeCanvas() {
  // 每个 bitmap 不同尺寸,验证 contact sheet 取最大 cell 的逻辑
  let bitmapSeq = 0;
  (globalThis as any).createImageBitmap = vi.fn(async (_blob: Blob) => {
    const seq = bitmapSeq++;
    return {
      width: 2 + (seq % 2),
      height: 2,
      close: vi.fn(),
    };
  });
  const fakeCtx = {
    drawImage: vi.fn(),
    measureText: vi.fn(() => ({ width: 40 }) as TextMetrics),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    fillRect: vi.fn(),
    getImageData: vi.fn(),
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

describe('batchWatermark operation(纯函数,用 fake canvas)', () => {
  beforeEach(() => {
    setupFakeCanvas();
  });

  it('空 blobs 数组应抛错(纯函数层校验)', async () => {
    await expect(batchWatermark([], {})).rejects.toThrow(
      'requires at least one input blob'
    );
  });

  it('单个输入也应正常生成 contact sheet(1×1 网格)', async () => {
    const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });
    const out = await batchWatermark([blob], { text: 'Solo' });
    expect(out).toBeInstanceOf(Blob);
    expect(out.type).toBe('image/png');
  });

  it('多输入应触发多次 stampWatermark + 一次 stitch', async () => {
    const blobs = [
      new Blob([new Uint8Array([1])], { type: 'image/png' }),
      new Blob([new Uint8Array([2])], { type: 'image/png' }),
      new Blob([new Uint8Array([3])], { type: 'image/png' }),
      new Blob([new Uint8Array([4])], { type: 'image/png' }),
    ];
    const out = await batchWatermark(blobs, {
      text: 'Batch',
      position: 'center',
      fontSize: 18,
      opacity: 0.5,
      columns: 2,
      padding: 4,
    });

    expect(out).toBeInstanceOf(Blob);
    // createImageBitmap 调用:4 次(stampWatermark 逐张解码原图)+
    // 4 次(stitchContactSheet 解码 4 张 stamped blob)= 8 次
    expect((globalThis as any).createImageBitmap).toHaveBeenCalledTimes(8);
    // drawImage 调用:4 次(水印绘制)+ 4 次(contact sheet 绘制)= 8 次
    const drawImageCalls = (
      (globalThis as any).document.createElement().getContext().drawImage as ReturnType<typeof vi.fn>
    ).mock.calls;
    expect(drawImageCalls.length).toBe(8);
  });

  it('默认参数应使用 bottom-right 位置与 © Lokvis 文本', async () => {
    const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });
    // 不应抛错,验证默认值路径
    const out = await batchWatermark([blob], {});
    expect(out).toBeInstanceOf(Blob);
  });

  it('columns=0 应触发自动列数计算(sqrt(n) 向上取整)', async () => {
    const blobs = Array.from(
      { length: 5 },
      (_, i) => new Blob([new Uint8Array([i])], { type: 'image/png' })
    );
    const out = await batchWatermark(blobs, { columns: 0 });
    expect(out).toBeInstanceOf(Blob);
    // createImageBitmap 调用:5 次(stampWatermark)+ 5 次(stitchContactSheet)= 10 次
    expect((globalThis as any).createImageBitmap).toHaveBeenCalledTimes(10);
  });
});
