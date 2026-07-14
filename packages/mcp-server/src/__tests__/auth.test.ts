/**
 * Auth 模块单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpAuthenticator, isValidApiKeyFormat } from '../auth.js';

describe('isValidApiKeyFormat', () => {
  it('应接受合法的 lk_ + 64 hex 格式', () => {
    const key = 'lk_' + 'a'.repeat(64);
    expect(isValidApiKeyFormat(key)).toBe(true);
  });

  it('应拒绝缺少 lk_ 前缀的 key', () => {
    const key = 'a'.repeat(64);
    expect(isValidApiKeyFormat(key)).toBe(false);
  });

  it('应拒绝长度不正确的 key', () => {
    expect(isValidApiKeyFormat('lk_' + 'a'.repeat(63))).toBe(false);
    expect(isValidApiKeyFormat('lk_' + 'a'.repeat(65))).toBe(false);
  });

  it('应拒绝包含非 hex 字符的 key', () => {
    const key = 'lk_' + 'g'.repeat(64); // g 不是 hex
    expect(isValidApiKeyFormat(key)).toBe(false);
  });

  it('应接受小写 hex 字符', () => {
    const key = 'lk_' + '0123456789abcdef'.repeat(4);
    expect(isValidApiKeyFormat(key)).toBe(true);
  });

  it('应拒绝大写 hex 字符(仅接受小写)', () => {
    const key = 'lk_' + 'A'.repeat(64);
    expect(isValidApiKeyFormat(key)).toBe(false);
  });
});

describe('McpAuthenticator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('无 API Key 时返回未认证', async () => {
    const auth = new McpAuthenticator({ apiKey: undefined });
    const result = await auth.verify();
    expect(result.authenticated).toBe(false);
    expect(result.error).toContain('No API key');
  });

  it('格式不正确的 API Key 应返回错误', async () => {
    const auth = new McpAuthenticator({ apiKey: 'invalid_key' });
    const result = await auth.verify();
    expect(result.authenticated).toBe(false);
    expect(result.error).toContain('Invalid API key format');
  });

  it('合法 key + API 返回 200 应认证成功', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@lokvis.com',
      username: 'testuser',
      plan: 'cloud_pro',
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockUser), { status: 200 })
    );

    const auth = new McpAuthenticator({
      apiKey: 'lk_' + 'a'.repeat(64),
      apiBaseUrl: 'https://api.test.com',
    });
    const result = await auth.verify();
    expect(result.authenticated).toBe(true);
    expect(result.user?.email).toBe('test@lokvis.com');
    expect(result.user?.plan).toBe('cloud_pro');
  });

  it('API 返回 401 应返回认证失败', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 })
    );

    const auth = new McpAuthenticator({
      apiKey: 'lk_' + 'a'.repeat(64),
    });
    const result = await auth.verify();
    expect(result.authenticated).toBe(false);
    expect(result.error).toContain('invalid, revoked, or expired');
  });

  it('API 返回 500 应返回错误', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Server Error', { status: 500 })
    );

    const auth = new McpAuthenticator({
      apiKey: 'lk_' + 'a'.repeat(64),
    });
    const result = await auth.verify();
    expect(result.authenticated).toBe(false);
    expect(result.error).toContain('500');
  });

  it('网络错误应返回错误(不抛异常)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const auth = new McpAuthenticator({
      apiKey: 'lk_' + 'a'.repeat(64),
    });
    const result = await auth.verify();
    expect(result.authenticated).toBe(false);
    expect(result.error).toContain('Failed to reach API');
  });

  it('应使用缓存避免重复请求', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'cached@lokvis.com',
      username: 'cached',
      plan: 'pro',
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockUser), { status: 200 })
    );

    const auth = new McpAuthenticator({
      apiKey: 'lk_' + 'a'.repeat(64),
    });

    // 第一次调用 → fetch
    const r1 = await auth.verify();
    expect(r1.authenticated).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // 第二次调用 → 应使用缓存,不再 fetch
    const r2 = await auth.verify();
    expect(r2.authenticated).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // 仍然 1 次
  });

  it('invalidateCache 后应重新请求', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@lokvis.com',
      username: 'test',
      plan: 'free',
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockUser), { status: 200 })
    );

    const auth = new McpAuthenticator({
      apiKey: 'lk_' + 'a'.repeat(64),
    });

    await auth.verify();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    auth.invalidateCache();

    await auth.verify();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('hasApiKey 应正确反映 API Key 是否提供', () => {
    const withKey = new McpAuthenticator({ apiKey: 'lk_test' });
    const withoutKey = new McpAuthenticator({ apiKey: undefined });
    expect(withKey.hasApiKey()).toBe(true);
    expect(withoutKey.hasApiKey()).toBe(false);
  });

  it('应使用自定义 apiBaseUrl', async () => {
    const mockUser = {
      id: 'u', email: 'e', username: 'u', plan: 'free',
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockUser), { status: 200 })
    );

    const auth = new McpAuthenticator({
      apiKey: 'lk_' + 'a'.repeat(64),
      apiBaseUrl: 'https://staging.api.lokvis.com',
    });
    await auth.verify();

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://staging.api.lokvis.com/v1/users/me',
      expect.objectContaining({
        headers: { 'x-api-key': 'lk_' + 'a'.repeat(64) },
      })
    );
  });
});
