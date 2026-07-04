/**
 * useShareLink - 分享链接生成与解析(W11.5)
 *
 * 把当前工作流节点序列编码为 base64 URL 参数,生成可分享的链接。
 * 接收方打开链接即可还原工作流(本地 base64,无需 cloud 短链)。
 *
 * 编码格式:
 *   `<origin><pathname>?workflow=<base64url-encoded-json>`
 *
 * 其中 JSON 结构为 `{ v: 1, nodes: [{c, p}] }`(v=版本号,向前兼容)。
 * 使用 base64url 编码(URL 安全,无 +/= 字符)。
 *
 * 注意:
 *   - base64 编码会膨胀约 33%,长工作流可能超过 URL 长度限制(浏览器 ~2KB 安全,~8KB 极限)
 *   - 5 步工作流通常远小于限制
 *   - 不包含 asset 引用(asset 是本地文件,无法跨设备分享)
 *
 * @module useShareLink
 */

import { useCallback } from 'react';
import { useWorkspaceStore } from '../store/index.js';

/** 分享链接编码的数据结构 */
interface ShareableWorkflow {
  /** 版本号(向前兼容) */
  v: 1;
  /** 节点序列(精简字段:c=capability, p=params) */
  nodes: Array<{ c: string; p: Record<string, unknown> }>;
}

/** 标准 base64 → base64url(URL 安全: + → -, / → _, 去除 = 填充) */
function toBase64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64url → 标准 base64 */
function fromBase64Url(b64url: string): string {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  // 补齐 padding
  const pad = b64.length % 4;
  if (pad) b64 += '='.repeat(4 - pad);
  return b64;
}

/** UTF-8 安全的 base64 编码(处理非 ASCII 字符如中文水印) */
function encodeUtf8Base64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return toBase64Url(btoa(binary));
}

/** UTF-8 安全的 base64url 解码 */
function decodeUtf8Base64Url(b64url: string): string {
  const b64 = fromBase64Url(b64url);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * 编码工作流节点为 base64url 字符串(用于分享链接)。
 * 导出供测试与外部直接使用。
 */
export function encodeWorkflowForShare(
  nodes: ReadonlyArray<{ capability: string; params: Record<string, unknown> }>
): string {
  const data: ShareableWorkflow = {
    v: 1,
    nodes: nodes.map((n) => ({ c: n.capability, p: n.params })),
  };
  return encodeUtf8Base64Url(JSON.stringify(data));
}

/**
 * 解码 base64url 字符串为工作流节点。
 * @returns 节点数组;解析失败返回 null。
 */
export function decodeWorkflowFromShare(
  encoded: string
): Array<{ capability: string; params: Record<string, unknown> }> | null {
  try {
    const json = decodeUtf8Base64Url(encoded);
    const data = JSON.parse(json) as ShareableWorkflow;
    if (!data || typeof data !== 'object' || data.v !== 1 || !Array.isArray(data.nodes)) {
      return null;
    }
    return data.nodes.map((n) => ({
      capability: String(n.c),
      params: (n.p && typeof n.p === 'object' ? n.p : {}) as Record<string, unknown>,
    }));
  } catch {
    return null;
  }
}

export interface UseShareLinkResult {
  /**
   * 生成分享链接(基于当前 store 中的 nodes)。
   * 返回完整 URL;若 nodes 为空返回 null。
   */
  generateShareUrl(): string | null;
  /**
   * 从 URL 解析工作流节点。
   * @param url 完整 URL 或仅 search 部分
   * @returns 节点数组;无 workflow 参数或解析失败返回 null
   */
  parseShareUrl(url: string): Array<{ capability: string; params: Record<string, unknown> }> | null;
  /**
   * 从当前页面 URL 加载工作流(若有 ?workflow=)。
   * @returns true 表示成功加载并应用到 store
   */
  loadFromCurrentUrl(): boolean;
}

export function useShareLink(): UseShareLinkResult {
  const nodes = useWorkspaceStore((s) => s.nodes);
  const loadWorkflowTemplate = useWorkspaceStore((s) => s.loadWorkflowTemplate);

  const generateShareUrl = useCallback((): string | null => {
    if (nodes.length === 0) return null;
    const encoded = encodeWorkflowForShare(nodes);
    if (typeof window === 'undefined') return null;
    const { origin, pathname } = window.location;
    return `${origin}${pathname}?workflow=${encoded}`;
  }, [nodes]);

  const parseShareUrl = useCallback(
    (url: string): Array<{ capability: string; params: Record<string, unknown> }> | null => {
      const searchPart = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
      const params = new URLSearchParams(searchPart);
      const encoded = params.get('workflow');
      if (!encoded) return null;
      return decodeWorkflowFromShare(encoded);
    },
    []
  );

  const loadFromCurrentUrl = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    const parsed = parseShareUrl(window.location.href);
    if (!parsed || parsed.length === 0) return false;
    loadWorkflowTemplate(parsed);
    return true;
  }, [parseShareUrl, loadWorkflowTemplate]);

  return {
    generateShareUrl,
    parseShareUrl,
    loadFromCurrentUrl,
  };
}
