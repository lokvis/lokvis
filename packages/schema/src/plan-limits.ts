/**
 * 计划门控限额常量(FO-05 单一事实源)
 *
 * 按 AGENTS.md 约定,业务约束常量归 @lokvis/schema。Free/Pro 门控数字此前
 * 分散在 ui-react(gating.ts) / runtime(batch-processor.ts / concurrency-controller.ts)
 * 三处两个包,现统一收敛到本模块;原定义处改为 re-export。
 *
 * - FREE_BATCH_LIMIT / FREE_CONCURRENCY / PRO_CONCURRENCY:Runtime 批量与并发门控
 * - FREE_PLAN_LIMITS / PRO_PLAN_LIMITS:UI 本地存储类功能门控(预设数 / 工作流槽位)
 */

/** 免费版批量上限(W6.2) */
export const FREE_BATCH_LIMIT = 10;

/** 默认并发槽位(W6.2) */
export const FREE_CONCURRENCY = 4;
export const PRO_CONCURRENCY = 16;

/** 单档计划的 UI 本地功能上限 */
export interface PlanLimits {
  /** 自定义尺寸预设数量上限 */
  customPresets: number;
  /** 工作流槽位数量上限 */
  workflows: number;
}

/** 免费档上限 */
export const FREE_PLAN_LIMITS: PlanLimits = {
  customPresets: 3,
  workflows: 5,
};

/** Pro 档上限(无限制) */
export const PRO_PLAN_LIMITS: PlanLimits = {
  customPresets: Infinity,
  workflows: Infinity,
};

/** 据 isPro 返回对应档位的上限集合 */
export function planLimits(isPro: boolean): PlanLimits {
  return isPro ? PRO_PLAN_LIMITS : FREE_PLAN_LIMITS;
}

/** 
 * 数值来源说明：
 * - FREE_BATCH_LIMIT = 10: 免费版批量处理上限（基于产品定价策略 V3.2）
 * - FREE_CONCURRENCY = 4: 免费版最大并发数（防止资源滥用）  
 * - PRO_CONCURRENCY = 16: Pro 版并发提升 4 倍（基于付费 tier 差异）
 * - FREE_PLAN_LIMITS.customPresets = 3: 免费用户自定义预设数限制
 * - FREE_PLAN_LIMITS.workflows = 5: 免费用户本地工作流槽位限制
 */
