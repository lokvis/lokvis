/**
 * PPP（购买力平价）定价表
 *
 * 根据 World Bank PPP 指数调整不同地区的 Pro 订阅价格。
 * cloud 侧 apps/web 消费此配置，lokvis-open 侧仅提供数据源。
 *
 * 基准价：$9/月（美国）
 * PPP 调整：按国家/地区的购买力平价指数折扣
 */

export interface PppPricing {
  /** 国家/地区代码（ISO 3166-1 alpha-2） */
  country: string;
  /** 国家/地区名称（英文） */
  countryName: string;
  /** 月费（USD） */
  monthlyPrice: number;
  /** 年费（USD） */
  yearlyPrice: number;
  /** PPP 折扣率（0-1，1 = 无折扣） */
  pppFactor: number;
  /** 货币代码（ISO 4217） */
  currency: string;
}

/** 基准价格（美国） */
export const BASE_MONTHLY_PRICE = 9;
export const BASE_YEARLY_PRICE = 90;

/**
 * PPP 定价表（按国家/地区）
 *
 * 数据来源：World Bank PPP 指数（2024）
 * 折扣规则：高收入国家无折扣，中等收入国家 60-80%，低收入国家 30-50%
 */
export const PPP_PRICING_TABLE: PppPricing[] = [
  // 高收入（无折扣）
  { country: 'US', countryName: 'United States', monthlyPrice: 9, yearlyPrice: 90, pppFactor: 1.0, currency: 'USD' },
  { country: 'GB', countryName: 'United Kingdom', monthlyPrice: 9, yearlyPrice: 90, pppFactor: 1.0, currency: 'GBP' },
  { country: 'DE', countryName: 'Germany', monthlyPrice: 9, yearlyPrice: 90, pppFactor: 1.0, currency: 'EUR' },
  { country: 'FR', countryName: 'France', monthlyPrice: 9, yearlyPrice: 90, pppFactor: 1.0, currency: 'EUR' },
  { country: 'JP', countryName: 'Japan', monthlyPrice: 9, yearlyPrice: 90, pppFactor: 1.0, currency: 'JPY' },
  { country: 'AU', countryName: 'Australia', monthlyPrice: 9, yearlyPrice: 90, pppFactor: 1.0, currency: 'AUD' },
  { country: 'CA', countryName: 'Canada', monthlyPrice: 9, yearlyPrice: 90, pppFactor: 1.0, currency: 'CAD' },
  { country: 'KR', countryName: 'South Korea', monthlyPrice: 8, yearlyPrice: 80, pppFactor: 0.89, currency: 'KRW' },
  { country: 'TW', countryName: 'Taiwan', monthlyPrice: 7, yearlyPrice: 70, pppFactor: 0.78, currency: 'TWD' },
  // 中等收入（60-80%）
  { country: 'CN', countryName: 'China', monthlyPrice: 6, yearlyPrice: 60, pppFactor: 0.67, currency: 'CNY' },
  { country: 'BR', countryName: 'Brazil', monthlyPrice: 5, yearlyPrice: 50, pppFactor: 0.56, currency: 'BRL' },
  { country: 'MX', countryName: 'Mexico', monthlyPrice: 5, yearlyPrice: 50, pppFactor: 0.56, currency: 'MXN' },
  { country: 'TR', countryName: 'Turkey', monthlyPrice: 4, yearlyPrice: 40, pppFactor: 0.44, currency: 'TRY' },
  { country: 'TH', countryName: 'Thailand', monthlyPrice: 4, yearlyPrice: 40, pppFactor: 0.44, currency: 'THB' },
  { country: 'ID', countryName: 'Indonesia', monthlyPrice: 4, yearlyPrice: 40, pppFactor: 0.44, currency: 'IDR' },
  { country: 'PH', countryName: 'Philippines', monthlyPrice: 4, yearlyPrice: 40, pppFactor: 0.44, currency: 'PHP' },
  { country: 'VN', countryName: 'Vietnam', monthlyPrice: 4, yearlyPrice: 40, pppFactor: 0.44, currency: 'VND' },
  { country: 'IN', countryName: 'India', monthlyPrice: 3, yearlyPrice: 30, pppFactor: 0.33, currency: 'INR' },
  // 低收入（30-50%）
  { country: 'PK', countryName: 'Pakistan', monthlyPrice: 3, yearlyPrice: 30, pppFactor: 0.33, currency: 'PKR' },
  { country: 'NG', countryName: 'Nigeria', monthlyPrice: 3, yearlyPrice: 30, pppFactor: 0.33, currency: 'NGN' },
  { country: 'EG', countryName: 'Egypt', monthlyPrice: 3, yearlyPrice: 30, pppFactor: 0.33, currency: 'EGP' },
];

/** 根据 IP 地理位置获取 PPP 定价（cloud 侧调用） */
export function getPppPricing(country: string): PppPricing {
  return PPP_PRICING_TABLE.find((p) => p.country === country)
    ?? { country: 'US', countryName: 'United States', monthlyPrice: BASE_MONTHLY_PRICE, yearlyPrice: BASE_YEARLY_PRICE, pppFactor: 1.0, currency: 'USD' };
}
