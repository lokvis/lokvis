/**
 * ui-react 共享工具函数
 *
 * 抽取自多个组件的重复逻辑(filterCapabilities / capabilityLabel 等),
 * 避免散落在各组件中的同名实现 drift。
 */
import type { Capability } from '@lokvis/schema';

/**
 * 按搜索关键词过滤能力列表(匹配 name / label / description,大小写不敏感)。
 *
 * 用于 Inspector 能力列表与 WorkflowEditor InsertConnector 搜索。
 */
export function filterCapabilities(
  capabilities: Capability[],
  query: string
): Capability[] {
  const q = query.toLowerCase();
  return capabilities.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      (c.label?.toLowerCase().includes(q) ?? false)
  );
}

/**
 * 能力的展示标签:优先 presentation `label`,缺省回退到 `name`。
 *
 * 用于 Inspector / CommandPalette / WorkflowEditor 能力列表渲染。
 */
export function capabilityLabel(cap: Capability): string {
  return cap.label ?? cap.name;
}

/**
 * 能力的展示分组:优先 presentation `group`,缺省回退到 `name` 的
 * domain 前缀(如 `image.resize` → `image`;无前缀时 'other')。
 *
 * 用于 Inspector 能力列表分组。
 */
export function capabilityGroup(cap: Capability): string {
  return cap.group ?? cap.name.split('.')[0] ?? 'other';
}
