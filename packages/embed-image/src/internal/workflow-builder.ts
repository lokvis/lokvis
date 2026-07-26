/**
 * 单步 image 工作流构造器(@lokvis/embed-image 内部副本)。
 *
 * 与 apps/playground/src/components/toolkit/workflow-builder.ts 保持一致;
 * 包内独立维护避免与 playground 相互耦合。
 */
import type { Workflow } from '@lokvis/sdk';

/**
 * 构造单步 image Workflow(transform 节点,1 image → 1 image)。
 */
export function buildSingleStepImageWorkflow(
  capability: string,
  params: Record<string, unknown>,
  name: string,
  description?: string
): Workflow {
  return {
    id: `${name.toLowerCase()}-${Date.now()}`,
    version: '1.0',
    name,
    description: description ?? name,
    author: { id: 'embed-image', name: 'Embed Image' },
    category: 'image',
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
    inputs: { type: 'image', multiple: false },
    outputs: { type: 'image' },
  };
}

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
    id: `resize-compress-${Date.now()}`,
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
