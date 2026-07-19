/**
 * developer.jwt.decode —— JWT 解码器(不验证签名)
 *
 * 接受 token(内联字符串或文本资产),解析 JWT 三段结构(header.payload.signature)。
 *
 * 输入来源(优先级):
 * - params.token(内联字符串,优先)
 * - inputs[0] 的 Blob 文本
 *
 * 输出 JSON:{
 *   header, payload, signature,
 *   headerAlg, headerTyp,
 *   payloadIat, payloadExp, payloadNbf, payloadSub, payloadIss, payloadAud
 * }
 *
 * 注意:本能力仅解码,不验证签名。任何伪造的 JWT 都能被"解码",
 * 不能据此授权任何操作。生产环境验证 JWT 必须使用专门的签名验证库。
 *
 * 实现说明:
 * - base64url 解码:把 -/_ 转换为 +/,再补 padding 后用 atob
 * - JSON 解析失败时,把原字符串作为 raw 字段返回(便于调试畸形 token)
 */
import type { Asset, CapabilityImplementation, PluginContext } from '@lokvis/schema';
import { createCapabilityImpl } from '@lokvis/plugin-sdk';
import { createJsonAsset, INLINE_ENGINE } from './shared.js';

/** 创建 developer.jwt.decode 能力实现 */
export function createJwtDecodeImpl(
  ctx: PluginContext
): CapabilityImplementation {
  return createCapabilityImpl(
    'developer.jwt.decode',
    INLINE_ENGINE,
    async (inputs, params, execCtx) => {
      const token =
        typeof params.token === 'string'
          ? params.token.trim()
          : await readFirstInputText(inputs, ctx);

      const parts = token.split('.');
      if (parts.length < 2 || parts.length > 3) {
        throw new Error(
          `Invalid JWT format: expected 2 or 3 parts separated by '.', got ${parts.length}`
        );
      }

      const [headerRaw, payloadRaw, signatureRaw] = parts;

      const header = decodeJwtPart(headerRaw!);
      const payload = decodeJwtPart(payloadRaw!);
      const signature =
        signatureRaw !== undefined && signatureRaw.length > 0
          ? signatureRaw
          : undefined;

      execCtx.onProgress?.(1, 'JWT decoded (no signature verification)');

      return [
        await createJsonAsset(ctx, {
          header,
          payload,
          signature,
          // 常见字段提取(便于 UI 快速展示)
          headerAlg: typeof header.alg === 'string' ? header.alg : undefined,
          headerTyp: typeof header.typ === 'string' ? header.typ : undefined,
          payloadIat: typeof payload.iat === 'number' ? payload.iat : undefined,
          payloadExp: typeof payload.exp === 'number' ? payload.exp : undefined,
          payloadNbf: typeof payload.nbf === 'number' ? payload.nbf : undefined,
          payloadSub: typeof payload.sub === 'string' ? payload.sub : undefined,
          payloadIss: typeof payload.iss === 'string' ? payload.iss : undefined,
          payloadAud:
            typeof payload.aud === 'string' || Array.isArray(payload.aud)
              ? payload.aud
              : undefined,
        }),
      ];
    }
  );
}

/** 从 inputs[0] 读取文本 */
async function readFirstInputText(
  inputs: Asset[],
  ctx: PluginContext
): Promise<string> {
  if (inputs.length === 0) {
    throw new Error(
      'developer.jwt.decode requires either "token" parameter or a text input asset'
    );
  }
  const blob = await ctx.runtime.getAssetBlob(inputs[0]!);
  return (await blob.text()).trim();
}

/** base64url → UTF-8 字符串,再 JSON.parse,返回对象(非对象时包裹为 { __raw }) */
function decodeJwtPart(part: string): Record<string, unknown> {
  // base64url → base64
  let b64 = part.replace(/-/g, '+').replace(/_/g, '/');
  // 补齐 padding
  while (b64.length % 4 !== 0) {
    b64 += '=';
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const text = new TextDecoder('utf-8').decode(bytes);
  try {
    const parsed = JSON.parse(text);
    // JWT 部分按规范必须是 JSON 对象;非对象时包裹为 { __raw }
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { __raw: text, __type: typeof parsed };
  } catch {
    // JSON 解析失败时返回 raw 文本(便于调试畸形 token)
    return { __raw: text };
  }
}
