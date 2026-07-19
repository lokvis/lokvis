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
 * - LOKVIS_PPP_PRICING_JSON:PPP 定价表 JSON 字符串(默认内置表)
 * - LOKVIS_API_KEY:可选 API Key
 *
 * K1 PPP 定价(购买力平价):不同地区不同价格,cloud 侧 apps/web 根据
 * 用户 IP 或语言推断地区,选择对应定价倍率。lokvis-open 侧仅提供配置接口,
 * 实际定价逻辑在 cloud 侧。
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
 * 默认 PPP 定价表(K1)。
 *
 * key 为 ISO 3166-1 alpha-2 国家代码或 'default' 兜底,
 * value 为价格倍率(1.0 = 原价,0.5 = 半价,0.3 = 三折)。
 *
 * 参考世界银行 GNI per capita 数据分组:
 * - 高收入(US/GB/AU/DE/FR/JP 等):1.0 原价
 * - 中高收入(BR/CN/MX/TR 等):0.5 半价
 * - 中低收入(IN/ID/VN/PH 等):0.3 三折
 * - 低收入:0.2 两折
 *
 * cloud 侧 apps/web 根据 Accept-Language 或 IP geo 选择倍率。
 */
const DEFAULT_PPP_PRICING: Record<string, number> = {
  default: 1.0,
  // 高收入国家/地区
  US: 1.0, CA: 1.0, GB: 1.0, AU: 1.0, NZ: 1.0,
  DE: 1.0, FR: 1.0, NL: 1.0, BE: 1.0, LU: 1.0,
  JP: 1.0, KR: 1.0, SG: 1.0, HK: 1.0, TW: 0.8,
  AE: 1.0, SA: 1.0, IL: 1.0, QA: 1.0, KW: 1.0,
  // 中高收入
  CN: 0.5, BR: 0.5, MX: 0.5, TR: 0.5, MY: 0.5,
  TH: 0.5, ZA: 0.5, AR: 0.4, CO: 0.4, PE: 0.4,
  // 中低收入
  IN: 0.3, ID: 0.3, VN: 0.3, PH: 0.3, EG: 0.3,
  NG: 0.3, PK: 0.3, BD: 0.3,
};

/**
 * PPP 定价表(key 为国家代码或 'default',value 为价格倍率)。
 *
 * cloud 侧 apps/web 根据 IP geo 或 Accept-Language 推断用户地区,
 * 查表得到倍率后乘以基础价格得到本地化价格。
 */
export type PppPricing = Record<string, number>;

/**
 * Cloud 配置。
 *
 * 由 resolveCloudConfig(env) 构造,mcp-server / cli.ts 通过 cloud? 参数注入。
 *
 * K1 新增 pppPricing 字段:PPP 定价表,cloud 侧 apps/web 消费。
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
  /** PPP 定价表(K1),默认 DEFAULT_PPP_PRICING,env LOKVIS_PPP_PRICING_JSON */
  pppPricing: PppPricing;
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

  // PPP 定价表:尝试解析 JSON,失败回退默认
  let pppPricing: PppPricing = DEFAULT_PPP_PRICING;
  if (env.LOKVIS_PPP_PRICING_JSON) {
    try {
      const parsed = JSON.parse(env.LOKVIS_PPP_PRICING_JSON) as Record<string, unknown>;
      const filtered: PppPricing = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
          filtered[k] = v;
        }
      }
      if (Object.keys(filtered).length > 0) {
        pppPricing = filtered;
      }
    } catch {
      // JSON 解析失败,使用默认表
    }
  }

  return {
    apiBaseUrl,
    upgradeUrl,
    planQuotas,
    pricePerCallCents,
    pppPricing,
    apiKey,
  };
}
