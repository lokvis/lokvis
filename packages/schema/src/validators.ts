/**
 * Lokvis Schema Zod Validators
 *
 * 提供 Workflow / Asset / Plugin 的运行时校验。
 */

import { z } from 'zod';

export const assetTypeSchema = z.enum([
  'image',
  'video',
  'audio',
  'pdf',
  'text',
  'data',
  'unknown',
]);

export const assetMetadataSchema = z.object({
  mimeType: z.string(),
  size: z.number().nonnegative(),
  dimensions: z
    .object({ width: z.number().positive(), height: z.number().positive() })
    .optional(),
  duration: z.number().nonnegative().optional(),
  pages: z.number().int().positive().optional(),
  format: z.string(),
});

export const workflowNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['load', 'transform', 'export']),
  // capability 仅 transform 节点必填;load/export 可不填
  capability: z.string().optional(),
  params: z.record(z.unknown()).optional(),
  label: z.string().optional(),
}).refine(
  (node) => node.type !== 'transform' || (typeof node.capability === 'string' && node.capability.length > 0),
  { message: 'transform 节点必须指定 capability' }
);

export const workflowEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
});

export const workflowSchema = z.object({
  $schema: z.string().optional(),
  id: z.string(),
  version: z.string(),
  name: z.string(),
  description: z.string(),
  author: z.object({ id: z.string(), name: z.string() }),
  category: z.string(),
  tags: z.array(z.string()),
  nodes: z.array(workflowNodeSchema),
  edges: z.array(workflowEdgeSchema),
  inputs: z.object({
    type: assetTypeSchema,
    multiple: z.boolean(),
    maxCount: z.number().int().positive().optional(),
    accept: z.array(z.string()).optional(),
  }),
  outputs: z.object({
    type: z.enum(['image', 'video', 'audio', 'pdf', 'text', 'data', 'unknown', 'archive']),
    format: z.string().optional(),
  }),
  official: z.boolean().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

export const pluginManifestSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  author: z.string(),
  license: z.string(),
  main: z.string(),
  icon: z.string().optional(),
  capabilities: z.array(z.string()),
  engines: z.object({ 'lokvis-runtime': z.string() }),
  permissions: z.array(z.string()),
});

/** 校验 Workflow JSON。
 *
 * 修复 review 报告：原实现仅做 Zod 形状校验，不检查 edge 引用、保留字、DAG 合法性，
 * 导致 demo 用 `__input__` 哨兵边时 Zod 通过但 executor 抛 "cycle"。
 * 现增加结构层校验，让错误在入口处暴露。
 */
export function validateWorkflow(data: unknown) {
  const parsed = workflowSchema.safeParse(data);
  if (!parsed.success) {
    return parsed;
  }

  const wf = parsed.data;
  const errors: string[] = [];

  // 1. 保留字哨兵：禁止 __input__ / __output__ 出现在 nodes 或 edges
  //    （executor 不支持哨兵节点，输入资产注入到入度 0 的首节点）
  const RESERVED_IDS = new Set(['__input__', '__output__', '__start__', '__end__']);
  for (const node of wf.nodes) {
    if (RESERVED_IDS.has(node.id)) {
      errors.push(
        `Node id "${node.id}" is reserved; use a non-reserved id.`
      );
    }
  }
  for (const edge of wf.edges) {
    if (RESERVED_IDS.has(edge.from)) {
      errors.push(
        `Edge from "${edge.from}" references a reserved sentinel id; ` +
          `the executor injects input assets into the first in-degree-0 node, ` +
          `no explicit __input__ edge is needed.`
      );
    }
    if (RESERVED_IDS.has(edge.to)) {
      errors.push(
        `Edge to "${edge.to}" references a reserved sentinel id.`
      );
    }
  }

  // 2. node id 唯一性
  const seenIds = new Set<string>();
  for (const node of wf.nodes) {
    if (seenIds.has(node.id)) {
      errors.push(`Duplicate node id: "${node.id}".`);
    }
    seenIds.add(node.id);
  }

  // 3. edge.from / edge.to 必须引用已声明节点
  const nodeIds = new Set(wf.nodes.map((n) => n.id));
  for (const edge of wf.edges) {
    if (!nodeIds.has(edge.from)) {
      errors.push(
        `Edge from "${edge.from}" to "${edge.to}" references unknown source node "${edge.from}".`
      );
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(
        `Edge from "${edge.from}" to "${edge.to}" references unknown target node "${edge.to}".`
      );
    }
    if (edge.from === edge.to) {
      errors.push(`Edge from "${edge.from}" to itself is a self-loop (cycle).`);
    }
  }

  // 4. DAG 合法性：无环（拓扑排序能覆盖所有节点）
  if (errors.length === 0) {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();
    for (const node of wf.nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    }
    for (const edge of wf.edges) {
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
      adjacency.get(edge.from)?.push(edge.to);
    }
    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }
    let visited = 0;
    while (queue.length > 0) {
      const id = queue.shift()!;
      visited++;
      for (const next of adjacency.get(id) ?? []) {
        const newDeg = (inDegree.get(next) ?? 0) - 1;
        inDegree.set(next, newDeg);
        if (newDeg === 0) queue.push(next);
      }
    }
    if (visited !== wf.nodes.length) {
      errors.push(
        `Workflow contains a cycle: only ${visited}/${wf.nodes.length} nodes are reachable.`
      );
    }
  }

  if (errors.length > 0) {
    return {
      success: false as const,
      error: {
        issues: errors.map((message) => ({
          code: 'custom' as const,
          message,
          path: [],
        })),
      },
    };
  }

  return { success: true as const, data: wf };
}

/** 校验 Plugin Manifest */
export function validatePluginManifest(data: unknown) {
  return pluginManifestSchema.safeParse(data);
}
