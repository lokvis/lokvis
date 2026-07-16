/**
 * Cloud 配置接口与 env 解析(问题 A)。
 *
 * 把原 mcp-server 硬编码的 cloud 地址 / 配额表 / 价格文案集中到 CloudConfig,
 * 通过 resolveCloudConfig(env) 统一从环境变量读取(含默认值),使 cloud 逻辑
 * 可注入、可测试、可自部署。
 *
 * 环境变量:
 * - LOKVIS_API_BASE_URL:cloud API 地址(默认 https://api.lokvis.com)
 * - LOKVIS_UPGRADE_URL:充值链接(默认 https://app.lokvis.com/billing)
 * - LOKVIS_PLAN_QUOTAS_JSON:plan 配额表 JSON 字符串(默认内置表)
 * - LOKVIS_PRICE_PER_CALL_CENTS:每次 AI 调用价格美分(默认 1)
 * - LOKVIS_API_KEY:可选 API Key
 */

/** 默认 plan 配额表(与 cloud 侧 PLAN_ENTITLEMENTS 对齐) */
const DEFAULT_PLAN_QUOTAS: Record<string, number> = {
  free: 0,
  pro: 0,
  cloud_pro: 10,
  enterprise: Infinity,
};

/** 默认 cloud API 地址 */
const DEFAULT_API_BASE_URL = 'https://api.lokvis.com';

/** 默认充值链接 */
const DEFAULT_UPGRADE_URL = 'https://app.lokvis.com/billing';

/** 默认每次 AI 调用价格(美分) */
const DEFAULT_PRICE_PER_CALL_CENTS = 1;

/**
 * Cloud 配置(apiBaseUrl / upgradeUrl / planQuotas / pricePerCallCents / apiKey)。
 *
 * 由 resolveCloudConfig(env) 构造,mcp-server / cli.ts 通过 cloud? 参数注入。
 */
export interface CloudConfig {
  /** cloud API 地址,默认 'https://api.lokvis.com',env LOKVIS_API_BASE_URL */
  apiBaseUrl: string;
  /** 充值链接,默认 'https://app.lokvis.com/billing',env LOKVIS_UPGRADE_URL */
  upgradeUrl: string;
  /** plan 配额表,默认 { free:0, pro:0, cloud_pro:10, enterprise:Infinity },env LOKVIS_PLAN_QUOTAS_JSON */
  planQuotas: Record<string, number>;
  /** 每次 AI 调用价格(美分),默认 1,env LOKVIS_PRICE_PER_CALL_CENTS */
  pricePerCallCents: number;
  /** 可选 API Key,env LOKVIS_API_KEY */
  apiKey?: string;
}

/**
 * 从环境变量解析 CloudConfig。
 *
 * 所有字段均有默认值,无 env 时返回纯默认配置。
 * LOKVIS_PLAN_QUOTAS_JSON 解析失败时回退到默认表(不抛错,保证启动不中断)。
 *
 * @param env 环境变量对象(默认 process.env,测试可注入)
 */
export function resolveCloudConfig(
  env: NodeJS.ProcessEnv = process.env
): CloudConfig {
  const apiBaseUrl = env.LOKVIS_API_BASE_URL ?? DEFAULT_API_BASE_URL;
  const upgradeUrl = env.LOKVIS_UPGRADE_URL ?? DEFAULT_UPGRADE_URL;
  const apiKey = env.LOKVIS_API_KEY;

  // plan 配额表:尝试解析 JSON,失败回退默认
  let planQuotas = DEFAULT_PLAN_QUOTAS;
  if (env.LOKVIS_PLAN_QUOTAS_JSON) {
    try {
      const parsed = JSON.parse(env.LOKVIS_PLAN_QUOTAS_JSON) as Record<string, unknown>;
      // 仅保留 number 值,过滤非法字段
      const filtered: Record<string, number> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'number' && Number.isFinite(v)) {
          filtered[k] = v;
        } else if (v === 'Infinity' || (typeof v === 'string' && v === 'Infinity')) {
          filtered[k] = Infinity;
        }
      }
      if (Object.keys(filtered).length > 0) {
        planQuotas = filtered;
      }
    } catch {
      // JSON 解析失败,使用默认表
    }
  }

  // 每次调用价格:解析为正整数,非法值回退默认
  let pricePerCallCents = DEFAULT_PRICE_PER_CALL_CENTS;
  if (env.LOKVIS_PRICE_PER_CALL_CENTS !== undefined) {
    const parsed = Number(env.LOKVIS_PRICE_PER_CALL_CENTS);
    if (Number.isFinite(parsed) && parsed >= 0) {
      pricePerCallCents = Math.round(parsed);
    }
  }

  return {
    apiBaseUrl,
    upgradeUrl,
    planQuotas,
    pricePerCallCents,
    apiKey,
  };
}
