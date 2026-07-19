/**
 * Audio 工作流构造器。
 *
 * 与 video-workflow-builder.ts 对齐,但 audio 输出永远是 audio,
 * 不像 video 可能跨形态输出(video / audio / image)。
 *
 * 形态:
 * - single(1→1):trim / normalize / transcode
 * - merge(N→1):audio.merge(此处保留构造器,UI 暂不实装)
 */
import type { Workflow } from '@lokvis/sdk';

/**
 * 构造单步 Audio Workflow。
 *
 * @param capability 能力名,如 'audio.trim'
 * @param params 节点参数
 * @param name 工作流名(用于展示与 id 前缀)
 * @param description 可选描述
 */
export function buildSingleStepAudioWorkflow(
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
    category: 'audio',
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
    inputs: { type: 'audio', multiple: false },
    outputs: { type: 'audio' },
  };
}
