/**
 * 单步 Video 工作流构造器(@lokvis/embed-video 内部)。
 *
 * 复用 @lokvis/embed-kit 的参数化工厂(category='video'、inputs/outputs type='video'),
 * 以本包原有导出名 buildSingleStepVideoWorkflow 再导出。
 */
import { makeSingleStepWorkflowBuilder } from '@lokvis/embed-kit';

export const buildSingleStepVideoWorkflow = makeSingleStepWorkflowBuilder({
  category: 'video',
  inputType: 'video',
  outputType: 'video',
  authorId: 'embed-video',
  authorName: 'Embed Video',
});
