/**
 * buildLinearWorkflow - 从节点数组快速构造线性 Workflow(无校验)
 *
 * 与 WorkflowBuilder 的区别:
 *   - WorkflowBuilder 是公开链式 API,含 5 步上限校验 + 元数据完善
 *   - buildLinearWorkflow 是内部工具函数,从最小节点结构直接构造,
 *     不做步数校验(UI 层已在 addNode 时拦截)
 *
 * @module build-linear-workflow
 */

import type {
  AssetType,
  Workflow,
  WorkflowCategory,
  WorkflowEdge,
  WorkflowNode,
} from '@lokvis/schema';

/** buildLinearWorkflow 的最小输入节点结构(WorkspaceNode 的子集) */
export interface BuildLinearWorkflowNode {
  /** 节点唯一 ID */
  id: string;
  /** 能力名,如 `image.resize` */
  capability: string;
  /** 能力参数 */
  params?: Record<string, unknown>;
}

/**
 * AssetType → WorkflowCategory 映射。
 *
 * AssetType 的 'text' / 'unknown' 无对应 WorkflowCategory,归入 'other';
 * 其余类型('image' | 'video' | 'audio' | 'pdf' | 'data')与 WorkflowCategory 同名直接复用。
 */
function assetTypeToCategory(type: AssetType): WorkflowCategory {
  switch (type) {
    case 'image':
    case 'video':
    case 'audio':
    case 'pdf':
    case 'data':
      return type;
    case 'text':
    case 'unknown':
      return 'other';
  }
}

/** 把工作台节点序列构建为线性 Workflow(无校验,步数由 UI 层在 addNode 时拦截) */
export function buildLinearWorkflow(
  nodes: BuildLinearWorkflowNode[],
  inputType: AssetType
): Workflow {
  if (nodes.length === 0) {
    throw new Error('Workflow is empty');
  }
  const workflowNodes: WorkflowNode[] = nodes.map((n) => ({
    id: n.id,
    type: 'transform' as const,
    capability: n.capability,
    params: n.params,
  }));
  const edges: WorkflowEdge[] = [];
  for (let i = 0; i < workflowNodes.length - 1; i++) {
    const fromNode = workflowNodes[i];
    const toNode = workflowNodes[i + 1];
    if (!fromNode || !toNode) continue;
    edges.push({ from: fromNode.id, to: toNode.id });
  }
  return {
    $schema: 'https://lokvis.dev/schemas/workflow.json',
    id: `wf_${Date.now().toString(36)}`,
    name: 'Workspace Workflow',
    version: '1.0.0',
    description: 'Workspace linear workflow',
    author: { id: 'local', name: 'Local User' },
    category: assetTypeToCategory(inputType),
    tags: [],
    nodes: workflowNodes,
    edges,
    inputs: { type: inputType, multiple: true },
    outputs: { type: inputType },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
