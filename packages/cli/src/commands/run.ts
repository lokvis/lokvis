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
import { validateWorkflow } from '@lokvis/schema';
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
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch (err) {
    throw new Error(
      `Invalid workflow JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // 委托 @lokvis/schema 的 zod 校验器(含形状 + 保留字 + 唯一性 + DAG 检查),
  // 不再在 CLI 侧手写 typeof 系列校验 —— 那会与 schema 校验规则漂移。
  const parsed = validateWorkflow(raw);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) =>
        issue.path.length > 0
          ? `${issue.path.join('.')}: ${issue.message}`
          : issue.message
      )
      .join('; ');
    throw new Error(`Invalid workflow: ${formatted}`);
  }
  const workflow: Workflow = parsed.data;

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
    // new File 直接接受 Buffer,无需先包 Blob(blob.type 不传时为空字符串,
    // 此处包装是无效的中间步骤)。MIME 由 runtime 在 import 时按需推断。
    const fileLike = new File([buffer], file);
    const id = await runtime.importAsset({ kind: 'file', file: fileLike });
    inputIds.push(id);
  }

  const result = await runtime.run(workflow, inputIds);
  return result;
}
