/**
 * cloud-bridge 内部共享 fetch 辅助(FO-19)。
 *
 * 统一 4 处 fetch 调用的公共逻辑:
 * - AbortController + setTimeout 超时
 * - x-api-key header 注入
 * - clearTimeout finally 清理
 *
 * 调用方自行处理 Response(ok 检查 / JSON 解析 / 错误分类)。
 */

export interface CloudFetchOptions {
  apiBaseUrl: string;
  apiKey: string;
  path: string;
  method?: 'GET' | 'POST';
  body?: unknown;
  timeoutMs: number;
  /** 额外 header(如 ai-client 需要 Content-Type) */
  extraHeaders?: Record<string, string>;
}

/**
 * 带超时 + API Key 的 fetch 封装。
 *
 * 返回原始 Response,调用方负责 ok 检查与 body 解析。
 * 超时 AbortError 不在此处捕获,由调用方按业务语义处理。
 */
export async function cloudFetch(opts: CloudFetchOptions): Promise<Response> {
  const { apiBaseUrl, apiKey, path, method = 'GET', body, timeoutMs, extraHeaders } = opts;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers: {
        'x-api-key': apiKey,
        ...extraHeaders,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
