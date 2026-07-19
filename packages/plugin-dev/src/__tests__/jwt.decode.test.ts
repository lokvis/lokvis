/**
 * developer.jwt.decode 能力测试
 *
 * 使用公开测试 JWT(来自 jwt.io 的示例)验证解码逻辑。
 */
import { describe, it, expect } from 'vitest';
import { createJwtDecodeImpl } from '../capabilities/jwt.decode.js';
import {
  createMockContext,
  makeTextAsset,
  makeExecCtx,
  readAssetJson,
} from './helpers.js';

interface JwtDecodeResult {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string | undefined;
  headerAlg: string | undefined;
  headerTyp: string | undefined;
  payloadIat: number | undefined;
  payloadExp: number | undefined;
  payloadSub: string | undefined;
  payloadIss: string | undefined;
}

// 来自 jwt.io 的标准示例 JWT(HS256,不用于安全用途,仅测试)
const STANDARD_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

describe('developer.jwt.decode', () => {
  it('应正确解码标准 JWT 的 header 与 payload', async () => {
    const { ctx } = createMockContext();
    const impl = createJwtDecodeImpl(ctx);

    const outputs = await impl.execute(
      [],
      { token: STANDARD_JWT },
      makeExecCtx()
    );

    const result = (await readAssetJson(ctx, outputs[0]!)) as JwtDecodeResult;
    expect(result.headerAlg).toBe('HS256');
    expect(result.headerTyp).toBe('JWT');
    expect(result.payloadSub).toBe('1234567890');
    expect(result.payloadIat).toBe(1516239022);
    expect(result.signature).toBe(
      'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    );
  });

  it('应支持从输入资产读取 token', async () => {
    const { ctx } = createMockContext();
    const impl = createJwtDecodeImpl(ctx);
    const input = makeTextAsset(ctx, STANDARD_JWT);

    const outputs = await impl.execute([input], {}, makeExecCtx());

    const result = (await readAssetJson(ctx, outputs[0]!)) as JwtDecodeResult;
    expect(result.headerAlg).toBe('HS256');
    expect(result.payloadSub).toBe('1234567890');
  });

  it('无 signature 的 JWT(2 段)应正常解码', async () => {
    const { ctx } = createMockContext();
    const impl = createJwtDecodeImpl(ctx);

    const tokenWithoutSig = STANDARD_JWT.split('.').slice(0, 2).join('.');
    const outputs = await impl.execute(
      [],
      { token: tokenWithoutSig },
      makeExecCtx()
    );

    const result = (await readAssetJson(ctx, outputs[0]!)) as JwtDecodeResult;
    expect(result.headerAlg).toBe('HS256');
    expect(result.payloadSub).toBe('1234567890');
    expect(result.signature).toBeUndefined();
  });

  it('段数不足(1 段)应抛错', async () => {
    const { ctx } = createMockContext();
    const impl = createJwtDecodeImpl(ctx);

    await expect(
      impl.execute([], { token: 'onlyonepart' }, makeExecCtx())
    ).rejects.toThrow(/Invalid JWT format/);
  });

  it('段数过多(4 段)应抛错', async () => {
    const { ctx } = createMockContext();
    const impl = createJwtDecodeImpl(ctx);

    await expect(
      impl.execute(
        [],
        { token: 'a.b.c.d' },
        makeExecCtx()
      )
    ).rejects.toThrow(/Invalid JWT format/);
  });

  it('缺 token 与输入资产应抛错', async () => {
    const { ctx } = createMockContext();
    const impl = createJwtDecodeImpl(ctx);

    await expect(impl.execute([], {}, makeExecCtx())).rejects.toThrow(
      /token.*input asset/
    );
  });

  it('header JSON 解析失败时应在 __raw 字段返回原文', async () => {
    const { ctx } = createMockContext();
    const impl = createJwtDecodeImpl(ctx);

    // header 段是 "notjson" 的 base64url 编码 → 解码后非 JSON
    const headerB64 = btoa('notjson').replace(/=/g, '');
    const payloadB64 = btoa('{"sub":"x"}').replace(/=/g, '');
    const token = `${headerB64}.${payloadB64}`;

    const outputs = await impl.execute([], { token }, makeExecCtx());

    const result = (await readAssetJson(ctx, outputs[0]!)) as JwtDecodeResult;
    expect(result.header.__raw).toBe('notjson');
    expect(result.payload.sub).toBe('x');
  });

  it('应正确处理 base64url 编码(含 - 和 _)', async () => {
    const { ctx } = createMockContext();
    const impl = createJwtDecodeImpl(ctx);

    // 构造一个 payload 包含需要 base64url 编码(-/_)的字节
    // JSON: {"_id":"a-b"}  base64url 编码后可能含 - 和 _
    const payloadJson = JSON.stringify({ _id: 'a-b_c' });
    const payloadBytes = new TextEncoder().encode(payloadJson);
    let binary = '';
    for (const b of payloadBytes) binary += String.fromCharCode(b);
    const payloadB64url = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const headerB64url = btoa('{"alg":"none","typ":"JWT"}').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const token = `${headerB64url}.${payloadB64url}`;

    const outputs = await impl.execute([], { token }, makeExecCtx());

    const result = (await readAssetJson(ctx, outputs[0]!)) as JwtDecodeResult;
    expect(result.payload._id).toBe('a-b_c');
  });
});
