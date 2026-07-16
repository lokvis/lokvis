/**
 * Cloud 计费模块单元测试(从 mcp-server/src/__tests__/billing.test.ts 迁移,问题 A)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpBilling, createBilling } from '../index.js';
import { resolveCloudConfig } from '../cloud-config.js';
import type { AuthenticatedUser } from '../auth.js';

const makeUser = (overrides?: Partial<AuthenticatedUser>): AuthenticatedUser => ({
  id: 'user-1',
  email: 'test@lokvis.com',
  username: 'testuser',
  plan: 'cloud_pro',
  ...overrides,
});

describe('McpBilling', () => {
  let billing: McpBilling;

  beforeEach(() => {
    vi.restoreAllMocks();
    billing = new McpBilling({ apiKey: undefined });
  });

  describe('checkCloudAiCall', () => {
    it('free plan 应拒绝(quota=0)', async () => {
      const result = await billing.checkCloudAiCall(makeUser({ plan: 'free' }));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('does not include AI calls');
      expect(result.upgradeUrl).toBeDefined();
    });

    it('pro plan 应拒绝(quota=0)', async () => {
      const result = await billing.checkCloudAiCall(makeUser({ plan: 'pro' }));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('does not include AI calls');
    });

    it('cloud_pro plan 应允许(quota=10)', async () => {
      const result = await billing.checkCloudAiCall(makeUser({ plan: 'cloud_pro' }));
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });

    it('enterprise plan 应允许(quota=Infinity)', async () => {
      const result = await billing.checkCloudAiCall(makeUser({ plan: 'enterprise' }));
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(Infinity);
    });

    it('达到每日限额后应拒绝', async () => {
      const user = makeUser({ plan: 'cloud_pro' });
      // 消耗 10 次配额
      for (let i = 0; i < 10; i++) {
        await billing.recordCloudAiCall(user);
      }
      const result = await billing.checkCloudAiCall(user);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Daily AI call limit (10) reached');
      expect(result.remaining).toBe(0);
    });

    it('enterprise 不受每日限额限制', async () => {
      const user = makeUser({ plan: 'enterprise' });
      for (let i = 0; i < 100; i++) {
        await billing.recordCloudAiCall(user);
      }
      const result = await billing.checkCloudAiCall(user);
      expect(result.allowed).toBe(true);
    });

    it('不同用户的配额应独立计算', async () => {
      const user1 = makeUser({ id: 'u1', plan: 'cloud_pro' });
      const user2 = makeUser({ id: 'u2', plan: 'cloud_pro' });

      await billing.recordCloudAiCall(user1);
      await billing.recordCloudAiCall(user1);

      const r1 = await billing.checkCloudAiCall(user1);
      const r2 = await billing.checkCloudAiCall(user2);
      expect(r1.remaining).toBe(8);
      expect(r2.remaining).toBe(10);
    });

    it('未知 plan 应拒绝(quota=0)', async () => {
      const result = await billing.checkCloudAiCall(makeUser({ plan: 'unknown_plan' }));
      expect(result.allowed).toBe(false);
    });
  });

  describe('recordCloudAiCall', () => {
    it('应递增调用计数', async () => {
      const user = makeUser({ plan: 'cloud_pro' });
      await billing.recordCloudAiCall(user);
      const result = await billing.checkCloudAiCall(user);
      expect(result.remaining).toBe(9);
    });
  });

  describe('resetDailyCounters', () => {
    it('应清空所有用户的调用计数', async () => {
      const user = makeUser({ plan: 'cloud_pro' });
      await billing.recordCloudAiCall(user);
      await billing.recordCloudAiCall(user);

      billing.resetDailyCounters();

      const result = await billing.checkCloudAiCall(user);
      expect(result.remaining).toBe(10);
    });
  });

  describe('有 API Key 时获取 entitlements', () => {
    it('API 返回 entitlements 后应正确判断配额', async () => {
      const mockEntitlements = {
        plan: 'cloud_pro',
        quotas: { aiCallsPerDay: 20, workflows: 50, storageMb: 1024, maxApiKeys: 10 },
        credits: { ai: 100 },
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockEntitlements), { status: 200 })
      );

      const billingWithKey = new McpBilling({
        apiKey: 'lk_' + 'a'.repeat(64),
        apiBaseUrl: 'https://api.test.com',
      });

      const result = await billingWithKey.checkCloudAiCall(makeUser({ plan: 'cloud_pro' }));
      expect(result.allowed).toBe(true);
    });

    it('API 请求失败时应降级到 plan 静态映射', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      const billingWithKey = new McpBilling({
        apiKey: 'lk_' + 'a'.repeat(64),
      });

      // cloud_pro plan 降级后仍有 10 次/天配额
      const result = await billingWithKey.checkCloudAiCall(makeUser({ plan: 'cloud_pro' }));
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });

    it('API 返回 500 时应降级到 plan 静态映射', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Server Error', { status: 500 })
      );

      const billingWithKey = new McpBilling({
        apiKey: 'lk_' + 'a'.repeat(64),
      });

      const result = await billingWithKey.checkCloudAiCall(makeUser({ plan: 'free' }));
      expect(result.allowed).toBe(false);
    });

    it('D3: credits.ai=0 时应拒绝（余额不足）', async () => {
      const mockEntitlements = {
        plan: 'cloud_pro',
        quotas: { aiCallsPerDay: 10, workflows: 50, storageMb: 1024, maxApiKeys: 10 },
        credits: { ai: 0 },
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockEntitlements), { status: 200 })
      );

      const billingWithKey = new McpBilling({
        apiKey: 'lk_' + 'a'.repeat(64),
      });

      const result = await billingWithKey.checkCloudAiCall(makeUser({ plan: 'cloud_pro' }));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Insufficient AI credits');
      expect(result.upgradeUrl).toBeDefined();
    });

    it('D3: recordCloudAiCall 有 apiKey 时应调用 POST /v1/credits/deduct', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('{}', { status: 200 })
      );

      const billingWithKey = new McpBilling({
        apiKey: 'lk_' + 'a'.repeat(64),
        apiBaseUrl: 'https://api.test.com',
      });

      await billingWithKey.recordCloudAiCall(makeUser({ plan: 'cloud_pro' }));

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0]!;
      expect(url).toBe('https://api.test.com/v1/credits/deduct');
      expect(init?.method).toBe('POST');
      const body = JSON.parse(init?.body as string);
      expect(body.amount).toBe(1);
      expect(body.reason).toBe('consume:ai_call');
    });

    it('D3: recordCloudAiCall 无 apiKey 时不应调用 fetch', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      await billing.recordCloudAiCall(makeUser({ plan: 'cloud_pro' }));

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});

describe('createBilling', () => {
  it('应从 CloudConfig 构造 McpBilling,使用 config 的 planQuotas/upgradeUrl', async () => {
    const config = resolveCloudConfig({
      LOKVIS_API_BASE_URL: 'https://api.test.com',
      LOKVIS_UPGRADE_URL: 'https://custom.upgrade.com',
      LOKVIS_PLAN_QUOTAS_JSON: JSON.stringify({ free: 0, pro: 0, cloud_pro: 5, enterprise: Infinity }),
      LOKVIS_PRICE_PER_CALL_CENTS: '2',
    });
    const billing = createBilling(config);

    // cloud_pro plan 应有 5 次配额(来自自定义 JSON)
    const result = await billing.checkCloudAiCall(makeUser({ plan: 'cloud_pro' }));
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5);

    // free plan 拒绝时 upgradeUrl 应为自定义值
    const freeResult = await billing.checkCloudAiCall(makeUser({ plan: 'free' }));
    expect(freeResult.allowed).toBe(false);
    expect(freeResult.upgradeUrl).toBe('https://custom.upgrade.com');
  });

  it('价格文案应使用 config.pricePerCallCents', async () => {
    const mockEntitlements = {
      plan: 'cloud_pro',
      quotas: { aiCallsPerDay: 10, workflows: 50, storageMb: 1024, maxApiKeys: 10 },
      credits: { ai: 0 },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockEntitlements), { status: 200 })
    );

    const config = resolveCloudConfig({
      LOKVIS_API_KEY: 'lk_' + 'a'.repeat(64),
      LOKVIS_PRICE_PER_CALL_CENTS: '2',
    });
    const billing = createBilling(config);

    const result = await billing.checkCloudAiCall(makeUser({ plan: 'cloud_pro' }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('$0.02/call');
  });
});
