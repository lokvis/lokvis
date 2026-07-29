/**
 * UI 层本地功能门控上限(单一来源)
 *
 * 免费 / Pro 两档的「本地功能」上限(自定义预设数、工作流槽位数)此前分散在
 * useCustomPresets / useWorkflows 各自的 FREE / PRO 常量里,易漂移。此处收敛为
 * 单一来源:各 hook 的 FREE_x_LIMIT / PRO_x_LIMIT 均从这里派生。
 *
 * 注:批量 / 并发上限(FREE_BATCH_LIMIT / FREE_CONCURRENCY)属 Runtime 运行时门控,
 * 归 @lokvis/runtime 管辖,不在本模块范围内(本模块只覆盖 UI 本地存储类功能)。
 */

/** 单档计划下的 UI 本地功能上限 */
export interface UiPlanLimits {
  /** 自定义尺寸预设数量上限 */
  customPresets: number;
  /** 工作流槽位数量上限 */
  workflows: number;
}

/** 免费档上限 */
export const FREE_PLAN_LIMITS: UiPlanLimits = {
  customPresets: 3,
  workflows: 5,
};

/** Pro 档上限(无限制) */
export const PRO_PLAN_LIMITS: UiPlanLimits = {
  customPresets: Infinity,
  workflows: Infinity,
};

/** 据 isPro 返回对应档位的上限集合 */
export function planLimits(isPro: boolean): UiPlanLimits {
  return isPro ? PRO_PLAN_LIMITS : FREE_PLAN_LIMITS;
}
