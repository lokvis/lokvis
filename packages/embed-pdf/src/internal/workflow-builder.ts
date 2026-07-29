/**
 * 单步 PDF 工作流构造器(@lokvis/embed-pdf 内部)。
 *
 * 复用 @lokvis/embed-kit 的参数化工厂(category='pdf'、inputs/outputs type='pdf'),
 * 以本包原有导出名 buildSingleStepPdfWorkflow 再导出。
 */
import { makeSingleStepWorkflowBuilder } from '@lokvis/embed-kit';

/**
 * 构造单步 PDF Workflow(transform 节点)。
 *
 * @param capability 能力名(如 'pdf.compress')
 * @param params 操作参数
 * @param name 工作流名称
 * @param description 可选描述
 * @param multiple 是否多输入(merge 场景)
 */
export const buildSingleStepPdfWorkflow = makeSingleStepWorkflowBuilder({
  category: 'pdf',
  inputType: 'pdf',
  outputType: 'pdf',
  authorId: 'embed-pdf',
  authorName: 'Embed PDF',
});
