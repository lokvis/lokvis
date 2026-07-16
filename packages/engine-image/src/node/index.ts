/**
 * @lokvis/engine-image/node
 *
 * Node.js 图像引擎,基于 sharp(libvips)实现。
 *
 * 通过子路径 `@lokvis/engine-image/node` 暴露,与浏览器主入口
 * `@lokvis/engine-image` 分离(避免浏览器构建引入 sharp)。
 *
 * 与浏览器引擎对齐的 5 个核心操作:
 * - resize / compress / convert / crop / watermark
 *
 * 设计原则:
 * - 操作函数签名与浏览器版完全一致(Blob → Blob + Record<string,any> + AbortSignal)
 * - 不依赖 DOM / Canvas / ImageBitmap,纯 Node.js 环境
 * - 类型定义共享 ../types.js(消除原 engine-image-node 包的双源维护,问题 B)
 *
 * 用途:
 * - MCP Server(Node 端 image tool 的实际执行器)
 * - 离线批处理 / CI 流水线
 * - 浏览器未连接时的降级路径(见 mcp-server/src/router.ts ToolRouter)
 *
 * 参考:docs/reports/architecture-deep-diagnostic-20260712.md §M2.2
 */

// 通用类型从 ../types.js 复用(消除双源维护)。
// 仅 re-export Node 端实际消费的纯类型,不引入 ImageEngineAdapter /
// DecodedImage 等与浏览器 DOM API(ImageBitmap / HTMLCanvasElement)耦合的类型,
// 保证 Node 端 typecheck 不依赖 DOM lib。
export type {
  ImageOutputFormat,
  FitStrategy,
  WatermarkPosition,
  ResizeParams,
  CompressParams,
  ConvertParams,
  CropParams,
  WatermarkParams,
} from '../types.js';

export type { NodeImageEngineDescriptor } from './types.js';

export * from './sharp-engine.js';
export * from './operations/index.js';
