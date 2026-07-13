/**
 * @lokvis/engine-image-node
 *
 * Node.js 图像引擎,基于 sharp(libvips)实现。
 *
 * 与浏览器引擎 @lokvis/engine-image 对齐的 5 个核心操作:
 * - resize / compress / convert / crop / watermark
 *
 * 设计原则:
 * - 操作函数签名与 engine-image 完全一致(Blob → Blob + Record<string,any> + AbortSignal)
 * - 不依赖 DOM / Canvas / ImageBitmap,纯 Node.js 环境
 * - 不修改 engine-image,保持浏览器引擎纯净
 *
 * 用途:
 * - MCP Server(Node 端 image tool 的实际执行器)
 * - 离线批处理 / CI 流水线
 * - 浏览器未连接时的降级路径(见 mcp-server/src/router.ts ToolRouter)
 *
 * 参考:docs/reports/architecture-deep-diagnostic-20260712.md §M2.2
 */

export * from './types.js';
export * from './sharp-engine.js';
export * from './operations/index.js';
