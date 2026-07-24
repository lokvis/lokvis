/**
 * 单步 PDF 工作流构造器(@lokvis/embed-pdf 内部)。
 *
 * 与 @lokvis/embed-image 的 workflow-builder 模式一致,
 * 但 category='pdf'、inputs/outputs type='pdf'。
 */
import type { Workflow } from '@lokvis/sdk';

/**
 * 构造单步 PDF Workflow(transform 节点)。
 *
 * @param capability 能力名(如 'pdf.compress')
 * @param params 操作参数
 * @param name 工作流名称
 * @param description 可选描述
 * @param multiple 是否多输入(merge 场景)
 */
export function buildSingleStepPdfWorkflow(
  capability: string,
  params: Record<string, unknown>,
  name: string,
  description?: string,
  multiple = false
): Workflow {
  return {
    id: `${name.toLowerCase()}-${Date.now()}`,
    version: '1.0',
    name,
    description: description ?? name,
    author: { id: 'embed-pdf', name: 'Embed PDF' },
    category: 'pdf',
    tags: [],
    nodes: [
      {
        id: 'n1',
        type: 'transform',
        capability,
        params,
      },
    ],
    edges: [],
    inputs: { type: 'pdf', multiple },
    outputs: { type: 'pdf' },
  };
}
