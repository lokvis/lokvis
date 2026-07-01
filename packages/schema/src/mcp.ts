/**
 * Lokvis MCP 类型定义
 *
 * 把 Lokvis Runtime 的能力包装为 MCP server 时使用的 manifest 类型。
 * 由 @lokvis/runtime 实现 toMcpManifest(),@lokvis/mcp-server 消费。
 *
 * 类型定义在 schema 包(而非 sdk/runtime)是为了避免
 * runtime → sdk 的循环依赖:runtime 和 sdk 都从 @lokvis/schema 引入。
 */

/** 单个 MCP tool 的描述(不启动 server,仅描述可用能力) */
export interface McpToolManifest {
  /** tool 名称,约定为 `lokvis_${capability.replace(/\./g, '_')}` */
  name: string;
  /** tool 描述,供 AI 客户端理解用途 */
  description: string;
  /** 输入参数 JSON Schema */
  inputSchema: object;
  /** 依赖的 Lokvis capability 名 */
  capabilities: string[];
}

/** 单个 MCP resource 的描述 */
export interface McpResourceManifest {
  /** resource URI,如 `lokvis://capabilities` */
  uri: string;
  /** resource 名称(UI 显示用) */
  name: string;
  /** resource 描述 */
  description: string;
  /** MIME 类型 */
  mimeType: string;
}

/** MCP server manifest:Runtime 当前可被 MCP 暴露的能力概览 */
export interface McpManifest {
  /** MCP server 名称,固定为 `lokvis` */
  serverName: string;
  /** Runtime 版本 */
  version: string;
  /** 暴露的 tools 列表 */
  tools: McpToolManifest[];
  /** 暴露的 resources 列表 */
  resources: McpResourceManifest[];
}
