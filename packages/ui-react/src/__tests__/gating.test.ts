/**
 * gating 单一来源门控上限单测(#9)
 *
 * 覆盖:
 * - FREE/PRO 上限值
 * - planLimits(isPro) 返回对应档位
 * - 各 hook 的 FREE / PRO LIMIT 常量与单一来源一致(防漂移回归)
 */
import { describe, it, expect } from 'vitest';
import {
  FREE_PLAN_LIMITS,
  PRO_PLAN_LIMITS,
  planLimits,
} from '../gating.js';
import { FREE_PRESET_LIMIT, PRO_PRESET_LIMIT } from '../hooks/useCustomPresets.js';
import { FREE_WORKFLOW_LIMIT, PRO_WORKFLOW_LIMIT } from '../hooks/useWorkflows.js';

describe('gating 单一来源门控上限(#9)', () => {
  it('免费档上限', () => {
    expect(FREE_PLAN_LIMITS.customPresets).toBe(3);
    expect(FREE_PLAN_LIMITS.workflows).toBe(5);
  });

  it('Pro 档无上限', () => {
    expect(PRO_PLAN_LIMITS.customPresets).toBe(Infinity);
    expect(PRO_PLAN_LIMITS.workflows).toBe(Infinity);
  });

  it('planLimits(true) 返回 Pro 档,planLimits(false) 返回免费档', () => {
    expect(planLimits(true)).toBe(PRO_PLAN_LIMITS);
    expect(planLimits(false)).toBe(FREE_PLAN_LIMITS);
  });

  it('hook 导出常量与单一来源一致(防漂移)', () => {
    expect(FREE_PRESET_LIMIT).toBe(FREE_PLAN_LIMITS.customPresets);
    expect(PRO_PRESET_LIMIT).toBe(PRO_PLAN_LIMITS.customPresets);
    expect(FREE_WORKFLOW_LIMIT).toBe(FREE_PLAN_LIMITS.workflows);
    expect(PRO_WORKFLOW_LIMIT).toBe(PRO_PLAN_LIMITS.workflows);
  });
});
