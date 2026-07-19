/**
 * developer.hash —— 哈希计算器
 *
 * 接受 algorithm('sha-1'|'sha-256'|'sha-384'|'sha-512'|'md5') 与 input(内联文本或字节资产)。
 *
 * 输入来源(优先级):
 * - params.input(内联文本,优先)
 * - inputs[0] 的 Blob(任意类型)
 *
 * 输出 JSON:{ algorithm, inputBytes, digest, digestHex }
 * - digest: base64 编码的原始哈希字节(便于程序消费)
 * - digestHex: 十六进制哈希字符串(便于人工查看)
 *
 * 实现:
 * - SHA-* 使用 Web Crypto API(crypto.subtle.digest),浏览器与 Node 18+ 一致
 * - MD5 使用纯 TS 实现(Web Crypto 不支持 MD5),仅供非安全场景使用
 *
 * 安全提示:MD5 已被破解,不应用于安全场景。manifest 已在 description 中标注。
 */
import type { CapabilityImplementation, PluginContext } from '@lokvis/schema';
import { createCapabilityImpl } from '@lokvis/plugin-sdk';
import { createJsonAsset, INLINE_ENGINE } from './shared.js';

const SHA_ALGORITHMS = new Set(['sha-1', 'sha-256', 'sha-384', 'sha-512']);

/** 创建 developer.hash 能力实现 */
export function createHashImpl(
  ctx: PluginContext
): CapabilityImplementation {
  return createCapabilityImpl(
    'developer.hash',
    INLINE_ENGINE,
    async (inputs, params, execCtx) => {
      const algorithm =
        typeof params.algorithm === 'string' ? params.algorithm : 'sha-256';

      let inputBytes: Uint8Array;
      if (typeof params.input === 'string') {
        inputBytes = new TextEncoder().encode(params.input);
      } else if (inputs.length > 0) {
        const blob = await ctx.runtime.getAssetBlob(inputs[0]!);
        const buf = await blob.arrayBuffer();
        inputBytes = new Uint8Array(buf);
      } else {
        throw new Error(
          'developer.hash requires either "input" parameter or an input asset'
        );
      }

      let hashBytes: Uint8Array;
      if (SHA_ALGORITHMS.has(algorithm)) {
        // Web Crypto 要求大写连字符格式
        hashBytes = await shaDigest(algorithm.toUpperCase(), inputBytes);
      } else if (algorithm === 'md5') {
        hashBytes = md5Digest(inputBytes);
      } else {
        throw new Error(
          `Unsupported hash algorithm: ${algorithm}. Supported: sha-1, sha-256, sha-384, sha-512, md5`
        );
      }

      const digestHex = bytesToHex(hashBytes);
      const digest = bytesToBase64(hashBytes);

      execCtx.onProgress?.(1, `${algorithm} hash computed (${hashBytes.length} bytes)`);

      return [
        await createJsonAsset(ctx, {
          algorithm,
          inputBytes: inputBytes.length,
          digest,
          digestHex,
        }),
      ];
    }
  );
}

/** SHA-* via Web Crypto API */
async function shaDigest(algorithm: string, data: Uint8Array): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API (crypto.subtle) is not available in this environment');
  }
  // 复制到新 ArrayBuffer(避免 TS 5.7+ Uint8Array<ArrayBufferLike> 与 BufferSource 不兼容)
  const buffer = new ArrayBuffer(data.length);
  new Uint8Array(buffer).set(data);
  const hashBuffer = await subtle.digest(algorithm, buffer);
  return new Uint8Array(hashBuffer);
}

/** Uint8Array → hex 字符串(小写) */
function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}

/** Uint8Array → base64 字符串 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

// ============================================================================
// MD5 纯 TS 实现(RFC 1321)
// 仅用于非安全场景(如 ETag、文件指纹)。MD5 已被破解,不能用于密码或签名。
// ============================================================================

const S: number[] = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const K: number[] = [
  0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
  0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
  0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
  0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
  0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
  0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
  0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
  0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
  0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
  0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
  0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
  0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
  0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
  0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
  0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
  0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
];

/** 32 位无符号循环左移 */
function rotl(x: number, c: number): number {
  return ((x << c) | (x >>> (32 - c))) >>> 0;
}

/** 32 位无符号加法(避免精度丢失) */
function add32(a: number, b: number): number {
  return (a + b) >>> 0;
}

/** MD5 主算法:输入任意长度字节,返回 16 字节哈希 */
function md5Digest(input: Uint8Array): Uint8Array {
  // 预处理:padding 到 length ≡ 448 mod 512(以 bit 计,即 56 mod 64 字节)
  const originalLength = input.length;
  const bitLength = Math.imul(originalLength, 8);
  // 注意:JS 数字 53 位精度,2^53 以上的 length 会丢精度,但 512MB 输入足够
  const bitLengthLow = bitLength >>> 0;
  const bitLengthHigh = Math.floor(bitLength / 0x100000000) >>> 0;

  // padding:0x80 后跟 0x00,直到长度 ≡ 56 mod 64
  const padLen = (56 - (originalLength + 1) % 64 + 64) % 64;
  const padded = new Uint8Array(originalLength + 1 + padLen + 8);
  padded.set(input);
  padded[originalLength] = 0x80;
  // 末尾 8 字节:bit length(little-endian)
  const dv = new DataView(padded.buffer);
  dv.setUint32(originalLength + 1 + padLen, bitLengthLow, true);
  dv.setUint32(originalLength + 1 + padLen + 4, bitLengthHigh, true);

  // 初始化 MD buffer
  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  // 每 64 字节处理一个 chunk
  for (let chunkStart = 0; chunkStart < padded.length; chunkStart += 64) {
    const M = new Uint32Array(16);
    for (let j = 0; j < 16; j++) {
      M[j] = dv.getUint32(chunkStart + j * 4, true);
    }

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let F: number;
      let g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = add32(add32(add32(F, A), K[i]!), add32(M[g]!, 0));
      A = D;
      D = C;
      C = B;
      B = add32(B, rotl(F, S[i]!));
    }

    a0 = add32(a0, A);
    b0 = add32(b0, B);
    c0 = add32(c0, C);
    d0 = add32(d0, D);
  }

  // 输出 16 字节(little-endian)
  const out = new Uint8Array(16);
  const outDv = new DataView(out.buffer);
  outDv.setUint32(0, a0, true);
  outDv.setUint32(4, b0, true);
  outDv.setUint32(8, c0, true);
  outDv.setUint32(12, d0, true);
  return out;
}
