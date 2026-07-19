/**
 * developer.hash 能力测试
 *
 * 使用已知测试向量验证 SHA 与 MD5 实现的正确性。
 * 测试向量来源:
 * - SHA: NIST FIPS 180-4 测试向量(空串与 "abc")
 * - MD5: RFC 1321 测试向量
 */
import { describe, it, expect } from 'vitest';
import { createHashImpl } from '../capabilities/hash.js';
import {
  createMockContext,
  makeTextAsset,
  makeExecCtx,
  readAssetJson,
} from './helpers.js';

interface HashResult {
  algorithm: string;
  inputBytes: number;
  digest: string;
  digestHex: string;
}

describe('developer.hash', () => {
  it('sha-256 空串应匹配已知向量', async () => {
    const { ctx } = createMockContext();
    const impl = createHashImpl(ctx);

    const outputs = await impl.execute(
      [],
      { algorithm: 'sha-256', input: '' },
      makeExecCtx()
    );

    const result = (await readAssetJson(ctx, outputs[0]!)) as HashResult;
    // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(result.digestHex).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
    expect(result.algorithm).toBe('sha-256');
    expect(result.inputBytes).toBe(0);
  });

  it('sha-256 "abc" 应匹配 NIST 测试向量', async () => {
    const { ctx } = createMockContext();
    const impl = createHashImpl(ctx);

    const outputs = await impl.execute(
      [],
      { algorithm: 'sha-256', input: 'abc' },
      makeExecCtx()
    );

    const result = (await readAssetJson(ctx, outputs[0]!)) as HashResult;
    // SHA-256("abc") = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
    expect(result.digestHex).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('md5 应匹配 RFC 1321 测试向量', async () => {
    const { ctx } = createMockContext();
    const impl = createHashImpl(ctx);

    const outputs = await impl.execute(
      [],
      { algorithm: 'md5', input: 'abc' },
      makeExecCtx()
    );

    const result = (await readAssetJson(ctx, outputs[0]!)) as HashResult;
    // MD5("abc") = 900150983cd24fb0d6963f7d28e17f72
    expect(result.digestHex).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(result.algorithm).toBe('md5');
  });

  it('md5 空串应匹配 RFC 1321 测试向量', async () => {
    const { ctx } = createMockContext();
    const impl = createHashImpl(ctx);

    const outputs = await impl.execute(
      [],
      { algorithm: 'md5', input: '' },
      makeExecCtx()
    );

    const result = (await readAssetJson(ctx, outputs[0]!)) as HashResult;
    // MD5("") = d41d8cd98f00b204e9800998ecf8427e
    expect(result.digestHex).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });

  it('sha-1 与 sha-256 应产生不同结果', async () => {
    const { ctx } = createMockContext();
    const impl = createHashImpl(ctx);

    const [out1, out2] = await Promise.all([
      impl.execute([], { algorithm: 'sha-1', input: 'test' }, makeExecCtx()),
      impl.execute([], { algorithm: 'sha-256', input: 'test' }, makeExecCtx()),
    ]);

    const r1 = (await readAssetJson(ctx, out1[0]!)) as HashResult;
    const r2 = (await readAssetJson(ctx, out2[0]!)) as HashResult;
    expect(r1.digestHex).not.toBe(r2.digestHex);
    expect(r1.digestHex.length).toBe(40); // SHA-1 = 20 字节 = 40 hex
    expect(r2.digestHex.length).toBe(64); // SHA-256 = 32 字节 = 64 hex
  });

  it('不支持的算法应抛错', async () => {
    const { ctx } = createMockContext();
    const impl = createHashImpl(ctx);

    await expect(
      impl.execute([], { algorithm: 'crc32', input: 'test' }, makeExecCtx())
    ).rejects.toThrow(/Unsupported hash algorithm/);
  });

  it('应从输入资产读取数据', async () => {
    const { ctx } = createMockContext();
    const impl = createHashImpl(ctx);
    const input = makeTextAsset(ctx, 'abc');

    const outputs = await impl.execute(
      [input],
      { algorithm: 'sha-256' },
      makeExecCtx()
    );

    const result = (await readAssetJson(ctx, outputs[0]!)) as HashResult;
    expect(result.digestHex).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('缺输入应抛错', async () => {
    const { ctx } = createMockContext();
    const impl = createHashImpl(ctx);

    await expect(
      impl.execute([], { algorithm: 'sha-256' }, makeExecCtx())
    ).rejects.toThrow(/input.*asset/);
  });

  it('algorithm 缺省应为 sha-256', async () => {
    const { ctx } = createMockContext();
    const impl = createHashImpl(ctx);

    const outputs = await impl.execute([], { input: 'abc' }, makeExecCtx());

    const result = (await readAssetJson(ctx, outputs[0]!)) as HashResult;
    expect(result.algorithm).toBe('sha-256');
  });
});
