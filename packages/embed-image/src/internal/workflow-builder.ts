/**
 * 单步 image 工作流构造器(@lokvis/embed-image 内部副本)。
 *
 * buildSingleStepImageWorkflow 复用 @lokvis/embed-kit 的参数化工厂
 * (category='image'、inputs/outputs type='image')。
 * buildResizeCompressWorkflow 为 image 专属两步工作流,保留在本包。
 */
import type { Workflow } from '@lokvis/sdk';
import { makeSingleStepWorkflowBuilder } from '@lokvis/embed-kit';

/**
 * 构造单步 image Workflow(transform 节点,1 image → 1 image)。
 */
export const buildSingleStepImageWorkflow = makeSingleStepWorkflowBuilder({
  category: 'image',
  inputType: 'image',
  outputType: 'image',
  authorId: 'embed-image',
  authorName: 'Embed Image',
});

/**
 * 构造两步 image Workflow(resize → compress,1 image → 1 image)。
 *
 * 用于 target-size 压缩的降维回退:当质量二分无法满足目标体积时,
 * 先按精确目标尺寸缩放(maintainAspectRatio:false),再以低质量压缩。
 */
export function buildResizeCompressWorkflow(
  width: number,
  height: number,
  quality: number,
  format: string
): Workflow {
  return {
    id: `resize-compress-${crypto.randomUUID()}`,
    version: '1.0',
    name: 'ImageResizeCompress',
    description: 'Resize to exact dimensions then compress (target-size fallback)',
    author: { id: 'embed-image', name: 'Embed Image' },
    category: 'image',
    tags: [],
    nodes: [
      {
        id: 'n1',
        type: 'transform',
        capability: 'image.resize',
        params: { width, height, maintainAspectRatio: false },
      },
      {
        id: 'n2',
        type: 'transform',
        capability: 'image.compress',
        params: { format, quality },
      },
    ],
    edges: [{ from: 'n1', to: 'n2' }],
    inputs: { type: 'image', multiple: false },
    outputs: { type: 'image' },
  };
}
