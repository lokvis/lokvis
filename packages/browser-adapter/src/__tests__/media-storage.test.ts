/**
 * MediaProbe / StorageAdapter 环境安全测试。
 *
 * Node 环境:
 * - probeImageDimensions:createImageBitmap 缺失 → undefined
 * - probeMediaDuration:document 缺失 → undefined
 * - getOpfsRoot:navigator.storage 缺失 → 抛 OpfsNotSupportedError
 */
import { describe, it, expect } from 'vitest';
import { probeImageDimensions, probeMediaDuration } from '../media-probe.js';
import { getOpfsRoot, OpfsNotSupportedError } from '../storage.js';

describe('probeImageDimensions', () => {
  it('createImageBitmap 缺失时应返回 undefined', async () => {
    const result = await probeImageDimensions(new Blob(['x']));
    expect(result).toBeUndefined();
  });
});

describe('probeMediaDuration', () => {
  it('document 缺失时应返回 undefined', async () => {
    const result = await probeMediaDuration(new Blob(['x']), 'video');
    expect(result).toBeUndefined();
  });
});

describe('getOpfsRoot', () => {
  it('OPFS 不可用时应抛 OpfsNotSupportedError', async () => {
    await expect(getOpfsRoot()).rejects.toBeInstanceOf(OpfsNotSupportedError);
  });
});
