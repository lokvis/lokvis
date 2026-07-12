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

/** W10: Workflow 分类枚举(与 WorkflowCategory 类型对齐) */
export const workflowCategorySchema = z.enum([
  'image',
  'video',
  'audio',
  'pdf',
  'ai',
  'data',
  'developer',
  'ecommerce',
  'content-creation',
  'other',
]);

/** W10: Workflow 输出类型枚举(含 archive 用于打包下载场景) */
export const workflowOutputTypeSchema = z.enum([
  'image',
  'video',
  'audio',
  'pdf',
  'text',
  'data',
  'unknown',
  'archive',
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
  category: workflowCategorySchema,
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
    type: workflowOutputTypeSchema,
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

/**
 * 校验 Workflow JSON。
 *
 * 修复 review 报告：原实现仅做 Zod 形状校验，不检查 edge 引用、保留字、DAG 合法性，
 * 导致 demo 用 `__input__` 哨兵边时 Zod 通过但 executor 抛 "cycle"。
 * 现增加结构层校验，让错误在入口处暴露。
 *
 * W10.2 增强：新增 capability 兼容性校验(可选)。
 * 通过 `options.resolveCapability` 回调查询 capability 的 inputTypes/outputTypes,
 * 检查相邻节点的输出类型与下一节点的输入类型是否兼容。schema 包无法直接访问
 * CapabilityRegistry,故采用回调注入模式(避免五层依赖违规)。
 *
 * @param data 待校验的 Workflow JSON
 * @param options 可选项:
 *   - resolveCapability: (name: string) => Capability | undefined
 *       返回 capability 声明;返回 undefined 时跳过该节点的兼容性校验(向后兼容)
 *   - maxSteps: number
 *       最大节点数限制(默认不限制;W10 要求 5 步,调用方按需传入)
 */
export interface ValidateWorkflowOptions {
  /** 查询 capability 声明的回调(返回 undefined 时跳过该节点校验) */
  resolveCapability?: (name: string) => {
    inputTypes: string[];
    outputTypes: string[];
  } | undefined;
  /** 最大节点数限制(可选) */
  maxSteps?: number;
}

export function validateWorkflow(data: unknown, options?: ValidateWorkflowOptions) {
  const parsed = workflowSchema.safeParse(data);
  if (!parsed.success) {
    return parsed;
  }

  const wf = parsed.data;
  const errors: string[] = [];

  // 0. W10.2: 节点数上限校验(可选)
  if (options?.maxSteps !== undefined && wf.nodes.length > options.maxSteps) {
    errors.push(
      `Workflow has ${wf.nodes.length} nodes, exceeds max ${options.maxSteps}.`
    );
  }

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
      const id = queue.shift();
      // 循环条件 queue.length > 0 保证 shift 必返回元素;
      // 显式检查以满足 noUncheckedIndexedAccess,并在不变量被打破时跳出
      if (id === undefined) break;
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

  // 5. W10.2: capability 兼容性校验(可选,仅在 resolveCapability 提供时)
  //    检查相邻节点(通过 edge 连接)的 outputTypes 与下一节点的 inputTypes 是否有交集。
  //    - 线性链:edge.from → edge.to,from 节点的 outputTypes 与 to 节点的 inputTypes 交集为空则报错
  //    - 输入节点(入度 0)的 inputTypes 与 workflow.inputs.type 兼容性
  //    - 输出节点(出度 0)的 outputTypes 与 workflow.outputs.type 兼容性
  if (options?.resolveCapability && errors.length === 0) {
    validateCapabilityCompatibility(wf, options.resolveCapability, errors);
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

/** W10.2: capability 兼容性校验内部实现 */
function validateCapabilityCompatibility(
  wf: z.infer<typeof workflowSchema>,
  resolveCapability: (name: string) => { inputTypes: string[]; outputTypes: string[] } | undefined,
  errors: string[]
): void {
  // 计算每个节点的入度/出度,识别输入/输出节点
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  for (const node of wf.nodes) {
    inDegree.set(node.id, 0);
    outDegree.set(node.id, 0);
  }
  for (const edge of wf.edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    outDegree.set(edge.from, (outDegree.get(edge.from) ?? 0) + 1);
  }

  // 缓存每个节点的 capability 声明
  const capCache = new Map<string, { inputTypes: string[]; outputTypes: string[] } | undefined>();
  type InferredNode = z.infer<typeof workflowNodeSchema>;
  const getCap = (node: InferredNode) => {
    if (!node.capability) return undefined;
    if (capCache.has(node.capability)) return capCache.get(node.capability);
    const cap = resolveCapability(node.capability);
    capCache.set(node.capability, cap);
    return cap;
  };

  // 5a. 全节点 unknown capability 检测(transform + input + output)
  //     修复 W14.5:原实现仅检查入度 0 节点,transform 节点的 unknown capability
  //     在 5b 边检查中被 `if (!fromCap || !toCap) continue` 静默跳过,
  //     导致 seed #8 audio.* 未注册时 validateWorkflow 仍返回 success。
  //     现统一遍历所有带 capability 的节点,未注册即显式报错,避免运行时才暴露。
  //     resolveCapability 未提供时 getCap 始终返回 undefined —— 但外层仅在
  //     options.resolveCapability 提供时进入本函数,故无需额外兜底。
  for (const node of wf.nodes) {
    if (!node.capability) continue;
    const cap = getCap(node);
    if (!cap) {
      errors.push(
        `Node "${node.id}" references unknown capability "${node.capability}". ` +
          `Capability is not registered in the registry.`
      );
    }
  }

  // 5b. 输入节点(入度 0)的 inputTypes 与 workflow.inputs.type 兼容
  for (const node of wf.nodes) {
    if ((inDegree.get(node.id) ?? 0) > 0) continue;
    const cap = getCap(node);
    if (!cap) continue; // 5a 已报告未注册 capability,此处不重复
    const inputTypeMatches = cap.inputTypes.includes(wf.inputs.type);
    if (!inputTypeMatches) {
      errors.push(
        `Node "${node.id}" (capability "${node.capability}") expects input types ` +
          `[${cap.inputTypes.join(', ')}], but workflow input is "${wf.inputs.type}".`
      );
    }
  }

  // 5c. 相邻节点:from 的 outputTypes 与 to 的 inputTypes 必须有交集
  for (const edge of wf.edges) {
    const fromNode = wf.nodes.find((n) => n.id === edge.from);
    const toNode = wf.nodes.find((n) => n.id === edge.to);
    if (!fromNode || !toNode) continue;
    const fromCap = getCap(fromNode);
    const toCap = getCap(toNode);
    if (!fromCap || !toCap) continue; // 5a 已报告未注册 capability,此处不重复
    const compatible = fromCap.outputTypes.some((t) => toCap.inputTypes.includes(t));
    if (!compatible) {
      errors.push(
        `Capability mismatch on edge "${edge.from}" → "${edge.to}": ` +
          `"${fromNode.capability}" outputs [${fromCap.outputTypes.join(', ')}], ` +
          `but "${toNode.capability}" accepts [${toCap.inputTypes.join(', ')}].`
      );
    }
  }

  // 5d. 输出节点(出度 0)的 outputTypes 与 workflow.outputs.type 兼容
  //     (archive 类型输出允许任意类型,用于打包下载场景)
  for (const node of wf.nodes) {
    if ((outDegree.get(node.id) ?? 0) > 0) continue;
    const cap = getCap(node);
    if (!cap) continue; // 5a 已报告未注册 capability,此处不重复
    const outputType = wf.outputs.type;
    if (outputType === 'archive') continue;
    const outputTypeMatches = cap.outputTypes.includes(outputType);
    if (!outputTypeMatches) {
      errors.push(
        `Node "${node.id}" (capability "${node.capability}") produces output types ` +
          `[${cap.outputTypes.join(', ')}], but workflow output is "${outputType}".`
      );
    }
  }
}

/** 校验 Plugin Manifest */
export function validatePluginManifest(data: unknown) {
  return pluginManifestSchema.safeParse(data);
}
