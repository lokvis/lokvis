/**
 * developer.base64 —— Base64 编解码
 *
 * 接受 mode('encode'|'decode') 与 input(内联文本或字节资产)。
 *
 * 输入来源(优先级):
 * - params.input(内联文本,优先)
 * - inputs[0] 的 Blob(任意类型)
 *
 * 输出 JSON:{
 *   mode, inputBytes, outputBytes, output,
 *   outputMimeType('text/plain' for encode/decode 结果为可打印文本,否则 'application/octet-stream')
 * }
 *
 * 跨平台:使用 Web 标准 btoa/atob(Node 16+ 全局可用) + TextEncoder/TextDecoder。
 * 不依赖 Node Buffer,确保浏览器与 Node 一致行为。
 *
 * 注意:encode 把输入字节按 Latin-1 编码后 btoa;decode 把 base64 解为原始字节,
 * 若字节为合法 UTF-8,则 output 字段同时提供 UTF-8 文本视图;否则 output 仅含 hex 表示。
 */
import type { CapabilityImplementation, PluginContext } from '@lokvis/schema';
import { createCapabilityImpl } from '@lokvis/plugin-sdk';
import { createJsonAsset, INLINE_ENGINE } from './shared.js';

/** 创建 developer.base64 能力实现 */
export function createBase64Impl(
  ctx: PluginContext
): CapabilityImplementation {
  return createCapabilityImpl(
    'developer.base64',
    INLINE_ENGINE,
    async (inputs, params, execCtx) => {
      const mode = params.mode === 'decode' ? 'decode' : 'encode';

      // 优先用内联 input,否则从 inputs[0] 读 Blob
      let inputBytes: Uint8Array;
      if (typeof params.input === 'string') {
        inputBytes = new TextEncoder().encode(params.input);
      } else if (inputs.length > 0) {
        const blob = await ctx.runtime.getAssetBlob(inputs[0]!);
        const buf = await blob.arrayBuffer();
        inputBytes = new Uint8Array(buf);
      } else {
        throw new Error(
          'developer.base64 requires either "input" parameter or an input asset'
        );
      }

      let output: string;
      let outputBytes: number;
      let outputMimeType: string;
      let outputIsHex = false;

      if (mode === 'encode') {
        // 字节 → base64
        output = bytesToBase64(inputBytes);
        outputBytes = output.length;
        outputMimeType = 'text/plain';
      } else {
        // base64 → 字节
        const decoded = base64ToBytes(inputBytesToLatin1String(inputBytes));
        outputBytes = decoded.length;
        outputMimeType = 'application/octet-stream';
        // 尝试 UTF-8 解码,成功则提供文本视图;否则提供 hex 表示
        try {
          output = new TextDecoder('utf-8', { fatal: true }).decode(decoded);
        } catch {
          output = bytesToHex(decoded);
          outputIsHex = true;
        }
      }

      execCtx.onProgress?.(1, `Base64 ${mode} complete (${outputBytes} bytes output)`);

      return [
        await createJsonAsset(ctx, {
          mode,
          inputBytes: inputBytes.length,
          outputBytes,
          outputMimeType,
          output,
          ...(mode === 'decode' ? { outputIsHex } : {}),
        }),
      ];
    }
  );
}

/** Uint8Array → base64 字符串(浏览器与 Node 通用) */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/** base64 字符串 → Uint8Array */
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** 把 Uint8Array(每字节视为 Latin-1 字符码) 转成 binary string */
function inputBytesToLatin1String(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i]!);
  }
  return s;
}

/** Uint8Array → hex 字符串 */
function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}
