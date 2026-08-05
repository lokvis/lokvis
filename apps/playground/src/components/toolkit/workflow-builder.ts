/**
 * 单步 image 工作流构造器(FO-16 工厂化)。
 *
 * Compress/Resize/Convert/Crop/Watermark 五个工具页共用。
 */
import { makeSingleStepWorkflowBuilder } from '@lokvis/embed-kit';

export const buildSingleStepImageWorkflow = makeSingleStepWorkflowBuilder({
  category: 'image',
  inputType: 'image',
  outputType: 'image',
  authorId: 'playground',
  authorName: 'Playground',
});
