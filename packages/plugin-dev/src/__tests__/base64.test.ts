/**
 * developer.base64 能力测试
 */
import { describe, it, expect } from 'vitest';
import { createBase64Impl } from '../capabilities/base64.js';
import {
  createMockContext,
  makeTextAsset,
  makeExecCtx,
  readAssetJson,
} from './helpers.js';

interface Base64Result {
  mode: 'encode' | 'decode';
  inputBytes: number;
  outputBytes: number;
  outputMimeType: string;
  output: string;
  outputIsHex?: boolean;
}

describe('developer.base64', () => {
  it('encode 应把 ASCII 文本编码为 base64', async () => {
    const { ctx } = createMockContext();
    const impl = createBase64Impl(ctx);

    const outputs = await impl.execute(
      [],
      { mode: 'encode', input: 'Hello' },
      makeExecCtx()
    );

    const result = (await readAssetJson(ctx, outputs[0]!)) as Base64Result;
    expect(result.mode).toBe('encode');
    expect(result.output).toBe(btoa('Hello'));
    expect(result.outputMimeType).toBe('text/plain');
    expect(result.inputBytes).toBe(5);
  });

  it('encode 应正确处理 UTF-8 多字节字符', async () => {
    const { ctx } = createMockContext();
    const impl = createBase64Impl(ctx);

    const outputs = await impl.execute(
      [],
      { mode: 'encode', input: '你好' },
      makeExecCtx()
    );

    const result = (await readAssetJson(ctx, outputs[0]!)) as Base64Result;
    // '你好' UTF-8 编码为 6 字节
    expect(result.inputBytes).toBe(6);
    // 验证 encode 结果可被 atob 解回字节
    const decoded = atob(result.output);
    expect(decoded.length).toBe(6);
  });

  it('decode 应把 base64 解为 UTF-8 文本', async () => {
    const { ctx } = createMockContext();
    const impl = createBase64Impl(ctx);

    const encoded = btoa('Hello');
    const outputs = await impl.execute(
      [],
      { mode: 'decode', input: encoded },
      makeExecCtx()
    );

    const result = (await readAssetJson(ctx, outputs[0]!)) as Base64Result;
    expect(result.mode).toBe('decode');
    expect(result.output).toBe('Hello');
    expect(result.outputIsHex).toBe(false);
  });

  it('decode 非 UTF-8 字节应返回 hex 表示', async () => {
    const { ctx } = createMockContext();
    const impl = createBase64Impl(ctx);

    // 0xFF 0xFE 是 BOM,但单独看不是合法 UTF-8(fatal: true 会抛错)
    const binary = new Uint8Array([0xff, 0xfe, 0x00, 0x01]);
    let binaryStr = '';
    for (const b of binary) binaryStr += String.fromCharCode(b);
    const encoded = btoa(binaryStr);

    const outputs = await impl.execute(
      [],
      { mode: 'decode', input: encoded },
      makeExecCtx()
    );

    const result = (await readAssetJson(ctx, outputs[0]!)) as Base64Result;
    expect(result.outputIsHex).toBe(true);
    expect(result.output).toBe('fffe0001');
  });

  it('应从输入资产读取数据', async () => {
    const { ctx } = createMockContext();
    const impl = createBase64Impl(ctx);
    const input = makeTextAsset(ctx, 'asset input');

    const outputs = await impl.execute([input], { mode: 'encode' }, makeExecCtx());

    const result = (await readAssetJson(ctx, outputs[0]!)) as Base64Result;
    expect(result.output).toBe(btoa('asset input'));
  });

  it('缺输入应抛错', async () => {
    const { ctx } = createMockContext();
    const impl = createBase64Impl(ctx);

    await expect(
      impl.execute([], { mode: 'encode' }, makeExecCtx())
    ).rejects.toThrow(/input.*asset/);
  });

  it('mode 缺省应为 encode', async () => {
    const { ctx } = createMockContext();
    const impl = createBase64Impl(ctx);

    const outputs = await impl.execute(
      [],
      { input: 'test' },
      makeExecCtx()
    );

    const result = (await readAssetJson(ctx, outputs[0]!)) as Base64Result;
    expect(result.mode).toBe('encode');
  });
});
