/**
 * SDK 错误类型体系单测(问题 D)
 *
 * 覆盖:
 * - AssetBlobNotFoundError 类:code / name / instanceof LokvisError
 * - fromLokvisError(RuntimeAssetBlobNotFoundError) → AssetBlobNotFoundError
 *   (不再包装为 AssetExportError,保持 runtime ↔ SDK 1:1 对应)
 * - fromLokvisError 对其他 runtime 类型化错误的映射不回归
 */
import { describe, it, expect } from 'vitest';
import {
  LokvisError,
  AssetBlobNotFoundError,
  AssetExportError,
  fromLokvisError,
} from '../errors.js';
import { AssetBlobNotFoundError as RuntimeAssetBlobNotFoundError } from '@lokvis/runtime';

describe('AssetBlobNotFoundError', () => {
  it('应继承 LokvisError', () => {
    const err = new AssetBlobNotFoundError('blob missing');
    expect(err).toBeInstanceOf(LokvisError);
    expect(err).toBeInstanceOf(AssetBlobNotFoundError);
  });

  it('code 应为 ASSET_BLOB_NOT_FOUND', () => {
    const err = new AssetBlobNotFoundError('blob missing');
    expect(err.code).toBe('ASSET_BLOB_NOT_FOUND');
  });

  it('name 应为 AssetBlobNotFoundError', () => {
    const err = new AssetBlobNotFoundError('blob missing');
    expect(err.name).toBe('AssetBlobNotFoundError');
  });

  it('应保留 cause', () => {
    const cause = new Error('underlying');
    const err = new AssetBlobNotFoundError('blob missing', cause);
    expect(err.cause).toBe(cause);
  });
});

describe('fromLokvisError(RuntimeAssetBlobNotFoundError)', () => {
  it('应返回 AssetBlobNotFoundError 实例(非 AssetExportError)', () => {
    const runtimeErr = new RuntimeAssetBlobNotFoundError('blob gone');
    const sdkErr = fromLokvisError(runtimeErr);
    expect(sdkErr).toBeInstanceOf(AssetBlobNotFoundError);
    expect(sdkErr).not.toBeInstanceOf(AssetExportError);
    expect(sdkErr.code).toBe('ASSET_BLOB_NOT_FOUND');
    expect(sdkErr.message).toBe('blob gone');
  });

  it('应保留 runtime 错误作为 cause', () => {
    const runtimeErr = new RuntimeAssetBlobNotFoundError('blob gone');
    const sdkErr = fromLokvisError(runtimeErr) as AssetBlobNotFoundError;
    expect(sdkErr.cause).toBe(runtimeErr);
  });

  it('已是 LokvisError 时原样返回', () => {
    const original = new AssetBlobNotFoundError('already sdk');
    const result = fromLokvisError(original);
    expect(result).toBe(original);
  });
});
