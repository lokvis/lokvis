/**
 * 单步 image 工作流构造器(@lokvis/quick-image 内部副本)。
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
    author: { id: 'quick-image', name: 'Quick Image' },
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
