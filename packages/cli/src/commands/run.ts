/**
 * `lokvis run <workflow.json> [files...]` 命令
 *
 * 加载工作流 JSON，导入输入文件，执行工作流。
 *
 * 限制：Runtime 在 Node.js 中只能执行不依赖浏览器 API（Canvas、
 * createImageBitmap 等）的能力。大部分图像能力在 Node.js 中无法运行，
 * 该命令主要用于工作流校验与不需要引擎的简单能力（如 asset.rename）。
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createLokvis } from '@lokvis/sdk';
import type { Workflow, WorkflowResult } from '@lokvis/schema';
import type { PluginLoadEntry } from '@lokvis/sdk';

export interface RunOptions {
  /** 额外插件 */
  plugins?: PluginLoadEntry[];
}

export async function runWorkflow(
  workflowPath: string,
  files: string[],
  options: RunOptions = {}
): Promise<WorkflowResult> {
  const absPath = resolve(process.cwd(), workflowPath);
  if (!existsSync(absPath)) {
    throw new Error(`Workflow file not found: ${absPath}`);
  }

  const content = await readFile(absPath, 'utf-8');
  let workflow: Workflow;
  try {
    workflow = JSON.parse(content);
  } catch (err) {
    throw new Error(
      `Invalid workflow JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  validateWorkflow(workflow);

  const runtime = await createLokvis({
    enableOpfs: false,
    enableIndexedDB: false,
    plugins: options.plugins ?? [],
  });

  // 导入输入文件为 Asset
  const inputIds: string[] = [];
  for (const file of files) {
    const abs = resolve(process.cwd(), file);
    if (!existsSync(abs)) {
      throw new Error(`Input file not found: ${abs}`);
    }
    const buffer = await readFile(abs);
    const blob = new Blob([buffer]);
    const fileLike = new File([blob], file, { type: blob.type });
    const id = await runtime.importAsset({ kind: 'file', file: fileLike });
    inputIds.push(id);
  }

  const result = await runtime.run(workflow, inputIds);
  return result;
}

/** 简单校验工作流结构 */
function validateWorkflow(wf: unknown): asserts wf is Workflow {
  if (typeof wf !== 'object' || wf === null) {
    throw new Error('Workflow must be a JSON object');
  }
  const w = wf as Record<string, unknown>;
  if (typeof w.id !== 'string') throw new Error('Workflow.id must be string');
  if (typeof w.name !== 'string') throw new Error('Workflow.name must be string');
  if (!Array.isArray(w.nodes)) throw new Error('Workflow.nodes must be array');
  if (!Array.isArray(w.edges)) throw new Error('Workflow.edges must be array');
  for (const node of w.nodes as Array<Record<string, unknown>>) {
    if (typeof node.id !== 'string' || typeof node.capability !== 'string') {
      throw new Error('Each node must have id and capability');
    }
  }
}
