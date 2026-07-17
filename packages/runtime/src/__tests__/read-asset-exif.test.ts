/**
 * Runtime.readAssetExif 集成测试(W7.9)
 *
 * 验证 MetadataReader 依赖反转机制端到端工作:
 * - Plugin 未安装时 readAssetExif 返回 null(优雅降级)
 * - Plugin 注册 reader 后 readAssetExif 调用 reader 返回 ExifData
 * - 非 image 资产返回 null
 *
 * 不依赖真实 exifr / Canvas:reader 函数直接 mock。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LokvisRuntimeImpl } from '../runtime.js';
import type { ExifData, MetadataReaderContext } from '@lokvis/schema';

/** 构造一个内存 runtime(不依赖 OPFS/IDB) */
function makeRuntime(): LokvisRuntimeImpl {
  return new LokvisRuntimeImpl({ enableOpfs: false, enableIndexedDB: false });
}

/** 构造一个 image Asset 并导入 runtime */
async function importImageAsset(
  runtime: LokvisRuntimeImpl,
  blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' })
): Promise<string> {
  return runtime.importAsset({ kind: 'blob', blob, name: 'test.jpg' });
}

describe('Runtime.readAssetExif', () => {
  let runtime: LokvisRuntimeImpl;

  beforeEach(() => {
    runtime = makeRuntime();
  });

  it('Plugin 未注册 reader 时应返回 null(优雅降级)', async () => {
    const id = await importImageAsset(runtime);
    const result = await runtime.readAssetExif(id);
    expect(result).toBeNull();
  });

  it('注册 reader 后应返回 ExifData', async () => {
    const id = await importImageAsset(runtime);
    const mockExif: ExifData = {
      make: 'Canon',
      model: 'EOS R5',
      iso: 400,
      fNumber: 2.8,
    };
    runtime._registerMetadataReader('image.read-exif', async () => mockExif);

    const result = await runtime.readAssetExif(id);
    expect(result).toEqual(mockExif);
  });

  it('非 image 资产应返回 null', async () => {
    // 导入一个 text 类型资产
    const textBlob = new Blob(['hello'], { type: 'text/plain' });
    const id = await runtime.importAsset({
      kind: 'blob',
      blob: textBlob,
      name: 'test.txt',
    });
    // 注册 reader,但 readAssetExif 应因 type !== image 提前返回 null
    runtime._registerMetadataReader('image.read-exif', async () => ({
      make: 'Canon',
    }));

    const result = await runtime.readAssetExif(id);
    expect(result).toBeNull();
  });

  it('reader 返回 null 时应透传 null', async () => {
    const id = await importImageAsset(runtime);
    runtime._registerMetadataReader('image.read-exif', async () => null);

    const result = await runtime.readAssetExif(id);
    expect(result).toBeNull();
  });

  it('reader 抛错时应传播异常(不静默吞掉)', async () => {
    const id = await importImageAsset(runtime);
    runtime._registerMetadataReader('image.read-exif', async () => {
      throw new Error('reader boom');
    });

    await expect(runtime.readAssetExif(id)).rejects.toThrow('reader boom');
  });

  it('同名 reader 重复注册应覆盖前者(热更新)', async () => {
    const id = await importImageAsset(runtime);
    runtime._registerMetadataReader('image.read-exif', async () => ({
      make: 'Old',
    }));
    runtime._registerMetadataReader('image.read-exif', async () => ({
      make: 'New',
    }));

    const result = await runtime.readAssetExif(id);
    expect(result?.make).toBe('New');
  });

  it('TD-3.4: 应为 reader 传入含 log 函数的 MetadataReaderContext', async () => {
    const id = await importImageAsset(runtime);
    // 用对象包装避免 TS 控制流把 captured.ctx 收窄为 null
    const captured: { ctx: MetadataReaderContext | null } = { ctx: null };
    runtime._registerMetadataReader('image.read-exif', async (_asset, ctx) => {
      captured.ctx = ctx;
      return null;
    });

    await runtime.readAssetExif(id);
    expect(captured.ctx).not.toBeNull();
    expect(typeof captured.ctx?.log).toBe('function');
  });

  it('TD-3.4: reader 调用 ctx.log("warn", ...) 应不抛错(runtime 侧 log 走 console.warn)', async () => {
    const id = await importImageAsset(runtime);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    runtime._registerMetadataReader('image.read-exif', async (_asset, ctx) => {
      ctx.log('warn', 'test warning from reader');
      return null;
    });

    await runtime.readAssetExif(id);
    // log 实现拼接 prefix + message 成单字符串(与 ExecutionContext.log 一致)
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[lokvis:read-asset-exif')
    );
    expect(warnSpy.mock.calls[0]?.[0]).toContain('test warning from reader');
    warnSpy.mockRestore();
  });
});
