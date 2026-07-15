/**
 * Playground 代码分享工具(W19.6)
 *
 * 把用户代码编码为 URL-safe base64,用于通过 URL hash 分享:
 *   https://playground.lokvis.dev/#code=<base64>
 *
 * URL-safe base64 与 RFC 4648 §5 一致:
 *  - '+' → '-'
 *  - '/' → '_'
 *  - 去除 '=' 填充
 * 支持 UTF-8(中文代码),通过 TextEncoder/TextDecoder 转换。
 */

const URL_HASH_KEY = 'code';

/** 编码代码为 URL-safe base64(支持 UTF-8) */
export function encodeCodeToHash(code: string): string {
  const bytes = new TextEncoder().encode(code);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 解码 URL-safe base64 → 代码;失败返回 null(不抛错,调用方处理) */
export function decodeCodeFromHash(encoded: string): string | null {
  try {
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** 从完整 hash 字符串(如 "#code=xxx")中提取并解码代码;无匹配返回 null */
export function extractCodeFromHash(hash: string): string | null {
  if (!hash.startsWith(`#${URL_HASH_KEY}=`)) return null;
  const encoded = hash.slice(URL_HASH_KEY.length + 2);
  return decodeCodeFromHash(encoded);
}

/** 拼接完整分享 URL: origin + pathname + #code=<encoded> */
export function buildShareUrl(code: string): string {
  const encoded = encodeCodeToHash(code);
  return `${location.origin}${location.pathname}#${URL_HASH_KEY}=${encoded}`;
}
