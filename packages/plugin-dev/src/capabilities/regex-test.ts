/**
 * developer.regex.test —— 正则表达式测试器
 *
 * 接受 pattern/flags/testText,返回所有匹配项(match / groups / index / input)。
 *
 * 输入来源(优先级从高到低):
 * 1. params.testText(内联文本,优先)
 * 2. inputs[0] 的 Blob 文本(text 资产)
 *
 * 输出 JSON:{ pattern, flags, matchCount, matches: [{ match, index, groups }] }
 *
 * 安全:不使用 eval,直接 new RegExp(pattern, flags)。非法 pattern 抛 SyntaxError
 * (由调用方处理,本能力不捕获 —— 让用户看到原始错误信息)。
 */
import type { Asset, CapabilityImplementation, PluginContext } from '@lokvis/schema';
import { createCapabilityImpl } from '@lokvis/plugin-sdk';
import { createJsonAsset, INLINE_ENGINE } from './shared.js';

/** 创建 developer.regex.test 能力实现 */
export function createRegexTestImpl(
  ctx: PluginContext
): CapabilityImplementation {
  return createCapabilityImpl(
    'developer.regex.test',
    INLINE_ENGINE,
    async (inputs, params, execCtx) => {
      const pattern = params.pattern as string | undefined;
      if (typeof pattern !== 'string' || pattern.length === 0) {
        throw new Error('developer.regex.test requires non-empty "pattern" parameter');
      }
      const flags = typeof params.flags === 'string' ? params.flags : '';

      const testText =
        typeof params.testText === 'string'
          ? params.testText
          : await readFirstInputText(inputs, ctx);

      // new RegExp 不安全? pattern 是用户输入,但 RegExp 构造本身不会执行代码,
      // 仅可能抛 SyntaxError(非法正则)。我们让 SyntaxError 上抛,用户得到明确反馈。
      const regex = new RegExp(pattern, flags);

      const matches: Array<{
        match: string;
        index: number;
        groups: Record<string, string | undefined> | undefined;
      }> = [];

      // 全局标志 g 时遍历所有匹配;否则只取第一个
      if (flags.includes('g')) {
        let m: RegExpExecArray | null;
        // 防止恶意输入导致死循环(如 /()/g 匹配空字符串):限制最多 10000 个匹配
        const MAX_MATCHES = 10000;
        while ((m = regex.exec(testText)) !== null && matches.length < MAX_MATCHES) {
          matches.push({
            match: m[0],
            index: m.index,
            groups: m.groups ??
              (m.length > 1 ? arrayToGroups(m) : undefined),
          });
          // 防止零宽匹配导致死循环:exec 不前进时手动 +1
          if (m.index === regex.lastIndex) {
            regex.lastIndex++;
          }
        }
      } else {
        const m = regex.exec(testText);
        if (m) {
          matches.push({
            match: m[0],
            index: m.index,
            groups: m.groups ??
              (m.length > 1 ? arrayToGroups(m) : undefined),
          });
        }
      }

      execCtx.onProgress?.(1, `Found ${matches.length} matches`);
      return [
        await createJsonAsset(ctx, {
          pattern,
          flags,
          inputLength: testText.length,
          matchCount: matches.length,
          matches,
        }),
      ];
    }
  );
}

/** 从 inputs[0] 读取文本(若为 text/data 资产) */
async function readFirstInputText(
  inputs: Asset[],
  ctx: PluginContext
): Promise<string> {
  if (inputs.length === 0) {
    throw new Error(
      'developer.regex.test requires either "testText" parameter or a text input asset'
    );
  }
  const blob = await ctx.runtime.getAssetBlob(inputs[0]!);
  return await blob.text();
}

/**
 * 把 RegExpExecArray 转为 named groups 对象(无 named groups 时返回数字键)。
 * 仅在 regex 未使用具名组且 m.length > 1 时调用,用于兼容旧式捕获组。
 */
function arrayToGroups(
  m: RegExpExecArray
): Record<string, string | undefined> | undefined {
  // 若 regex 没有命名组,groups 应为 undefined(与 m.groups 行为一致)
  // 这里仅在 m.length > 1 时提供数字索引的 groups,便于用户查阅捕获组
  const groups: Record<string, string | undefined> = {};
  for (let i = 1; i < m.length; i++) {
    groups[String(i)] = m[i];
  }
  return groups;
}
