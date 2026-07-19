/**
 * developer.regex.test 能力测试
 */
import { describe, it, expect } from 'vitest';
import { createRegexTestImpl } from '../capabilities/regex-test.js';
import {
  createMockContext,
  makeTextAsset,
  makeExecCtx,
  readAssetJson,
} from './helpers.js';

interface RegexTestResult {
  pattern: string;
  flags: string;
  inputLength: number;
  matchCount: number;
  matches: Array<{
    match: string;
    index: number;
    groups: Record<string, string | undefined> | undefined;
  }>;
}

describe('developer.regex.test', () => {
  it('应匹配单个结果并返回索引与匹配文本', async () => {
    const { ctx } = createMockContext();
    const impl = createRegexTestImpl(ctx);

    const outputs = await impl.execute(
      [],
      { pattern: 'world', testText: 'hello world' },
      makeExecCtx()
    );

    const result = (await readAssetJson(ctx, outputs[0]!)) as RegexTestResult;
    expect(result.matchCount).toBe(1);
    expect(result.matches[0]!.match).toBe('world');
    expect(result.matches[0]!.index).toBe(6);
  });

  it('全局标志 g 应遍历所有匹配', async () => {
    const { ctx } = createMockContext();
    const impl = createRegexTestImpl(ctx);

    const outputs = await impl.execute(
      [],
      { pattern: '\\d+', flags: 'g', testText: 'a1 b22 c333' },
      makeExecCtx()
    );

    const result = (await readAssetJson(ctx, outputs[0]!)) as RegexTestResult;
    expect(result.matchCount).toBe(3);
    expect(result.matches.map((m) => m.match)).toEqual(['1', '22', '333']);
    expect(result.matches.map((m) => m.index)).toEqual([1, 4, 8]);
  });

  it('应支持具名捕获组', async () => {
    const { ctx } = createMockContext();
    const impl = createRegexTestImpl(ctx);

    const outputs = await impl.execute(
      [],
      {
        pattern: '(?<year>\\d{4})-(?<month>\\d{2})',
        testText: '2024-01 and 2025-12',
        flags: 'g',
      },
      makeExecCtx()
    );

    const result = (await readAssetJson(ctx, outputs[0]!)) as RegexTestResult;
    expect(result.matchCount).toBe(2);
    expect(result.matches[0]!.groups).toEqual({
      year: '2024',
      month: '01',
    });
    expect(result.matches[1]!.groups).toEqual({
      year: '2025',
      month: '12',
    });
  });

  it('应从输入 text 资产读取测试文本', async () => {
    const { ctx } = createMockContext();
    const impl = createRegexTestImpl(ctx);
    const input = makeTextAsset(ctx, 'foo bar baz');

    const outputs = await impl.execute(
      [input],
      { pattern: 'ba[rz]', flags: 'g' },
      makeExecCtx()
    );

    const result = (await readAssetJson(ctx, outputs[0]!)) as RegexTestResult;
    expect(result.matchCount).toBe(2);
    expect(result.matches.map((m) => m.match)).toEqual(['bar', 'baz']);
  });

  it('缺少 pattern 参数应抛错', async () => {
    const { ctx } = createMockContext();
    const impl = createRegexTestImpl(ctx);

    await expect(
      impl.execute([], { testText: 'hello' }, makeExecCtx())
    ).rejects.toThrow(/non-empty "pattern"/);
  });

  it('缺少 testText 与输入资产应抛错', async () => {
    const { ctx } = createMockContext();
    const impl = createRegexTestImpl(ctx);

    await expect(
      impl.execute([], { pattern: 'foo' }, makeExecCtx())
    ).rejects.toThrow(/testText.*input asset/);
  });

  it('非法正则应抛 SyntaxError', async () => {
    const { ctx } = createMockContext();
    const impl = createRegexTestImpl(ctx);

    await expect(
      impl.execute([], { pattern: '(unclosed', testText: 'x' }, makeExecCtx())
    ).rejects.toThrow(SyntaxError);
  });

  it('零宽全局匹配不应死循环(限制内返回)', async () => {
    const { ctx } = createMockContext();
    const impl = createRegexTestImpl(ctx);

    // /()/g 是经典零宽匹配场景(空捕获组匹配空字符串)
    const outputs = await impl.execute(
      [],
      { pattern: '()', flags: 'g', testText: 'ab' },
      makeExecCtx()
    );

    const result = (await readAssetJson(ctx, outputs[0]!)) as RegexTestResult;
    // 应在合理次数内终止(限制 10000)
    expect(result.matchCount).toBeLessThanOrEqual(10000);
    expect(result.matchCount).toBeGreaterThan(0);
  });
});
