/**
 * `lokvis validate <workflow.json>` 命令
 *
 * 校验 workflow JSON 文件,不实际执行。校验项:
 * 1. JSON 解析合法性
 * 2. Zod 形状校验(字段类型/必填/枚举)
 * 3. 结构层校验(保留字/唯一性/edge 引用/DAG 无环)
 * 4. 可选:节点数上限(--max-steps,默认不限制)
 *
 * 输出:
 * - 成功:打印 "✓ Workflow is valid" + 摘要(id/name/nodes/edges),退出码 0
 * - 失败:打印 "✗ Workflow is invalid" + 错误列表,退出码 1
 * - --json 模式:输出 JSON { valid, errors[], summary? },便于 CI 解析
 *
 * 设计与 run 命令分离:run 在执行前会自动调用 validateWorkflow,
 * validate 命令提供给 CI / 编辑器 / 用户在提交前预检场景,无需启动 Runtime。
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateWorkflow, MAX_WORKFLOW_STEPS } from '@lokvis/schema';

export interface ValidateOptions {
  /** 最大节点数限制(默认 MAX_WORKFLOW_STEPS=5,与 Runtime/WorkflowBuilder 一致) */
  maxSteps?: number;
  /** JSON 格式输出(便于 CI 解析) */
  json?: boolean;
}

export interface ValidateResult {
  /** 是否通过校验 */
  valid: boolean;
  /** 错误列表(valid=false 时填充,path 为字段路径,message 为描述) */
  errors: Array<{ path: string; message: string }>;
  /** 工作流摘要(valid=true 时填充) */
  summary?: {
    id: string;
    name: string;
    version: string;
    category: string;
    nodeCount: number;
    edgeCount: number;
    inputsType: string;
    outputsType: string;
  };
}

/**
 * 校验单个 workflow 文件。
 *
 * @param workflowPath workflow JSON 文件路径
 * @param options 校验选项
 * @returns ValidateResult,不抛错(由调用方根据 valid 字段决定退出码)
 */
export async function validateWorkflowFile(
  workflowPath: string,
  options: ValidateOptions = {}
): Promise<ValidateResult> {
  const absPath = resolve(process.cwd(), workflowPath);
  if (!existsSync(absPath)) {
    return {
      valid: false,
      errors: [
        {
          path: '',
          message: `Workflow file not found: ${absPath}`,
        },
      ],
    };
  }

  const content = await readFile(absPath, 'utf-8');
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch (err) {
    return {
      valid: false,
      errors: [
        {
          path: '',
          message: `Invalid workflow JSON: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }

  const maxSteps = options.maxSteps ?? MAX_WORKFLOW_STEPS;
  const parsed = validateWorkflow(raw, { maxSteps });
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.length > 0 ? issue.path.join('.') : '',
        message: issue.message,
      })),
    };
  }

  const wf = parsed.data;
  return {
    valid: true,
    errors: [],
    summary: {
      id: wf.id,
      name: wf.name,
      version: wf.version,
      category: wf.category,
      nodeCount: wf.nodes.length,
      edgeCount: wf.edges.length,
      inputsType: wf.inputs.type,
      outputsType: wf.outputs.type,
    },
  };
}

/**
 * 格式化 ValidateResult 为可读文本(非 JSON 模式)。
 */
export function formatValidateResult(result: ValidateResult): string {
  if (result.valid) {
    const s = result.summary;
    if (!s) return '✓ Workflow is valid\n';
    return [
      '✓ Workflow is valid',
      '',
      `  id:          ${s.id}`,
      `  name:        ${s.name}`,
      `  version:     ${s.version}`,
      `  category:    ${s.category}`,
      `  nodes:       ${s.nodeCount}`,
      `  edges:       ${s.edgeCount}`,
      `  inputs:      ${s.inputsType}`,
      `  outputs:     ${s.outputsType}`,
      '',
    ].join('\n');
  }

  const lines = ['✗ Workflow is invalid', ''];
  for (const err of result.errors) {
    const prefix = err.path ? `${err.path}: ` : '';
    lines.push(`  ${prefix}${err.message}`);
  }
  lines.push('');
  return lines.join('\n');
}
