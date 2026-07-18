/**
 * PDF 工作流构造器。
 *
 * 与 workflow-builder.ts(buildSingleStepImageWorkflow)对齐,
 * 但 inputs/outputs 类型为 'pdf'(部分 capability 输出 'text' / 'data')。
 *
 * 形态:
 * - single(1→1):compress / rotate / watermark / ocr / sign
 * - merge(N→1):pdf.merge
 * - split(1→N):pdf.split(此处仍按单步 workflow 构造,runtime 自动展开 1→N)
 */
import type { Workflow } from '@lokvis/sdk';

/** PDF 工具输出 Asset 类型 */
export type PdfOutputType = 'pdf' | 'text' | 'data';

/**
 * 构造单步 PDF Workflow。
 *
 * @param capability 能力名,如 'pdf.compress'
 * @param params 节点参数
 * @param name 工作流名(用于展示与 id 前缀)
 * @param outputType 输出 Asset 类型(默认 'pdf')
 * @param description 可选描述
 */
export function buildSingleStepPdfWorkflow(
  capability: string,
  params: Record<string, unknown>,
  name: string,
  outputType: PdfOutputType = 'pdf',
  description?: string
): Workflow {
  return {
    id: `${name.toLowerCase()}-${Date.now()}`,
    version: '1.0',
    name,
    description: description ?? name,
    author: { id: 'playground', name: 'Playground' },
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
    inputs: { type: 'pdf', multiple: false },
    outputs: { type: outputType },
  };
}

/**
 * 构造 merge workflow(N→1)。
 *
 * 注:playground UI 当前只支持单输入预览,merge 需要多文件上传,
 * 此处保留构造器供未来扩展(Phase 3 BatchQueue 集成)。
 */
export function buildMergePdfWorkflow(
  params: Record<string, unknown>,
  name = 'PdfMerge'
): Workflow {
  return {
    id: `${name.toLowerCase()}-${Date.now()}`,
    version: '1.0',
    name,
    description: 'Merge multiple PDFs into one',
    author: { id: 'playground', name: 'Playground' },
    category: 'pdf',
    tags: [],
    nodes: [
      {
        id: 'n1',
        type: 'transform',
        capability: 'pdf.merge',
        params,
      },
    ],
    edges: [],
    inputs: { type: 'pdf', multiple: true },
    outputs: { type: 'pdf' },
  };
}
