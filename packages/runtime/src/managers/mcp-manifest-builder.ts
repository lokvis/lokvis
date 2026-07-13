/**
 * MCP Manifest Builder(W1.5 从 runtime.ts 抽取)
 *
 * 把已注册 Capability 列表转换为 MCP server manifest(纯函数,无 `this`,
 * 不依赖 CapabilityRegistry)。Runtime.toMcpManifest() 委托本模块。
 *
 * 暴露规则(见 docs/AI生态冲击调整方案.md §6):
 * - private:任何模式都不暴露
 * - batch-only:仅在 options.batchMode=true 时暴露(避免单文件误用)
 * - 其余(默认 public):总是暴露
 * tool 名取 capability.mcpToolName 或 `lokvis_${name.replace(/\./g, '_')}`;
 * resource 固定为 capabilities 与 workflows 两个清单。
 */

import type {
  Capability, CapabilityParam, CapabilityParamType,
  McpManifest, McpToolManifest,
} from '@lokvis/schema';
import type { ToMcpManifestOptions } from '../types.js';

const SERVER_NAME = 'lokvis';
const CAPABILITIES_URI = 'lokvis://capabilities';
const WORKFLOWS_URI = 'lokvis://workflows';

/** 生成 MCP server manifest(不启动 server,仅描述可被 MCP 暴露的能力)。 */
export function toMcpManifest(
  capabilities: Capability[],
  options: ToMcpManifestOptions = {},
  version: string
): McpManifest {
  const { batchMode = false } = options;
  const tools: McpToolManifest[] = [];
  for (const cap of capabilities) {
    if (cap.mcpExposure === 'private') continue;
    if (cap.mcpExposure === 'batch-only' && !batchMode) continue;
    const toolName = cap.mcpToolName ?? `lokvis_${cap.name.replace(/\./g, '_')}`;
    tools.push({
      name: toolName,
      description: cap.description,
      inputSchema: capabilityParamsToJsonSchema(cap.params),
      capabilities: [cap.name],
    });
  }
  return {
    serverName: SERVER_NAME, version, tools,
    resources: [
      { uri: CAPABILITIES_URI, name: 'Capabilities',
        description: 'List all available Lokvis capabilities',
        mimeType: 'application/json' },
      { uri: WORKFLOWS_URI, name: 'Workflows',
        description: 'List saved workflows', mimeType: 'application/json' },
    ],
  };
}

/** Capability.params(CapabilityParam[])→ JSON Schema 对象(手写,非 zod-to-json-schema)。 */
function capabilityParamsToJsonSchema(params: CapabilityParam[]): object {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const p of params) {
    properties[p.name] = capabilityParamToJsonSchemaProperty(p);
    if (p.required) required.push(p.name);
  }
  return { type: 'object', properties,
    ...(required.length > 0 ? { required } : {}) };
}

/**
 * CapabilityParamType → 合法 JSON Schema 类型片段。
 * color/file/enum 非 JSON Schema 标准类型,color→string+format,
 * file/enum→string(enum 值由外层 enum 字段追加);其余同名 JSON Schema 类型。
 */
function capabilityParamTypeToJsonType(
  type: CapabilityParamType
): { type: string; format?: string } {
  switch (type) {
    case 'color': return { type: 'string', format: 'color' };
    case 'file':
    case 'enum': return { type: 'string' };
    case 'number':
    case 'string':
    case 'boolean':
    case 'object':
    case 'array': return { type };
    default: return { type: 'string' };
  }
}

/** 单个 CapabilityParam → JSON Schema property */
function capabilityParamToJsonSchemaProperty(
  p: CapabilityParam
): Record<string, unknown> {
  const { type: jsonType, format } = capabilityParamTypeToJsonType(p.type);
  const prop: Record<string, unknown> = { type: jsonType };
  if (format) prop.format = format;
  if (p.description) prop.description = p.description;
  if (p.default !== undefined) prop.default = p.default;
  // min/max 仅对 number 合法(string 应为 minLength/maxLength)
  if (p.type === 'number') {
    if (typeof p.min === 'number') prop.minimum = p.min;
    if (typeof p.max === 'number') prop.maximum = p.max;
  }
  if (p.type === 'enum' && p.values) prop.enum = p.values;
  if (p.type === 'array' && p.items) {
    prop.items = capabilityParamTypeToJsonType(p.items);
  }
  return prop;
}
