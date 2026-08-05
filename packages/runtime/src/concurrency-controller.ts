/**
 * ConcurrencyController - 批量作业并发槽位控制(W4.4 拆分)
 *
 * 职责:
 * - 提供免费/Pro 默认并发上限常量
 * - 按 MemoryGuard 压力动态收缩并发槽位
 *
 * 设计原则:
 * - 无状态:仅依赖注入的 memoryGuard
 * - 纯函数:current() 基于 baseConcurrency + 当前 pressure 计算
 */
import type { MemoryGuard, MemoryPressure } from './memory-guard.js';

// FO-05:默认并发槽位单一事实源在 @lokvis/schema plan-limits.ts,此处 re-export
export { FREE_CONCURRENCY, PRO_CONCURRENCY } from '@lokvis/schema';

/** 按 MemoryPressure 收缩并发槽位 */
export function shrinkConcurrencyByPressure(
  base: number,
  pressure: MemoryPressure
): number {
  switch (pressure) {
    case 'critical':
      return 1;
    case 'high':
      return Math.max(1, Math.floor(base / 2));
    case 'elevated':
      return Math.max(2, Math.floor((base * 3) / 4));
    default:
      return base;
  }
}

/**
 * 并发控制器:基于 MemoryGuard 压力动态收缩槽位。
 *
 * 不持有 baseConcurrency(每 job 独立),current() 接收 base 并返回当前实际可用槽位。
 */
export class ConcurrencyController {
  private readonly memoryGuard?: MemoryGuard;

  constructor(opts: { memoryGuard?: MemoryGuard }) {
    this.memoryGuard = opts.memoryGuard;
  }

  /** 当前并发槽位(按内存压力动态收缩) */
  current(baseConcurrency: number): number {
    const pressure = this.memoryGuard?.getPressure() ?? 'low';
    return shrinkConcurrencyByPressure(baseConcurrency, pressure);
  }
}
