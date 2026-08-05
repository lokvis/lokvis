/**
 * Audio 工作流构造器(FO-16 工厂化)。
 */
import { makeSingleStepWorkflowBuilder } from '@lokvis/embed-kit';

export const buildSingleStepAudioWorkflow = makeSingleStepWorkflowBuilder({
  category: 'audio',
  inputType: 'audio',
  outputType: 'audio',
  authorId: 'playground',
  authorName: 'Playground',
});
