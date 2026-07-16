/**
 * Cloud 计费模块(从 mcp-server/billing.ts 迁移,问题 A)。
 *
 * 基于 plan 的 AI 调用配额控制。
 * 当前阶段(D1 未完成):仅检查 plan 级别的 aiCallsPerDay 配额。
 * D1 完成后:接入 cloud API 的 credits 余额查询与扣减。
 *
 * 设计:
 * - 本地 tool(image/pdf)不消耗 credits,无需计费
 * - cloud AI tool(ai.ocr / ai.generate-workflow 等)消耗 credits
 * - 余额不足时返回 402 + 充值链接
 */

import type { AuthenticatedUser } from './auth.js';
import type { CloudConfig } from './cloud-config.js';

/** Entitlements 响应(D1 完成后会含 credits 余额) */
interface EntitlementsResponse {
  plan: string;
  quotas: {
    aiCallsPerDay: number;
    workflows: number;
    storageMb: number;
    maxApiKeys: number;
  };
  credits: {
    ai: number;
  };
}

/** 计费检查结果 */
export interface BillingCheckResult {
  allowed: boolean;
  reason?: string;
  upgradeUrl?: string;
  remaining?: number;
}

/**
 * Cloud 计费器。
 * 检查用户是否有权调用 cloud AI tool。
 *
 * 与原 mcp-server/billing.ts 的差异:
 * - planQuotas / upgradeUrl / pricePerCallCents 来自 CloudConfig(可注入),
 *   不再硬编码
 * - 价格文案用 config.pricePerCallCents 动态生成($0.01 → ${price/100})
 */
export class McpBilling {
  private readonly apiBaseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly upgradeUrl: string;
  private readonly planQuotas: Record<string, number>;
  private readonly pricePerCallCents: number;
  private cachedEntitlements: EntitlementsResponse | undefined;
  private cacheExpiry = 0;
  private readonly dailyCallCount = new Map<string, number>(); // user.id → 今日调用次数

  constructor(options?: {
    apiKey?: string;
    apiBaseUrl?: string;
    upgradeUrl?: string;
    planQuotas?: Record<string, number>;
    pricePerCallCents?: number;
  }) {
    this.apiKey = options?.apiKey;
    this.apiBaseUrl = options?.apiBaseUrl ?? 'https://api.lokvis.com';
    this.upgradeUrl = options?.upgradeUrl ?? 'https://app.lokvis.com/billing';
    this.planQuotas = options?.planQuotas ?? {
      free: 0,
      pro: 0,
      cloud_pro: 10,
      enterprise: Infinity,
    };
    this.pricePerCallCents = options?.pricePerCallCents ?? 1;
  }

  /**
   * 检查是否允许调用 cloud AI tool。
   *
   * @param user 已验证的用户
   * @returns allowed=true 时可调用;allowed=false 时返回 402 信息
   */
  async checkCloudAiCall(user: AuthenticatedUser): Promise<BillingCheckResult> {
    // D3:获取 entitlements（含 credits 余额，来自 D1 的 ai_credit_balances.balance）
    const entitlements = await this.getEntitlements(user);

    // 检查 plan 级别配额
    const planQuota = this.planQuotas[user.plan] ?? 0;
    if (planQuota === 0) {
      return {
        allowed: false,
        reason: `Plan "${user.plan}" does not include AI calls. Upgrade to Cloud Pro.`,
        upgradeUrl: this.upgradeUrl,
      };
    }

    // 检查每日调用次数
    const todayCount = this.dailyCallCount.get(user.id) ?? 0;
    if (planQuota !== Infinity && todayCount >= planQuota) {
      return {
        allowed: false,
        reason: `Daily AI call limit (${planQuota}) reached. Resets at midnight UTC.`,
        upgradeUrl: this.upgradeUrl,
        remaining: 0,
      };
    }

    // D3:检查 credits 余额
    if (entitlements.credits.ai <= 0) {
      const priceDollars = (this.pricePerCallCents / 100).toFixed(2);
      return {
        allowed: false,
        reason: `Insufficient AI credits. Free $5 credits used up. $${priceDollars}/call thereafter.`,
        upgradeUrl: this.upgradeUrl,
      };
    }

    return {
      allowed: true,
      remaining: planQuota === Infinity ? Infinity : planQuota - todayCount,
    };
  }

  /**
   * 记录一次成功的 cloud AI tool 调用。
   * D3 已接入:调用 cloud API 扣减 AI Credits（D1 实现）。
   * fire-and-forget:网络失败不阻塞 tool 返回，但 dailyCallCount 仍递增以限流。
   */
  async recordCloudAiCall(user: AuthenticatedUser): Promise<void> {
    const count = this.dailyCallCount.get(user.id) ?? 0;
    this.dailyCallCount.set(user.id, count + 1);

    // D3:调用 cloud API 扣减 credits（1 credit = pricePerCallCents 美分）
    if (!this.apiKey) return;
    try {
      await fetch(`${this.apiBaseUrl}/v1/credits/deduct`, {
        method: 'POST',
        headers: { 'x-api-key': this.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 1, reason: 'consume:ai_call' }),
      });
    } catch {
      // fire-and-forget:扣减失败不阻塞 tool 返回
      // 降级:依赖 dailyCallCount 限流，避免无限调用
    }
  }

  /**
   * 获取用户 entitlements(缓存 5 分钟)。
   * D1 完成后:返回的 credits.ai 将为真实余额。
   */
  private async getEntitlements(user: AuthenticatedUser): Promise<EntitlementsResponse> {
    if (this.cachedEntitlements && Date.now() < this.cacheExpiry) {
      return this.cachedEntitlements;
    }

    // 无 API Key 时使用 plan 静态映射（credits 未知，不限制）
    if (!this.apiKey) {
      const fallback: EntitlementsResponse = {
        plan: user.plan,
        quotas: {
          aiCallsPerDay: this.planQuotas[user.plan] ?? 0,
          workflows: 0,
          storageMb: 0,
          maxApiKeys: 0,
        },
        // 降级:余额未知，设为 Infinity 避免误拒（宁可漏扣也不可误拒）
        credits: { ai: Number.POSITIVE_INFINITY },
      };
      return fallback;
    }

    try {
      const url = `${this.apiBaseUrl}/v1/users/me/entitlements`;
      const res = await fetch(url, {
        headers: { 'x-api-key': this.apiKey },
      });

      if (!res.ok) {
        // 降级到 plan 静态映射（credits 未知，不限制）
        const fallback: EntitlementsResponse = {
          plan: user.plan,
          quotas: {
            aiCallsPerDay: this.planQuotas[user.plan] ?? 0,
            workflows: 0,
            storageMb: 0,
            maxApiKeys: 0,
          },
          credits: { ai: Number.POSITIVE_INFINITY },
        };
        return fallback;
      }

      const data = (await res.json()) as EntitlementsResponse;
      this.cachedEntitlements = data;
      this.cacheExpiry = Date.now() + 5 * 60 * 1000;
      return data;
    } catch {
      // 降级到 plan 静态映射（credits 未知，不限制）
      const fallback: EntitlementsResponse = {
        plan: user.plan,
        quotas: {
          aiCallsPerDay: this.planQuotas[user.plan] ?? 0,
          workflows: 0,
          storageMb: 0,
          maxApiKeys: 0,
        },
        credits: { ai: Number.POSITIVE_INFINITY },
      };
      return fallback;
    }
  }

  /** 重置每日调用计数(测试/定时任务用) */
  resetDailyCounters(): void {
    this.dailyCallCount.clear();
  }
}

/**
 * 从 CloudConfig 构造 McpBilling。
 *
 * 便于 mcp-server/cli.ts 等消费方一行注入:
 * ```ts
 * const config = resolveCloudConfig();
 * const billing = createBilling(config);
 * ```
 */
export function createBilling(config: CloudConfig): McpBilling {
  return new McpBilling({
    apiKey: config.apiKey,
    apiBaseUrl: config.apiBaseUrl,
    upgradeUrl: config.upgradeUrl,
    planQuotas: config.planQuotas,
    pricePerCallCents: config.pricePerCallCents,
  });
}
