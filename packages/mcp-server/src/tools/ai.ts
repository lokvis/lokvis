/**
 * AI tools:MCP tool handlers for AI-powered workflow assistance.
 *
 * 3 个 tool 经 runtime.run(workflow, []) 走完整 Capability 系统:
 * - lokvis_ai_generate_workflow: 从自然语言 prompt 生成 workflow(ai.generate-workflow)
 * - lokvis_ai_optimize_workflow: 优化已有 workflow(ai.optimize-workflow)
 * - lokvis_ai_diagnose_error: 诊断 workflow 执行错误(ai.diagnose-error)
 *
 * 这三个能力为 params→data 形态(无文件输入),runtime.run 传空 inputs 数组,
 * capability execute 忽略 inputs 只消费 params,输出为 data 类型 Asset(JSON)。
 *
 * 前置条件:server.ts 在 domains 包含 'ai' 且 cloud 配置提供时,
 * 安装 plugin-ai 并注入 CloudAiClient 作为 cloudCaller。
 * 无 cloud 配置时 'ai' domain 不可用(能力为 stub,runtime.run 报错)。
 *
 * 输入:JSON 参数(prompt / workflow / error)
 * 输出:生成的 workflow JSON / 优化后的 workflow JSON / 诊断报告 JSON
 */

import type { LokvisRuntime } from '@lokvis/sdk';
import type { McpToolResult } from '../server.js';
import { buildSingleTransformWorkflow } from './workflow-helpers.js';
import {
  aiGenerateWorkflowSchema,
  aiOptimizeWorkflowSchema,
  aiDiagnoseErrorSchema,
  validateParams,
} from './schemas.js';
import { GENERATED_TOOL_META } from './tool-metadata.generated.js';
import { requireToolMeta } from './manual-overrides.js';

/**
 * 通用 AI params→data 流程:构造 workflow → runtime.run([]) → 读取输出 JSON。
 *
 * AI 能力不接受文件输入,inputs 传空数组;输出为 data 类型 Asset,
 * 导出后读取文本内容(JSON 字符串)返回给 MCP 客户端。
 */
async function runAiCapability(
  runtime: LokvisRuntime,
  capability: string,
  params: Record<string, unknown>
): Promise<string> {
  // AI 能力输出为 data(JSON),用 'other' category + 'data' asset type
  const workflow = buildSingleTransformWorkflow(capability, params, 'other', 'data');
  const result = await runtime.run(workflow, []);
  if (result.status !== 'completed' || !result.outputs[0]) {
    throw new Error(
      `Workflow ${capability} failed: status=${result.status}` +
        (result.error ? ` error=${result.error}` : '')
    );
  }

  const outAssetId = result.outputs[0];
  const outBlob = await runtime.exportAsset(outAssetId);
  const text = await outBlob.text();

  // 清理 output asset
  await runtime.removeAsset(outAssetId).catch((e) => {
    console.warn('[mcp-server] cleanup ai output asset failed:', e);
  });

  return text;
}

/** 错误结果构造 */
function errorResult(message: string): McpToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

/**
 * 注册 AI tools 到 MCP server adapter。
 *
 * 工具描述与 inputSchema 由 codegen 数据驱动（G4）：
 * - description / capability 映射来自 tool-metadata.generated.ts
 *   （capability manifests + @lokvis/data-formats 格式约束）
 * - inputSchema 与描述增强来自 manual-overrides.ts（MCP 特有 input_path/output_path）
 * 本函数仅提供 handler（走 runtime capability 系统）。
 *
 * @param runtime Lokvis Runtime
 */
export function getAiToolRegistrations(runtime: LokvisRuntime): Array<{
  name: string;
  description: string;
  inputSchema: object;
  handler: (params: Record<string, unknown>) => Promise<McpToolResult>;
}> {
  const reg = (
    toolName: string,
    handler: (params: Record<string, unknown>) => Promise<McpToolResult>,
  ) => {
    const meta = requireToolMeta(GENERATED_TOOL_META, toolName);
    return {
      name: meta.name,
      description: meta.description,
      inputSchema: meta.inputSchema,
      handler,
    };
  };

  return [
    reg('lokvis_ai_generate_workflow', async (params) => {
      const r = validateParams(aiGenerateWorkflowSchema, params);
      if (!r.success) return r.error;
      try {
        const json = await runAiCapability(runtime, 'ai.generate-workflow', {
          prompt: r.data.prompt,
        });
        return { content: [{ type: 'text', text: json }] };
      } catch (err) {
        return errorResult(
          `AI generate-workflow failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }),
    reg('lokvis_ai_optimize_workflow', async (params) => {
      const r = validateParams(aiOptimizeWorkflowSchema, params);
      if (!r.success) return r.error;
      try {
        // 解析 workflow JSON 字符串为对象传给 capability
        let workflowObj: unknown;
        try {
          workflowObj = JSON.parse(r.data.workflow);
        } catch {
          return errorResult('Invalid workflow JSON: failed to parse');
        }
        const json = await runAiCapability(runtime, 'ai.optimize-workflow', {
          workflow: workflowObj,
        });
        return { content: [{ type: 'text', text: json }] };
      } catch (err) {
        return errorResult(
          `AI optimize-workflow failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }),
    reg('lokvis_ai_diagnose_error', async (params) => {
      const r = validateParams(aiDiagnoseErrorSchema, params);
      if (!r.success) return r.error;
      try {
        const json = await runAiCapability(runtime, 'ai.diagnose-error', {
          error: r.data.error,
        });
        return { content: [{ type: 'text', text: json }] };
      } catch (err) {
        return errorResult(
          `AI diagnose-error failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }),
  ];
}
