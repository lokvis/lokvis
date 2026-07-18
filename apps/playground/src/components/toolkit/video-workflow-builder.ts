/**
 * Video 工作流构造器。
 *
 * 与 pdf-workflow-builder.ts 对齐,inputs 类型为 'video',outputs 类型可能为
 * 'video' / 'audio' / 'image'(依 capability 决定)。
 *
 * 形态:
 * - single(1→1):compress / transcode / trim / extract-audio / to-gif / screenshot
 * - merge(N→1):video.merge(此处保留构造器,UI 暂不实装)
 */
import type { Workflow } from '@lokvis/sdk';

/** Video 工具输出 Asset 类型 */
export type VideoOutputType = 'video' | 'audio' | 'image';

/**
 * 构造单步 Video Workflow。
 *
 * @param capability 能力名,如 'video.compress'
 * @param params 节点参数
 * @param name 工作流名(用于展示与 id 前缀)
 * @param outputType 输出 Asset 类型(默认 'video')
 * @param description 可选描述
 */
export function buildSingleStepVideoWorkflow(
  capability: string,
  params: Record<string, unknown>,
  name: string,
  outputType: VideoOutputType = 'video',
  description?: string
): Workflow {
  return {
    id: `${name.toLowerCase()}-${Date.now()}`,
    version: '1.0',
    name,
    description: description ?? name,
    author: { id: 'playground', name: 'Playground' },
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
    inputs: { type: 'video', multiple: false },
    outputs: { type: outputType },
  };
}
