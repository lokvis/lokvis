/**
 * plugin-dev 测试共享辅助
 *
 * 提供 mock PluginContext 与构造 Asset / ExecutionContext 的工具函数。
 * 各能力测试文件统一复用,避免重复样板。
 */
import { vi } from 'vitest';
import type {
  Asset,
  CapabilityImplementation,
  ExecutionContext,
  PluginContext,
} from '@lokvis/schema';

/** 创建 mock PluginContext,记录注册的 capability 与创建的 asset */
export function createMockContext(): {
  ctx: PluginContext;
  registered: CapabilityImplementation[];
  createdAssets: Asset[];
} {
  const registered: CapabilityImplementation[] = [];
  const createdAssets: Asset[] = [];

  // 输入资产 ID → Blob 映射(测试可注入自定义 Blob)
  const blobMap = new Map<string, Blob>();

  const ctx: PluginContext = {
    runtime: {
      getAsset: vi.fn(async (id: string) => ({ id }) as Asset),
      importAsset: vi.fn(async () => 'asset-id'),
      getAssetBlob: vi.fn(async (asset: Asset) => {
        const blob = blobMap.get(asset.id);
        if (blob) return blob;
        // 默认返回空 Blob(测试可显式 setBlob)
        return new Blob([], { type: 'application/octet-stream' });
      }),
      createAsset: vi.fn(async (blob: Blob, metadata, type) => {
        const asset: Asset = {
          id: `out-${createdAssets.length}`,
          type,
          metadata,
          blob: { path: `memory://out-${createdAssets.length}`, size: blob.size, mimeType: metadata.mimeType },
          history: [],
          tags: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        createdAssets.push(asset);
        // 同时存入 blobMap,便于后续读取
        blobMap.set(asset.id, blob);
        return asset;
      }),
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
    log: vi.fn(),
  };

  // 暴露 blobMap 以便测试注入输入 Blob
  (ctx as unknown as { __blobMap: Map<string, Blob> }).__blobMap = blobMap;

  return { ctx, registered, createdAssets };
}

/** 为指定 asset id 注入 Blob(模拟输入资产内容) */
export function setAssetBlob(
  ctx: PluginContext,
  assetId: string,
  blob: Blob
): void {
  const map = (ctx as unknown as { __blobMap: Map<string, Blob> }).__blobMap;
  map.set(assetId, blob);
}

/** 构造一个文本输入 Asset(并注入 Blob 到 ctx) */
export function makeTextAsset(
  ctx: PluginContext,
  text: string,
  mimeType = 'text/plain'
): Asset {
  const blob = new Blob([text], { type: mimeType });
  const id = `input-${Math.random().toString(36).slice(2, 8)}`;
  const asset: Asset = {
    id,
    type: 'text',
    metadata: { mimeType, size: blob.size, format: mimeType.split('/')[1] ?? 'txt' },
    blob: { path: `memory://${id}`, size: blob.size, mimeType },
    history: [],
    tags: [],
    createdAt: 0,
    updatedAt: 0,
  };
  setAssetBlob(ctx, id, blob);
  return asset;
}

/** 构造最小 ExecutionContext */
export function makeExecCtx(overrides?: Partial<ExecutionContext>): ExecutionContext {
  return {
    workflowId: 'test-wf',
    nodeId: 'test-node',
    signal: new AbortController().signal,
    log: vi.fn(),
    ...overrides,
  };
}

/** 读取 Asset 的 JSON 内容(测试断言用) */
export async function readAssetJson(
  ctx: PluginContext,
  asset: Asset
): Promise<unknown> {
  const blob = await ctx.runtime.getAssetBlob(asset);
  const text = await blob.text();
  return JSON.parse(text);
}
