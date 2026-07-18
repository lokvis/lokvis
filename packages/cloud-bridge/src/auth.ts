/**
 * Cloud 鉴权模块(从 mcp-server/auth.ts 迁移,问题 A)。
 *
 * 通过 lokvis-cloud API 验证 `lk_` API Key,获取用户信息与 plan。
 * 本地 tool(image/pdf)无需鉴权即可使用;cloud AI tool 需有效 API Key。
 *
 * 验证流程:
 * 1. 启动时调用 GET /v1/users/me(header: x-api-key)
 * 2. 成功 → 缓存用户信息(5 分钟 TTL)
 * 3. 失败 → 警告并降级为"仅本地模式"
 */

import type { CloudConfig } from './cloud-config.js';

/** API Key 格式校验:lk_ + 64 位 hex */
export function isValidApiKeyFormat(key: string): boolean {
  if (!key.startsWith('lk_')) return false;
  if (key.length !== 67) return false;
  const hexPart = key.slice(3);
  return /^[0-9a-f]{64}$/.test(hexPart);
}

/** 缓存 TTL(5 分钟) */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** verify() 请求超时(30s,防止 cloud API 不可达时长时间挂起) */
const VERIFY_TIMEOUT_MS = 30_000;

/** 验证后的用户信息 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  plan: string;
  preferred_language?: string;
}

/** 鉴权结果 */
export interface AuthResult {
  authenticated: boolean;
  user?: AuthenticatedUser;
  error?: string;
}

/**
 * Cloud 鉴权器。
 * 缓存用户信息,定期重新验证。
 */
export class CloudAuthenticator {
  private readonly apiKey: string | undefined;
  private readonly apiBaseUrl: string;
  private cachedUser: AuthenticatedUser | undefined;
  private cacheExpiry = 0;

  constructor(options?: {
    apiKey?: string;
    apiBaseUrl?: string;
  }) {
    this.apiKey = options?.apiKey;
    this.apiBaseUrl = options?.apiBaseUrl ?? 'https://api.lokvis.com';
  }

  /** 是否配置了 API Key */
  hasApiKey(): boolean {
    return !!this.apiKey;
  }

  /**
   * 验证 API Key,返回用户信息。
   * 使用缓存避免每次 tool 调用都打 API。
   */
  async verify(): Promise<AuthResult> {
    if (!this.apiKey) {
      return { authenticated: false, error: 'No API key provided (local-only mode)' };
    }

    if (!isValidApiKeyFormat(this.apiKey)) {
      return { authenticated: false, error: 'Invalid API key format (expected lk_ + 64 hex chars)' };
    }

    // 缓存未过期
    if (this.cachedUser && Date.now() < this.cacheExpiry) {
      return { authenticated: true, user: this.cachedUser };
    }

    try {
      const url = `${this.apiBaseUrl}/v1/users/me`;
      // 30s 超时:防止 cloud API 不可达时长时间挂起,mcp-server 启动不被阻塞
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(url, {
          headers: { 'x-api-key': this.apiKey },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        if (res.status === 401) {
          return { authenticated: false, error: 'API key is invalid, revoked, or expired' };
        }
        return { authenticated: false, error: `API returned ${res.status}` };
      }

      const data = (await res.json()) as AuthenticatedUser;
      this.cachedUser = data;
      this.cacheExpiry = Date.now() + CACHE_TTL_MS;
      return { authenticated: true, user: data };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { authenticated: false, error: `API request timed out after ${VERIFY_TIMEOUT_MS}ms` };
      }
      return { authenticated: false, error: `Failed to reach API: ${err}` };
    }
  }

  /** 清除缓存(下次 verify 重新验证) */
  invalidateCache(): void {
    this.cachedUser = undefined;
    this.cacheExpiry = 0;
  }
}

/**
 * 从 CloudConfig 构造 CloudAuthenticator。
 *
 * 便于 mcp-server/cli.ts 等消费方一行注入:
 * ```ts
 * const config = resolveCloudConfig();
 * const authenticator = createAuthenticator(config);
 * ```
 */
export function createAuthenticator(config: CloudConfig): CloudAuthenticator {
  return new CloudAuthenticator({
    apiKey: config.apiKey,
    apiBaseUrl: config.apiBaseUrl,
  });
}
