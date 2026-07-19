/**
 * CloudConfig 与 resolveCloudConfig 单测(问题 A)。
 *
 * 覆盖:
 * - 默认值(无 env 时返回内置默认表/地址)
 * - 各 env 覆盖路径
 * - 非法值的容错(回退默认)
 */
import { describe, it, expect } from 'vitest';
import { resolveCloudConfig } from '../cloud-config.js';

describe('resolveCloudConfig', () => {
  describe('默认值', () => {
    it('无 env 时应返回默认配置', () => {
      const config = resolveCloudConfig({});
      expect(config.apiBaseUrl).toBe('https://api.lokvis.com');
      expect(config.upgradeUrl).toBe('https://app.lokvis.com/billing');
      expect(config.pricePerCallCents).toBe(1);
      expect(config.apiKey).toBeUndefined();
    });

    it('默认 planQuotas 应含 free/pro/cloud_pro/enterprise', () => {
      const config = resolveCloudConfig({});
      expect(config.planQuotas).toEqual({
        free: 0,
        pro: 0,
        cloud_pro: 10,
        enterprise: Infinity,
      });
    });
  });

  describe('env 覆盖', () => {
    it('LOKVIS_API_BASE_URL 应覆盖 apiBaseUrl', () => {
      const config = resolveCloudConfig({
        LOKVIS_API_BASE_URL: 'https://staging.api.lokvis.com',
      });
      expect(config.apiBaseUrl).toBe('https://staging.api.lokvis.com');
    });

    it('LOKVIS_UPGRADE_URL 应覆盖 upgradeUrl', () => {
      const config = resolveCloudConfig({
        LOKVIS_UPGRADE_URL: 'https://custom.upgrade.com',
      });
      expect(config.upgradeUrl).toBe('https://custom.upgrade.com');
    });

    it('LOKVIS_API_KEY 应填入 apiKey', () => {
      const key = 'lk_' + 'a'.repeat(64);
      const config = resolveCloudConfig({ LOKVIS_API_KEY: key });
      expect(config.apiKey).toBe(key);
    });

    it('LOKVIS_PLAN_QUOTAS_JSON 应覆盖 planQuotas', () => {
      const config = resolveCloudConfig({
        LOKVIS_PLAN_QUOTAS_JSON: JSON.stringify({ free: 0, custom_plan: 99 }),
      });
      expect(config.planQuotas).toEqual({ free: 0, custom_plan: 99 });
    });

    it('LOKVIS_PLAN_QUOTAS_JSON 支持 "Infinity" 字符串值', () => {
      const config = resolveCloudConfig({
        LOKVIS_PLAN_QUOTAS_JSON: JSON.stringify({ enterprise: 'Infinity' }),
      });
      expect(config.planQuotas.enterprise).toBe(Infinity);
    });

    it('LOKVIS_PRICE_PER_CALL_CENTS 应覆盖 pricePerCallCents', () => {
      const config = resolveCloudConfig({
        LOKVIS_PRICE_PER_CALL_CENTS: '5',
      });
      expect(config.pricePerCallCents).toBe(5);
    });
  });

  describe('容错', () => {
    it('LOKVIS_PLAN_QUOTAS_JSON 非法 JSON 时回退默认表', () => {
      const config = resolveCloudConfig({
        LOKVIS_PLAN_QUOTAS_JSON: 'not-json{',
      });
      expect(config.planQuotas).toEqual({
        free: 0,
        pro: 0,
        cloud_pro: 10,
        enterprise: Infinity,
      });
    });

    it('LOKVIS_PLAN_QUOTAS_JSON 全部非法字段时回退默认表', () => {
      const config = resolveCloudConfig({
        LOKVIS_PLAN_QUOTAS_JSON: JSON.stringify({ a: 'string', b: true }),
      });
      expect(config.planQuotas).toEqual({
        free: 0,
        pro: 0,
        cloud_pro: 10,
        enterprise: Infinity,
      });
    });

    it('LOKVIS_PRICE_PER_CALL_CENTS 非法值时回退默认', () => {
      const config = resolveCloudConfig({
        LOKVIS_PRICE_PER_CALL_CENTS: 'not-a-number',
      });
      expect(config.pricePerCallCents).toBe(1);
    });

    it('LOKVIS_PRICE_PER_CALL_CENTS 负数时回退默认', () => {
      const config = resolveCloudConfig({
        LOKVIS_PRICE_PER_CALL_CENTS: '-1',
      });
      expect(config.pricePerCallCents).toBe(1);
    });

    it('LOKVIS_PRICE_PER_CALL_CENTS 小数应四舍五入为整数', () => {
      const config = resolveCloudConfig({
        LOKVIS_PRICE_PER_CALL_CENTS: '1.7',
      });
      expect(config.pricePerCallCents).toBe(2);
    });
  });

  describe('K1:PPP 定价表(pppPricing)', () => {
    it('默认 pppPricing 应含 default/US/CN/IN 等国家', () => {
      const config = resolveCloudConfig({});
      expect(config.pppPricing).toBeDefined();
      expect(config.pppPricing.default).toBe(1.0);
      expect(config.pppPricing.US).toBe(1.0);
      expect(config.pppPricing.CN).toBe(0.5);
      expect(config.pppPricing.IN).toBe(0.3);
    });

    it('LOKVIS_PPP_PRICING_JSON 应覆盖 pppPricing', () => {
      const config = resolveCloudConfig({
        LOKVIS_PPP_PRICING_JSON: '{"default":1.0,"XX":0.15}',
      });
      expect(config.pppPricing.default).toBe(1.0);
      expect(config.pppPricing.XX).toBe(0.15);
    });

    it('LOKVIS_PPP_PRICING_JSON 非法 JSON 应回退默认表', () => {
      const config = resolveCloudConfig({
        LOKVIS_PPP_PRICING_JSON: '{invalid json',
      });
      expect(config.pppPricing.default).toBe(1.0);
      expect(config.pppPricing.US).toBe(1.0);
    });

    it('LOKVIS_PPP_PRICING_JSON 含非 number 值应过滤', () => {
      const config = resolveCloudConfig({
        LOKVIS_PPP_PRICING_JSON: '{"default":1.0,"bad":"string","zero":0,"neg":-1,"ok":0.5}',
      });
      expect(config.pppPricing.default).toBe(1.0);
      expect(config.pppPricing.ok).toBe(0.5);
      expect(config.pppPricing.bad).toBeUndefined();
      expect(config.pppPricing.zero).toBeUndefined();
      expect(config.pppPricing.neg).toBeUndefined();
    });
  });

  describe('默认 process.env', () => {
    it('不传 env 参数时使用 process.env', () => {
      // 仅验证不抛错,具体值取决于运行环境
      const config = resolveCloudConfig();
      expect(typeof config.apiBaseUrl).toBe('string');
      expect(typeof config.upgradeUrl).toBe('string');
      expect(typeof config.pricePerCallCents).toBe('number');
      expect(typeof config.pppPricing).toBe('object');
    });
  });
});
