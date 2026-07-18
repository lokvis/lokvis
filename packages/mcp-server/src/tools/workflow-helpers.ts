/**
 * MCP tool Workflow 构造公共 helper
 *
 * 把单次 capability 调用包装为单节点 Workflow,经 runtime.run() 走完整
 * capability 系统。用 @lokvis/workflow 的 WorkflowBuilder 构造,确保:
 * - 元数据完整($schema / version / createdAt / updatedAt / official)
 * - 与浏览器侧 Workspace 构造的 Workflow 结构一致
 * - Workflow ID 用 crypto.randomUUID() 生成(AGENTS.md 约定,避免 Date.now+
 *   Math.random 的可预测性与碰撞风险)
 *
 * 三种形态:
 * - single(1→1):createBlobCapabilityImpl 路径,inputs.multiple=false
 * - merge(N→1):createMergeCapabilityImpl 路径,inputs.multiple=true
 * - split(1→N):createSplitCapabilityImpl 路径,inputs.multiple=false
 *   (split 输出多个,但输入仍是单个;MCP 当前未用 split,预留)
 */

import { randomUUID } from 'node:crypto';
import { WorkflowBuilder } from '@lokvis/workflow';
import type { AssetType, Workflow, WorkflowCategory } from '@lokvis/schema';

/**
 * 构造单节点 transform Workflow(1→1 形态)。
 *
 * @param capability 能力名,如 `image.resize` / `pdf.compress`
 * @param params 能力参数
 * @param category 工作流分类(image / pdf / other)
 * @param assetType 输入输出 Asset 类型
 */
export function buildSingleTransformWorkflow(
  capability: string,
  params: Record<string, unknown>,
  category: WorkflowCategory,
  assetType: AssetType
): Workflow {
  return new WorkflowBuilder({
    id: `mcp_${randomUUID()}`,
    name: capability,
    description: `MCP tool: ${capability}`,
    author: { id: 'mcp-server', name: 'MCP Server' },
    category,
  })
    .setInput({ type: assetType, multiple: false })
    .setOutput({ type: assetType })
    .add(capability, params)
    .build();
}

/**
 * 构造 merge(N→1)Workflow。
 *
 * 与 buildSingleTransformWorkflow 区别:inputs.multiple=true,允许 N 个输入;
 * runtime 会把 N 个 inputs 一次性传给 merge capability 的 execute。
 *
 * @param capability 能力名,如 `pdf.merge`
 * @param params 能力参数
 * @param category 工作流分类
 * @param assetType 输入输出 Asset 类型
 */
export function buildMergeWorkflow(
  capability: string,
  params: Record<string, unknown>,
  category: WorkflowCategory,
  assetType: AssetType
): Workflow {
  return new WorkflowBuilder({
    id: `mcp_${randomUUID()}`,
    name: capability,
    description: `MCP tool: ${capability}`,
    author: { id: 'mcp-server', name: 'MCP Server' },
    category,
  })
    .setInput({ type: assetType, multiple: true })
    .setOutput({ type: assetType })
    .add(capability, params)
    .build();
}
