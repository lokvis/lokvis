/**
 * `lokvis run <workflow.json> [files...]` 命令
 *
 * 加载工作流 JSON，导入输入文件，执行工作流。
 *
 * Node 端图像能力：通过 `@lokvis/plugin-image/node` 注入 sharp 引擎
 * (M2.2 实装)，让 image.resize / image.compress / image.convert /
 * image.crop / image.watermark 在 Node 中可真实执行。其余 4 个图像
 * 操作(rotate/flip/background/filter)为 stub，需走浏览器路径。
 *
 * 若指定 --output，则把第一个输出 Asset 写入目标文件。
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createLokvis } from '@lokvis/sdk';
import { validateWorkflow } from '@lokvis/schema';
import type { Workflow, WorkflowResult } from '@lokvis/schema';
import type { PluginLoadEntry } from '@lokvis/sdk';
import { imageToolsPluginNode } from '@lokvis/plugin-image/node';

export interface RunOptions {
  /** 额外插件(在默认 image plugin 之后追加) */
  plugins?: PluginLoadEntry[];
  /** 输出文件路径；若指定则把第一个输出 Asset 写入此文件 */
  output?: string;
  /** 是否注入默认 image plugin(默认 true) */
  injectImagePlugin?: boolean;
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

  // 默认注入 imageToolsPluginNode(sharp 引擎),让 Node 端可执行图像能力;
  // 用户可通过 injectImagePlugin: false 禁用,或通过 options.plugins 追加自定义插件。
  // 顺序:image plugin 在前,用户插件在后,允许用户插件覆盖同名能力。
  const plugins: PluginLoadEntry[] = [];
  if (options.injectImagePlugin !== false) {
    plugins.push(await imageToolsPluginNode());
  }
  if (options.plugins) {
    plugins.push(...options.plugins);
  }

  const runtime = await createLokvis({
    enableOpfs: false,
    enableIndexedDB: false,
    plugins,
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

  // 若指定 output,把第一个输出 Asset 写入文件
  if (options.output) {
    if (result.outputs.length === 0) {
      throw new Error(
        `--output specified but workflow produced no outputs (status: ${result.status})`
      );
    }
    const outAbs = resolve(process.cwd(), options.output);
    const blob = await runtime.exportAsset(result.outputs[0]!);
    const buf = Buffer.from(await blob.arrayBuffer());
    await writeFile(outAbs, buf);
  }

  return result;
}
