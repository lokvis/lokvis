/**
 * @lokvis/mcp-server
 *
 * 把 Lokvis Runtime 的本地处理能力包装为 MCP server,让 AI 客户端
 * (Claude / ChatGPT / Cursor)通过 MCP 协议直接调用本地处理能力。
 *
 * 状态:Phase 2 骨架(见 docs/AI生态冲击调整方案.md §3.12)
 * - 接口与传输抽象已定义
 * - 实际 tool 实现(image compress/resize/batch)在 Phase 2 W5-W6 完成
 *
 * 运行模式(混合架构 E):
 *   模式 1(浏览器连接):AI → stdio → mcp-server → WebSocket → 浏览器 Runtime(完整能力)
 *   模式 2(Node 降级):AI → stdio → mcp-server → sharp + fs(基础能力)
 *
 * @example
 * ```ts
 * import { createLokvisMcpServer } from '@lokvis/mcp-server';
 *
 * const { server, runtime } = await createLokvisMcpServer({
 *   workdir: '/Users/you/Documents',
 *   domains: ['image'],
 *   mode: 'stdio',
 * });
 * ```
 */

export { createLokvisMcpServer } from './server.js';
export type {
  LokvisMcpServer,
  LokvisMcpOptions,
  LokvisMcpTransport,
  LokvisMcpDomain,
  McpToolHandler,
  McpResourceHandler,
  McpPromptHandler,
  McpToolResult,
  McpResourceResult,
  McpPromptResult,
} from './server.js';
export { McpServerAdapter } from './mcp-server-adapter.js';
export { NodeAssetStore } from './node-asset-store.js';
export {
  imageResize,
  imageCompress,
  imageConvert,
  imageCrop,
  imageWatermark,
  getImageToolRegistrations,
} from './tools/image.js';
export {
  pdfMerge,
  pdfCompress,
  getPdfToolRegistrations,
} from './tools/pdf.js';
export { ToolRouter } from './router.js';
export type { ToolHandler } from './router.js';
export { BrowserBridge } from './browser-bridge.js';
export type { BrowserBridgeOptions, BridgeToolResult } from './browser-bridge.js';
export { LokvisSseServer } from './sse-transport.js';
export type { LokvisSseServerOptions } from './sse-transport.js';
export { McpAuthenticator, isValidApiKeyFormat, createAuthenticator } from '@lokvis/cloud-bridge';
export type { AuthenticatedUser, AuthResult } from '@lokvis/cloud-bridge';
export { McpBilling, createBilling } from '@lokvis/cloud-bridge';
export type { BillingCheckResult } from '@lokvis/cloud-bridge';
export { resolveCloudConfig } from '@lokvis/cloud-bridge';
export type { CloudConfig } from '@lokvis/cloud-bridge';
