/**
 * UI 层本地功能门控上限(re-export 兼容层)
 *
 * FO-05:数值单一事实源已上移至 @lokvis/schema 的 plan-limits.ts
 * （业务约束常量归 schema，AGENTS.md 约定）。本模块保留原导出面
 * （FREE_PLAN_LIMITS / PRO_PLAN_LIMITS / planLimits / UiPlanLimits），
 * 既有消费方无需改动。
 *
 * 注:批量 / 并发上限（FREE_BATCH_LIMIT / FREE_CONCURRENCY）同源于
 * schema plan-limits.ts，由 @lokvis/runtime 管辖执行。
 */
export {
  FREE_PLAN_LIMITS,
  PRO_PLAN_LIMITS,
  planLimits,
  type PlanLimits as UiPlanLimits,
} from '@lokvis/schema';
