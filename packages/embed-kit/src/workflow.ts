/**
 * 单步工作流构造器工厂(@lokvis/embed-kit 共享)。
 *
 * 各 embed 包的单步 Workflow 构造器结构一致,仅 author / category /
 * inputs.type / outputs.type 不同。本工厂参数化这些字段,各包用
 * makeSingleStepWorkflowBuilder(config) 生成后以原有导出名再导出。
 */
import type { Workflow } from '@lokvis/sdk';

/** 资源类型(与 Workflow inputs/outputs.type 对齐) */
export type EmbedAssetType = Workflow['inputs']['type'];

/** 单步工作流构造器配置 */
export interface SingleStepWorkflowConfig {
  /** 工作流 category(如 'pdf') */
  category: Workflow['category'];
  /** 输入资源类型 */
  inputType: EmbedAssetType;
  /** 输出资源类型 */
  outputType: Workflow['outputs']['type'];
  /** 作者 id(如 'embed-pdf') */
  authorId: string;
  /** 作者名(如 'Embed PDF') */
  authorName: string;
}

/** 单步工作流构造函数签名 */
export type BuildSingleStepWorkflow = (
  capability: string,
  params: Record<string, unknown>,
  name: string,
  description?: string,
  multiple?: boolean
) => Workflow;

/**
 * 生成绑定了 category / 资源类型 / author 的单步 Workflow 构造器。
 */
export function makeSingleStepWorkflowBuilder(
  config: SingleStepWorkflowConfig
): BuildSingleStepWorkflow {
  return function buildSingleStepWorkflow(
    capability,
    params,
    name,
    description,
    multiple = false
  ): Workflow {
    return {
      id: `${name.toLowerCase()}-${crypto.randomUUID()}`,
      version: '1.0',
      name,
      description: description ?? name,
      author: { id: config.authorId, name: config.authorName },
      category: config.category,
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
      inputs: { type: config.inputType, multiple },
      outputs: { type: config.outputType },
    };
  };
}
