/**
 * getStorageUsage 单元测试(W6.7)
 *
 * 验证 runtime.getStorageUsage() 返回正确的 { usage, quota }:
 * - usage = 所有资产 metadata.size 之和
 * - quota = RuntimeConfig.storageQuota
 * - 导入/删除后 usage 实时更新
 */
import { describe, it, expect } from 'vitest';
import { LokvisRuntimeImpl } from '../runtime.js';
import { createMemoryAssetStore } from '../asset-store.js';

describe('getStorageUsage (W6.7)', () => {
  it('空 store 应返回 usage=0 + 配置的 quota', async () => {
    const runtime = new LokvisRuntimeImpl({
      assetStore: createMemoryAssetStore(),
      storageQuota: 1024,
    });
    const usage = await runtime.getStorageUsage();
    expect(usage.usage).toBe(0);
    expect(usage.quota).toBe(1024);
  });

  it('导入资产后 usage 应累加 size', async () => {
    const runtime = new LokvisRuntimeImpl({
      assetStore: createMemoryAssetStore(),
      storageQuota: 1024 * 1024,
    });
    await runtime.importAsset({
      kind: 'blob',
      blob: new Blob([new Uint8Array(100)], { type: 'image/png' }),
      name: 'a.png',
    });
    await runtime.importAsset({
      kind: 'blob',
      blob: new Blob([new Uint8Array(200)], { type: 'image/png' }),
      name: 'b.png',
    });

    const usage = await runtime.getStorageUsage();
    expect(usage.usage).toBe(300);
    expect(usage.quota).toBe(1024 * 1024);
  });

  it('删除资产后 usage 应回退', async () => {
    const runtime = new LokvisRuntimeImpl({
      assetStore: createMemoryAssetStore(),
      storageQuota: 1024 * 1024,
    });
    const id1 = await runtime.importAsset({
      kind: 'blob',
      blob: new Blob([new Uint8Array(100)], { type: 'image/png' }),
      name: 'a.png',
    });
    const id2 = await runtime.importAsset({
      kind: 'blob',
      blob: new Blob([new Uint8Array(200)], { type: 'image/png' }),
      name: 'b.png',
    });
    expect((await runtime.getStorageUsage()).usage).toBe(300);

    await runtime.removeAsset(id1);
    expect((await runtime.getStorageUsage()).usage).toBe(200);

    await runtime.removeAsset(id2);
    expect((await runtime.getStorageUsage()).usage).toBe(0);
  });

  it('默认 quota 应为 1GB', async () => {
    const runtime = new LokvisRuntimeImpl({
      assetStore: createMemoryAssetStore(),
    });
    const usage = await runtime.getStorageUsage();
    expect(usage.quota).toBe(1024 * 1024 * 1024);
  });

  it('usage 应反映富元数据提取后的真实 size(W6.4 集成)', async () => {
    // prepareImport 现在是 async 并提取富元数据,但 size 仍取 blob.size
    // getStorageUsage 应与 import 后的 metadata.size 一致
    const runtime = new LokvisRuntimeImpl({
      assetStore: createMemoryAssetStore(),
      storageQuota: 1024 * 1024,
    });
    const blob = new Blob([new Uint8Array(500)], { type: 'image/png' });
    await runtime.importAsset({ kind: 'blob', blob, name: 'a.png' });

    const assets = await runtime.listAssets();
    const usage = await runtime.getStorageUsage();
    expect(usage.usage).toBe(assets[0]!.metadata.size);
    expect(usage.usage).toBe(500);
  });
});
