/**
 * 单步 image 工作流构造器 + 工具页共享类型。
 *
 * Compress/Resize/Convert/Crop/Watermark 五个工具页都构造相同的
 * 单节点 Workflow 字面量(id / version / author / category / tags / edges /
 * inputs / outputs 完全一致,仅 name / description / capability / params 不同)。
 * 抽出此工厂后,各工具页只传入 capability + params + name。
 */
import type { Workflow } from '@lokvis/sdk';

/**
 * 构造单步 image Workflow(transform 节点,1 image → 1 image)。
 *
 * @param capability 能力名,如 'image.resize'
 * @param params 节点参数
 * @param name 工作流名(用于展示与 id 前缀)
 * @param description 可选描述,默认与 name 相同
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
    author: { id: 'playground', name: 'Playground' },
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
