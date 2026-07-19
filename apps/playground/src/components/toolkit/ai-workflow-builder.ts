/**
 * AI 工作流构造器。
 *
 * 与 video / audio / pdf 等文件处理工具不同,AI 能力不接受 Asset 输入,
 * 仅消费 params(prompt / workflow / error 对象),输出 data 类型 Asset
 * (workflow JSON / 诊断报告 JSON)。
 *
 * 因此 inputs 用 'data' 类型占位(multiple=false),输出为 'data'。
 * category 为 'other'(AI 不属于 image/pdf/video/audio 任意一类,
 * WorkflowCategory 的 'ai' 留给未来 AI 生成的 workflow 自身使用)。
 *
 * 三种形态:
 * - generate-workflow:params.prompt → data(workflow JSON)
 * - optimize-workflow:params.workflow → data(优化后的 workflow JSON)
 * - diagnose-error:params.error + 可选 params.workflow → data(诊断报告 JSON)
 */
import type { Workflow } from '@lokvis/sdk';

/**
 * 构造 ai.generate-workflow 单节点 workflow。
 *
 * @param prompt 自然语言描述(必填)
 */
export function buildGenerateWorkflowWorkflow(prompt: string): Workflow {
  return {
    id: `ai-generate-workflow-${Date.now()}`,
    version: '1.0',
    name: 'AiGenerateWorkflow',
    description: 'Generate a workflow from a natural-language prompt',
    author: { id: 'playground', name: 'Playground' },
    category: 'other',
    tags: [],
    nodes: [
      {
        id: 'n1',
        type: 'transform',
        capability: 'ai.generate-workflow',
        params: { prompt },
      },
    ],
    edges: [],
    inputs: { type: 'data', multiple: false },
    outputs: { type: 'data' },
  };
}

/**
 * 构造 ai.optimize-workflow 单节点 workflow。
 *
 * @param workflow 待优化的 workflow 对象(必填)
 */
export function buildOptimizeWorkflowWorkflow(workflow: unknown): Workflow {
  return {
    id: `ai-optimize-workflow-${Date.now()}`,
    version: '1.0',
    name: 'AiOptimizeWorkflow',
    description: 'Optimize an existing workflow for performance or cost',
    author: { id: 'playground', name: 'Playground' },
    category: 'other',
    tags: [],
    nodes: [
      {
        id: 'n1',
        type: 'transform',
        capability: 'ai.optimize-workflow',
        params: { workflow },
      },
    ],
    edges: [],
    inputs: { type: 'data', multiple: false },
    outputs: { type: 'data' },
  };
}

/**
 * 构造 ai.diagnose-error 单节点 workflow。
 *
 * @param error 错误对象(必填,含 message / stack / code)
 * @param workflow 可选的失败 workflow 上下文
 */
export function buildDiagnoseErrorWorkflow(
  error: unknown,
  workflow?: unknown
): Workflow {
  const params: Record<string, unknown> = { error };
  if (workflow !== undefined) params.workflow = workflow;
  return {
    id: `ai-diagnose-error-${Date.now()}`,
    version: '1.0',
    name: 'AiDiagnoseError',
    description: 'Diagnose a workflow execution error and suggest remediation',
    author: { id: 'playground', name: 'Playground' },
    category: 'other',
    tags: [],
    nodes: [
      {
        id: 'n1',
        type: 'transform',
        capability: 'ai.diagnose-error',
        params,
      },
    ],
    edges: [],
    inputs: { type: 'data', multiple: false },
    outputs: { type: 'data' },
  };
}
