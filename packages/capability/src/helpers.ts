/**
 * 能力查询与过滤工具
 *
 * 提供给 UI 层、Workflow 编辑器、AI 生成器使用的能力发现工具。
 */

import type { AssetType, Capability, CapabilityParam } from '@lokvis/schema';
import { domainOf } from './names.js';

/** 按领域过滤能力 */
export function filterByDomain(
  capabilities: Capability[],
  domain: string
): Capability[] {
  return capabilities.filter((c) => domainOf(c.name) === domain);
}

/** 按输入类型过滤能力（能力是否接受指定 Asset 类型） */
export function filterByInputType(
  capabilities: Capability[],
  type: AssetType
): Capability[] {
  return capabilities.filter((c) => c.inputTypes.includes(type));
}

/** 按性能等级过滤 */
export function filterByPerformance(
  capabilities: Capability[],
  level: 'fast' | 'medium' | 'slow'
): Capability[] {
  return capabilities.filter((c) => c.performance === level);
}

/** 按领域分组 */
export function groupByDomain(
  capabilities: Capability[]
): Map<string, Capability[]> {
  const groups = new Map<string, Capability[]>();
  for (const cap of capabilities) {
    const d = domainOf(cap.name);
    const arr = groups.get(d);
    if (arr) arr.push(cap);
    else groups.set(d, [cap]);
  }
  return groups;
}

/** 查找能力 */
export function findCapability(
  capabilities: Capability[],
  name: string
): Capability | undefined {
  return capabilities.find((c) => c.name === name);
}

/** 检查能力是否可批量处理 */
export function isBatchable(cap: Capability): boolean {
  return cap.batchable === true;
}

/** 获取能力的必填参数 */
export function requiredParams(cap: Capability): CapabilityParam[] {
  return cap.params.filter((p) => p.required);
}

/** 获取能力的可选参数 */
export function optionalParams(cap: Capability): CapabilityParam[] {
  return cap.params.filter((p) => !p.required);
}

/** 获取参数默认值组成的对象 */
export function defaultParams(cap: Capability): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of cap.params) {
    if (p.default !== undefined) out[p.name] = p.default;
  }
  return out;
}

/** 合并默认参数与用户参数（用户参数优先） */
export function mergeParams(
  cap: Capability,
  userParams: Record<string, unknown>
): Record<string, unknown> {
  return { ...defaultParams(cap), ...userParams };
}

/** 校验参数：返回缺失的必填参数名 */
export function validateParams(
  cap: Capability,
  params: Record<string, unknown>
): string[] {
  const missing: string[] = [];
  for (const p of cap.params) {
    if (p.required && (params[p.name] === undefined || params[p.name] === null)) {
      missing.push(p.name);
    }
  }
  return missing;
}
