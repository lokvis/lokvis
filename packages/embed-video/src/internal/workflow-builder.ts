/**
 * 单步 Video 工作流构造器(@lokvis/embed-video 内部)。
 */
import type { Workflow } from '@lokvis/sdk';

export function buildSingleStepVideoWorkflow(
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
    author: { id: 'embed-video', name: 'Embed Video' },
    category: 'video',
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
    inputs: { type: 'video', multiple },
    outputs: { type: 'video' },
  };
}
