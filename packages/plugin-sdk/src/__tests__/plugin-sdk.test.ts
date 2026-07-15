/**
 * @lokvis/plugin-sdk 单元测试
 *
 * 覆盖 5 个工厂函数 + 2 个辅助函数:
 * - definePlugin:返回 {config, install},installer 异步执行
 * - createCapabilityImpl:返回 stable 实现
 * - definePanel:透传 PanelDefinition
 * - defaultDeriveOutputMetadata:dimensions 传播 / mimeType-size-format 派生
 * - createBlobCapabilityImpl:1→1 变换(stub/stable、空输入、进度、取消、自定义 derive)
 * - createMergeCapabilityImpl:N→1 合并(空输入、读取进度、合并、取消)
 * - createSplitCapabilityImpl:1→N 拆分(空输入、多输出、取消)
 *
 * mock 模式参考 plugin-image/src/__tests__/plugin.test.ts 的 createMockContext。
 */
import { describe, it, expect, vi } from 'vitest';
import type {
  Asset,
  AssetMetadata,
  CapabilityImplementation,
  ExecutionContext,
  PanelDefinition,
  PluginContext,
} from '@lokvis/schema';
import {
  definePlugin,
  createCapabilityImpl,
  definePanel,
  defaultDeriveOutputMetadata,
  createBlobCapabilityImpl,
  createMergeCapabilityImpl,
  createSplitCapabilityImpl,
} from '../index.js';

// ─── mock 工具 ──────────────────────────────────────────────────

/** 创建一个 Mock PluginContext,记录所有注册/日志调用 */
function createMockContext(): {
  ctx: PluginContext;
  createAsset: ReturnType<typeof vi.fn>;
  registered: CapabilityImplementation[];
  logs: Array<{ level: string; message: string }>;
} {
  const registered: CapabilityImplementation[] = [];
  const logs: Array<{ level: string; message: string }> = [];
  const createAsset = vi.fn(
    async (blob: Blob, metadata: AssetMetadata, type: string) =>
      ({
        id: `out-${Math.random().toString(36).slice(2)}`,
        type,
        metadata,
        blob: { path: 'memory://x', size: blob.size, mimeType: metadata.mimeType },
        history: [],
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }) as Asset
  );
  const ctx: PluginContext = {
    runtime: {
      getAsset: vi.fn(async (id: string) => ({ id }) as Asset),
      importAsset: vi.fn(async () => 'asset-id'),
      getAssetBlob: vi.fn(
        async (asset: Asset) =>
          new Blob([new Uint8Array([0])], { type: asset.metadata.mimeType })
      ),
      createAsset,
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
  return { ctx, createAsset, registered, logs };
}

/** 构造一个输入 Asset */
function makeInputAsset(overrides: Partial<Asset> = {}): Asset {
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
    ...overrides,
  };
}

/** 构造一个 ExecutionContext(signal 默认未取消) */
function makeExecCtx(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    workflowId: 'wf-1',
    nodeId: 'n-1',
    signal: new AbortController().signal,
    log: vi.fn(),
    ...overrides,
  };
}

// ─── definePlugin ──────────────────────────────────────────────

describe('definePlugin', () => {
  it('应返回 { config, install } 结构', () => {
    const config = {
      name: 'test-plugin',
      version: '1.0.0',
      capabilities: [],
    };
    const plugin = definePlugin(config);
    expect(plugin.config).toBe(config);
    expect(typeof plugin.install).toBe('function');
  });

  it('无 installer 时 install 应正常完成(无副作用)', async () => {
    const { ctx } = createMockContext();
    const plugin = definePlugin({
      name: 'p',
      version: '1.0.0',
      capabilities: [],
    });
    await plugin.install(ctx);
    // 无 installer 时不应注册任何能力
    expect(ctx.registerCapability).not.toHaveBeenCalled();
  });

  it('有 installer 时 install 应调用 installer(ctx)', async () => {
    const { ctx } = createMockContext();
    const installer = vi.fn(async (c: PluginContext) => {
      c.log('info', 'installing');
    });
    const plugin = definePlugin(
      { name: 'p', version: '1.0.0', capabilities: [] },
      installer
    );
    await plugin.install(ctx);
    expect(installer).toHaveBeenCalledWith(ctx);
    expect(ctx.log).toHaveBeenCalledWith('info', 'installing');
  });

  it('installer 可同步返回(void)', async () => {
    const { ctx } = createMockContext();
    const installer = vi.fn((c: PluginContext) => {
      c.registerCapability({
        capability: 'x.do',
        engine: 'e',
        status: 'stable',
        execute: vi.fn(),
      });
    });
    const plugin = definePlugin(
      { name: 'p', version: '1.0.0', capabilities: [] },
      installer
    );
    await plugin.install(ctx);
    expect(ctx.registerCapability).toHaveBeenCalledTimes(1);
  });

  it('installer 抛错应上抛', async () => {
    const { ctx } = createMockContext();
    const plugin = definePlugin(
      { name: 'p', version: '1.0.0', capabilities: [] },
      async () => {
        throw new Error('install failed');
      }
    );
    await expect(plugin.install(ctx)).rejects.toThrow('install failed');
  });
});

// ─── createCapabilityImpl ──────────────────────────────────────

describe('createCapabilityImpl', () => {
  it('应返回 status:stable 的实现', () => {
    const execute = vi.fn(async () => [] as Asset[]);
    const impl = createCapabilityImpl('image.resize', 'canvas', execute);
    expect(impl.capability).toBe('image.resize');
    expect(impl.engine).toBe('canvas');
    expect(impl.status).toBe('stable');
    expect(impl.execute).toBe(execute);
  });

  it('返回的 execute 应可直接调用', async () => {
    const execute = vi.fn(async () => []);
    const impl = createCapabilityImpl('cap', 'engine', execute);
    const ctx = makeExecCtx();
    await impl.execute([], {}, ctx);
    expect(execute).toHaveBeenCalledWith([], {}, ctx);
  });
});

// ─── definePanel ───────────────────────────────────────────────

describe('definePanel', () => {
  it('应原样返回传入的 PanelDefinition', () => {
    const panel: PanelDefinition = {
      id: 'my-panel',
      name: 'My Panel',
      location: 'sidebar',
      component: 'MyPanel',
    };
    expect(definePanel(panel)).toBe(panel);
  });

  it('应保留 show 条件函数', () => {
    const show = (ctx: { selectedAssets: string[] }) => ctx.selectedAssets.length > 0;
    const panel = definePanel({
      id: 'p',
      name: 'P',
      location: 'inspector',
      component: 'C',
      show,
    });
    expect(panel.show).toBe(show);
    expect(panel.show?.({ selectedAssets: ['a'] })).toBe(true);
    expect(panel.show?.({ selectedAssets: [] })).toBe(false);
  });
});

// ─── defaultDeriveOutputMetadata ───────────────────────────────

describe('defaultDeriveOutputMetadata', () => {
  it('应从 source 传播 dimensions,从 outBlob 取 mimeType/size', () => {
    const source = makeInputAsset();
    const outBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    const meta = defaultDeriveOutputMetadata(source, outBlob);
    expect(meta.mimeType).toBe('image/jpeg');
    expect(meta.size).toBe(3);
    expect(meta.format).toBe('jpeg');
    expect(meta.dimensions).toEqual({ width: 200, height: 100 });
  });

  it('outBlob.type 为空时应回退到 source.metadata.mimeType', () => {
    const source = makeInputAsset();
    const outBlob = new Blob([new Uint8Array([1])], { type: '' });
    const meta = defaultDeriveOutputMetadata(source, outBlob);
    expect(meta.mimeType).toBe('image/png');
    expect(meta.format).toBe('png');
  });

  it('mimeType 无斜杠时应回退 format 到 source', () => {
    const source = makeInputAsset();
    const outBlob = new Blob([new Uint8Array([1])], { type: 'binary' });
    const meta = defaultDeriveOutputMetadata(source, outBlob);
    expect(meta.mimeType).toBe('binary');
    expect(meta.format).toBe('png'); // 回退到 source.format
  });

  it('source 无 dimensions 时应输出 undefined', () => {
    const source = makeInputAsset({
      metadata: { mimeType: 'image/png', size: 100, format: 'png' },
    });
    const outBlob = new Blob([new Uint8Array([1])], { type: 'image/png' });
    const meta = defaultDeriveOutputMetadata(source, outBlob);
    expect(meta.dimensions).toBeUndefined();
  });
});

// ─── createBlobCapabilityImpl ──────────────────────────────────

describe('createBlobCapabilityImpl', () => {
  it('isStub=true 时 status 应为 stub', () => {
    const { ctx } = createMockContext();
    const impl = createBlobCapabilityImpl(
      {
        capability: 'image.resize',
        engine: 'canvas',
        outputType: 'image',
        operation: vi.fn(async (b: Blob) => b),
        isStub: true,
      },
      ctx
    );
    expect(impl.status).toBe('stub');
  });

  it('isStub=false 时 status 应为 stable', () => {
    const { ctx } = createMockContext();
    const impl = createBlobCapabilityImpl(
      {
        capability: 'image.resize',
        engine: 'canvas',
        outputType: 'image',
        operation: vi.fn(async (b: Blob) => b),
        isStub: false,
      },
      ctx
    );
    expect(impl.status).toBe('stable');
  });

  it('空输入应抛错', async () => {
    const { ctx } = createMockContext();
    const impl = createBlobCapabilityImpl(
      {
        capability: 'image.resize',
        engine: 'canvas',
        outputType: 'image',
        operation: vi.fn(),
        isStub: false,
      },
      ctx
    );
    await expect(impl.execute([], {}, makeExecCtx())).rejects.toThrow(
      'Capability "image.resize" requires at least one input asset'
    );
  });

  it('应在取消信号下抛出 AbortError', async () => {
    const { ctx } = createMockContext();
    const impl = createBlobCapabilityImpl(
      {
        capability: 'cap',
        engine: 'e',
        outputType: 'image',
        operation: vi.fn(),
        isStub: false,
      },
      ctx
    );
    const ac = new AbortController();
    ac.abort();
    await expect(
      impl.execute([makeInputAsset()], {}, makeExecCtx({ signal: ac.signal }))
    ).rejects.toThrow('Aborted');
  });

  it('单输入应:取 blob → operation → deriveMetadata → createAsset', async () => {
    const { ctx, createAsset } = createMockContext();
    const op = vi.fn(async (b: Blob) => new Blob([await b.arrayBuffer()], { type: 'image/jpeg' }));
    const impl = createBlobCapabilityImpl(
      {
        capability: 'image.resize',
        engine: 'canvas',
        outputType: 'image',
        operation: op,
        isStub: false,
      },
      ctx
    );
    const input = makeInputAsset();
    const result = await impl.execute([input], { width: 100 }, makeExecCtx());
    expect(op).toHaveBeenCalledTimes(1);
    expect(ctx.runtime.getAssetBlob).toHaveBeenCalledWith(input);
    expect(ctx.runtime.createAsset).toHaveBeenCalledTimes(1);
    // createAsset 第三个参数应为 outputType
    expect(createAsset.mock.calls[0]![2]).toBe('image');
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('image');
    expect(result[0]!.metadata.mimeType).toBe('image/jpeg');
  });

  it('多输入应逐个处理并产出多个输出', async () => {
    const { ctx } = createMockContext();
    const op = vi.fn(async (b: Blob) => b);
    const impl = createBlobCapabilityImpl(
      {
        capability: 'cap',
        engine: 'e',
        outputType: 'image',
        operation: op,
        isStub: false,
      },
      ctx
    );
    const inputs = [makeInputAsset({ id: 'a' }), makeInputAsset({ id: 'b' }), makeInputAsset({ id: 'c' })];
    const result = await impl.execute(inputs, {}, makeExecCtx());
    expect(op).toHaveBeenCalledTimes(3);
    expect(ctx.runtime.createAsset).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(3);
  });

  it('应在每次迭代中报告进度', async () => {
    const { ctx } = createMockContext();
    const onProgress = vi.fn();
    const impl = createBlobCapabilityImpl(
      {
        capability: 'cap',
        engine: 'e',
        outputType: 'image',
        operation: vi.fn(async (b: Blob) => b),
        isStub: false,
      },
      ctx
    );
    await impl.execute(
      [makeInputAsset({ id: 'a' }), makeInputAsset({ id: 'b' })],
      {},
      makeExecCtx({ onProgress })
    );
    // 0/2, 1/2, 然后完成 1
    expect(onProgress).toHaveBeenCalledWith(0, 'Processing 1/2');
    expect(onProgress).toHaveBeenCalledWith(0.5, 'Processing 2/2');
    expect(onProgress).toHaveBeenCalledWith(1, 'Done');
  });

  it('自定义 deriveMetadata 应覆盖默认实现', async () => {
    const { ctx, createAsset } = createMockContext();
    const customDerive = vi.fn((): AssetMetadata => ({
      mimeType: 'custom/x',
      size: 999,
      format: 'custom',
    }));
    const impl = createBlobCapabilityImpl(
      {
        capability: 'cap',
        engine: 'e',
        outputType: 'image',
        operation: vi.fn(async (b: Blob) => b),
        isStub: false,
        deriveMetadata: customDerive,
      },
      ctx
    );
    await impl.execute([makeInputAsset()], {}, makeExecCtx());
    expect(customDerive).toHaveBeenCalledTimes(1);
    expect(createAsset.mock.calls[0]![1].mimeType).toBe('custom/x');
  });
});

// ─── createMergeCapabilityImpl ─────────────────────────────────

describe('createMergeCapabilityImpl', () => {
  it('isStub 标识应正确反映到 status', () => {
    const { ctx } = createMockContext();
    const stub = createMergeCapabilityImpl(
      {
        capability: 'pdf.merge',
        engine: 'pdf-lib',
        outputType: 'pdf',
        operation: vi.fn(),
        isStub: true,
        deriveMetadata: () => ({ mimeType: 'application/pdf', size: 0, format: 'pdf' }),
      },
      ctx
    );
    expect(stub.status).toBe('stub');
    const stable = createMergeCapabilityImpl(
      {
        capability: 'pdf.merge',
        engine: 'pdf-lib',
        outputType: 'pdf',
        operation: vi.fn(),
        isStub: false,
        deriveMetadata: () => ({ mimeType: 'application/pdf', size: 0, format: 'pdf' }),
      },
      ctx
    );
    expect(stable.status).toBe('stable');
  });

  it('空输入应抛错', async () => {
    const { ctx } = createMockContext();
    const impl = createMergeCapabilityImpl(
      {
        capability: 'pdf.merge',
        engine: 'pdf-lib',
        outputType: 'pdf',
        operation: vi.fn(),
        isStub: false,
        deriveMetadata: () => ({ mimeType: 'application/pdf', size: 0, format: 'pdf' }),
      },
      ctx
    );
    await expect(impl.execute([], {}, makeExecCtx())).rejects.toThrow(
      'Capability "pdf.merge" requires at least one input asset'
    );
  });

  it('取消信号应抛出 AbortError', async () => {
    const { ctx } = createMockContext();
    const impl = createMergeCapabilityImpl(
      {
        capability: 'pdf.merge',
        engine: 'pdf-lib',
        outputType: 'pdf',
        operation: vi.fn(),
        isStub: false,
        deriveMetadata: () => ({ mimeType: 'application/pdf', size: 0, format: 'pdf' }),
      },
      ctx
    );
    const ac = new AbortController();
    ac.abort();
    await expect(
      impl.execute([makeInputAsset()], {}, makeExecCtx({ signal: ac.signal }))
    ).rejects.toThrow('Aborted');
  });

  it('应逐个取 blob 后调 operation(blobs[]) 产出单个 Asset', async () => {
    const { ctx } = createMockContext();
    const op = vi.fn(async (blobs: Blob[]) => new Blob(blobs, { type: 'application/pdf' }));
    const impl = createMergeCapabilityImpl(
      {
        capability: 'pdf.merge',
        engine: 'pdf-lib',
        outputType: 'pdf',
        operation: op,
        isStub: false,
        deriveMetadata: (outBlob: Blob) => ({
          mimeType: 'application/pdf',
          size: outBlob.size,
          format: 'pdf',
        }),
      },
      ctx
    );
    const inputs = [
      makeInputAsset({ id: 'a', metadata: { mimeType: 'application/pdf', size: 1, format: 'pdf' } }),
      makeInputAsset({ id: 'b', metadata: { mimeType: 'application/pdf', size: 2, format: 'pdf' } }),
    ];
    const result = await impl.execute(inputs, {}, makeExecCtx());
    expect(ctx.runtime.getAssetBlob).toHaveBeenCalledTimes(2);
    expect(op).toHaveBeenCalledTimes(1);
    expect(op.mock.calls[0]![0]).toHaveLength(2);
    expect(ctx.runtime.createAsset).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('pdf');
  });

  it('应在读取阶段与合并阶段分别报告进度', async () => {
    const { ctx } = createMockContext();
    const onProgress = vi.fn();
    const impl = createMergeCapabilityImpl(
      {
        capability: 'pdf.merge',
        engine: 'pdf-lib',
        outputType: 'pdf',
        operation: vi.fn(async (b: Blob[]) => new Blob(b, { type: 'application/pdf' })),
        isStub: false,
        deriveMetadata: (outBlob: Blob) => ({
          mimeType: 'application/pdf',
          size: outBlob.size,
          format: 'pdf',
        }),
      },
      ctx
    );
    await impl.execute(
      [makeInputAsset({ id: 'a' }), makeInputAsset({ id: 'b' })],
      {},
      makeExecCtx({ onProgress })
    );
    expect(onProgress).toHaveBeenCalledWith(0, 'Reading 1/2');
    expect(onProgress).toHaveBeenCalledWith(0.5, 'Reading 2/2');
    expect(onProgress).toHaveBeenCalledWith(0.9, 'Merging');
    expect(onProgress).toHaveBeenCalledWith(1, 'Done');
  });

  it('deriveMetadata 必填,应作用于 outBlob', async () => {
    const { ctx, createAsset } = createMockContext();
    const derive = vi.fn((outBlob: Blob) => ({
      mimeType: 'application/pdf',
      size: outBlob.size,
      format: 'pdf',
      pages: 5,
    }));
    const impl = createMergeCapabilityImpl(
      {
        capability: 'pdf.merge',
        engine: 'pdf-lib',
        outputType: 'pdf',
        operation: vi.fn(async (b: Blob[]) => new Blob(b, { type: 'application/pdf' })),
        isStub: false,
        deriveMetadata: derive,
      },
      ctx
    );
    await impl.execute([makeInputAsset()], {}, makeExecCtx());
    expect(derive).toHaveBeenCalledTimes(1);
    expect(createAsset.mock.calls[0]![1].pages).toBe(5);
  });
});

// ─── createSplitCapabilityImpl ─────────────────────────────────

describe('createSplitCapabilityImpl', () => {
  it('isStub 标识应正确反映到 status', () => {
    const { ctx } = createMockContext();
    const stub = createSplitCapabilityImpl(
      {
        capability: 'pdf.split',
        engine: 'pdf-lib',
        outputType: 'pdf',
        operation: vi.fn(),
        isStub: true,
        deriveMetadata: () => ({ mimeType: 'application/pdf', size: 0, format: 'pdf' }),
      },
      ctx
    );
    expect(stub.status).toBe('stub');
    const stable = createSplitCapabilityImpl(
      {
        capability: 'pdf.split',
        engine: 'pdf-lib',
        outputType: 'pdf',
        operation: vi.fn(),
        isStub: false,
        deriveMetadata: () => ({ mimeType: 'application/pdf', size: 0, format: 'pdf' }),
      },
      ctx
    );
    expect(stable.status).toBe('stable');
  });

  it('空输入应抛错', async () => {
    const { ctx } = createMockContext();
    const impl = createSplitCapabilityImpl(
      {
        capability: 'pdf.split',
        engine: 'pdf-lib',
        outputType: 'pdf',
        operation: vi.fn(),
        isStub: false,
        deriveMetadata: () => ({ mimeType: 'application/pdf', size: 0, format: 'pdf' }),
      },
      ctx
    );
    await expect(impl.execute([], {}, makeExecCtx())).rejects.toThrow(
      'Capability "pdf.split" requires at least one input asset'
    );
  });

  it('取消信号应抛出 AbortError', async () => {
    const { ctx } = createMockContext();
    const impl = createSplitCapabilityImpl(
      {
        capability: 'pdf.split',
        engine: 'pdf-lib',
        outputType: 'pdf',
        operation: vi.fn(),
        isStub: false,
        deriveMetadata: () => ({ mimeType: 'application/pdf', size: 0, format: 'pdf' }),
      },
      ctx
    );
    const ac = new AbortController();
    ac.abort();
    await expect(
      impl.execute([makeInputAsset()], {}, makeExecCtx({ signal: ac.signal }))
    ).rejects.toThrow('Aborted');
  });

  it('应对每个输入的 outBlobs 全部 createAsset', async () => {
    const { ctx } = createMockContext();
    const op = vi.fn(async () => [
      new Blob([new Uint8Array([1])], { type: 'application/pdf' }),
      new Blob([new Uint8Array([2])], { type: 'application/pdf' }),
      new Blob([new Uint8Array([3])], { type: 'application/pdf' }),
    ]);
    const impl = createSplitCapabilityImpl(
      {
        capability: 'pdf.split',
        engine: 'pdf-lib',
        outputType: 'pdf',
        operation: op,
        isStub: false,
        deriveMetadata: (outBlob: Blob) => ({
          mimeType: 'application/pdf',
          size: outBlob.size,
          format: 'pdf',
        }),
      },
      ctx
    );
    const result = await impl.execute([makeInputAsset()], {}, makeExecCtx());
    expect(op).toHaveBeenCalledTimes(1);
    expect(ctx.runtime.createAsset).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(3);
    for (const out of result) {
      expect(out.type).toBe('pdf');
    }
  });

  it('应对每个 outBlob 调用 deriveMetadata', async () => {
    const { ctx } = createMockContext();
    const derive = vi.fn((outBlob: Blob) => ({
      mimeType: 'application/pdf',
      size: outBlob.size,
      format: 'pdf',
    }));
    const impl = createSplitCapabilityImpl(
      {
        capability: 'pdf.split',
        engine: 'pdf-lib',
        outputType: 'pdf',
        operation: vi.fn(async () => [
          new Blob([new Uint8Array([1])], { type: 'application/pdf' }),
          new Blob([new Uint8Array([2])], { type: 'application/pdf' }),
        ]),
        isStub: false,
        deriveMetadata: derive,
      },
      ctx
    );
    await impl.execute([makeInputAsset()], {}, makeExecCtx());
    expect(derive).toHaveBeenCalledTimes(2);
  });

  it('多输入应分别 split 并合并输出', async () => {
    const { ctx } = createMockContext();
    const op = vi.fn(async () => [
      new Blob([new Uint8Array([1])], { type: 'application/pdf' }),
      new Blob([new Uint8Array([2])], { type: 'application/pdf' }),
    ]);
    const impl = createSplitCapabilityImpl(
      {
        capability: 'pdf.split',
        engine: 'pdf-lib',
        outputType: 'pdf',
        operation: op,
        isStub: false,
        deriveMetadata: (outBlob: Blob) => ({
          mimeType: 'application/pdf',
          size: outBlob.size,
          format: 'pdf',
        }),
      },
      ctx
    );
    const result = await impl.execute(
      [makeInputAsset({ id: 'a' }), makeInputAsset({ id: 'b' })],
      {},
      makeExecCtx()
    );
    expect(op).toHaveBeenCalledTimes(2);
    expect(ctx.runtime.createAsset).toHaveBeenCalledTimes(4);
    expect(result).toHaveLength(4);
  });
});
