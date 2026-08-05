/**
 * MCP tool Workflow 构造公共 helper
 *
 * 把单次 capability 调用包装为单节点 Workflow,经 runtime.run() 走完整
 * capability 系统。用 @lokvis/workflow 的 WorkflowBuilder 构造,确保:
 * - 元数据完整($schema / version / createdAt / updatedAt / official)
 * - 与浏览器侧 Workspace 构造的 Workflow 结构一致
 * - Workflow ID 用 crypto.randomUUID() 生成(AGENTS.md 约定,避免 Date.now+
 *   Math.random 的可预测性与碰撞风险)
 *
 * 三种形态:
 * - single(1→1):createBlobCapabilityImpl 路径,inputs.multiple=false
 * - merge(N→1):createMergeCapabilityImpl 路径,inputs.multiple=true
 * - split(1→N):createSplitCapabilityImpl 路径,inputs.multiple=false
 *   (split 输出多个,但输入仍是单个;MCP 当前未用 split,预留)
 *
 * O-12:buildSingleTransformWorkflow 与 buildMergeWorkflow 仅 multiple 字段
 * 不同,抽公共 buildCapabilityWorkflow(multiple) 辅助,消除 90% 重复。
 */

import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { WorkflowBuilder } from '@lokvis/workflow';
import type { AssetType, Workflow, WorkflowCategory } from '@lokvis/schema';
import type { LokvisRuntime } from '@lokvis/sdk';

/**
 * 构造单节点 capability Workflow(公共辅助)。
 *
 * @param capability 能力名,如 `image.resize` / `pdf.merge`
 * @param params 能力参数
 * @param category 工作流分类(image / pdf / other)
 * @param assetType 输入输出 Asset 类型
 * @param multiple 输入是否多文件(single=false / merge=true)
 */
function buildCapabilityWorkflow(
  capability: string,
  params: Record<string, unknown>,
  category: WorkflowCategory,
  assetType: AssetType,
  multiple: boolean
): Workflow {
  return new WorkflowBuilder({
    id: `mcp_${randomUUID()}`,
    name: capability,
    description: `MCP tool: ${capability}`,
    author: { id: 'mcp-server', name: 'MCP Server' },
    category,
  })
    .setInput({ type: assetType, multiple })
    .setOutput({ type: assetType })
    .add(capability, params)
    .build();
}

/**
 * 构造单节点 transform Workflow(1→1 形态)。
 *
 * @param capability 能力名,如 `image.resize` / `pdf.compress`
 * @param params 能力参数
 * @param category 工作流分类(image / pdf / other)
 * @param assetType 输入输出 Asset 类型
 */
export function buildSingleTransformWorkflow(
  capability: string,
  params: Record<string, unknown>,
  category: WorkflowCategory,
  assetType: AssetType
): Workflow {
  return buildCapabilityWorkflow(capability, params, category, assetType, false);
}

/**
 * 构造 merge(N→1)Workflow。
 *
 * 与 buildSingleTransformWorkflow 区别:inputs.multiple=true,允许 N 个输入;
 * runtime 会把 N 个 inputs 一次性传给 merge capability 的 execute。
 *
 * @param capability 能力名,如 `pdf.merge`
 * @param params 能力参数
 * @param category 工作流分类
 * @param assetType 输入输出 Asset 类型
 */
export function buildMergeWorkflow(
  capability: string,
  params: Record<string, unknown>,
  category: WorkflowCategory,
  assetType: AssetType
): Workflow {
  return buildCapabilityWorkflow(capability, params, category, assetType, true);
}

/**
 * 构造 split(1→N)Workflow。
 *
 * 与 buildSingleTransformWorkflow 结构相同(inputs.multiple=false,单个输入);
 * 区别在于 capability 执行后产出多个 output asset(runtime 通过
 * result.outputs 数组返回 N 个 asset ID)。
 *
 * @param capability 能力名,如 `pdf.split`
 * @param params 能力参数
 * @param category 工作流分类
 * @param assetType 输入输出 Asset 类型
 */
export function buildSplitWorkflow(
  capability: string,
  params: Record<string, unknown>,
  category: WorkflowCategory,
  assetType: AssetType
): Workflow {
  return buildCapabilityWorkflow(capability, params, category, assetType, false);
}

// ─── FO-18: unified file transform ────────────────────────────

/** runFileTransform 选项 */
export interface RunFileTransformOptions {
  runtime: LokvisRuntime;
  inputPaths: string[];
  capability: string;
  params: Record<string, unknown>;
  /** 所有输入文件的 MIME 类型(image 需调用方预先解析) */
  mime: string;
  category: WorkflowCategory;
  assetType: AssetType;
  /** true 时使用 merge workflow(N→1);默认 false(single,1→1) */
  merge?: boolean;
  /** export 后、cleanup 前调用,可读取 output asset 元数据(FO-18) */
  onExported?: (outAssetId: string) => Promise<Record<string, unknown>>;
}

/**
 * 统一的文件转换流程(FO-18)。
 *
 * 合并 image/video/audio/pdf 四包中 ~90% 相同的:
 * readFile → new File → importAsset → run workflow → exportAsset → cleanup
 *
 * 调用方负责:
 * - MIME 解析(image 按扩展名,其余为固定常量)
 * - 元数据读取(如 readAssetImageMetadata,在 export 后自行处理)
 */
export async function runFileTransform(
  opts: RunFileTransformOptions
): Promise<{ outBlob: Blob } & Record<string, unknown>> {
  const { runtime, inputPaths, capability, params, mime, category, assetType, merge, onExported } = opts;

  const inputAssetIds: string[] = [];
  for (const p of inputPaths) {
    const buffer = await readFile(p);
    const file = new File([buffer], basename(p), { type: mime });
    const id = await runtime.importAsset({ kind: 'file', file });
    inputAssetIds.push(id);
  }

  try {
    const workflow = merge
      ? buildMergeWorkflow(capability, params, category, assetType)
      : buildSingleTransformWorkflow(capability, params, category, assetType);

    const result = await runtime.run(workflow, inputAssetIds);
    if (result.status !== 'completed' || !result.outputs[0]) {
      throw new Error(
        `Workflow ${capability} failed: status=${result.status}` +
          (result.error ? ` error=${result.error}` : '')
      );
    }

    const outAssetId = result.outputs[0];
    const outBlob = await runtime.exportAsset(outAssetId);

    const extra = onExported ? await onExported(outAssetId) : {};

    await runtime.removeAsset(outAssetId).catch((e) => {
      console.warn('[mcp-server] cleanup output asset failed:', e);
    });

    return { outBlob, ...extra };
  } finally {
    for (const id of inputAssetIds) {
      await runtime.removeAsset(id).catch((e) => {
        console.warn('[mcp-server] cleanup input asset failed:', e);
      });
    }
  }
}
