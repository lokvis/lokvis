/**
 * ui-react 共享工具函数
 *
 * 抽取自多个组件的重复逻辑(formatBytes / filterCapabilities),
 * 避免散落在各组件中的同名实现 drift。
 */
import type { Capability } from '@lokvis/schema';

/**
 * 字节数格式化为人类可读字符串(B / KB / MB / GB)。
 *
 * 统一使用 1024 进制,保留合理小数位:
 * - B:整数
 * - KB:1 位小数
 * - MB:1 位小数
 * - GB:2 位小数
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * 按搜索关键词过滤能力列表(匹配 name 或 description,大小写不敏感)。
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
      c.description.toLowerCase().includes(q)
  );
}
