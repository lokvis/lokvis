/**
 * Image Tools Plugin — Node 环境版本(基于 sharp 引擎)
 *
 * 与浏览器版本 `imageToolsPlugin()` 的区别:
 * - engine: 'sharp'(基于 libvips),而非 'canvas'(基于浏览器 Canvas API)
 * - 5 个核心操作由 `@lokvis/engine-image-node` 实现:
 *   resize / compress / convert / crop / watermark
 * - 4 个操作暂未在 Node 引擎实现,注册为 stub(isStub=true),
 *   CapabilityRegistry.resolve() 会跳过 stub,executor 在 stub-only 时
 *   给出明确错误提示(AGENTS.md「Stub Engine 处理」约定)
 *
 * 用途:
 * - MCP Server(Node 端 image tool 实际执行器)
 * - 离线批处理 / CI 流水线
 * - 浏览器未连接时的降级路径(见 mcp-server/src/router.ts ToolRouter)
 *
 * 通过子路径 `@lokvis/plugin-image/node` 导出,避免浏览器构建加载 sharp:
 *   import { imageToolsPluginNode } from '@lokvis/plugin-image/node';
 *
 * 参考:docs/reports/architecture-deep-diagnostic-20260712.md §M2.2
 */
import { definePlugin, createBlobCapabilityImpl } from '@lokvis/plugin-sdk';
import { IMAGE_CAPABILITIES } from '@lokvis/capability';
import type { ExifData } from '@lokvis/schema';
import {
  resize as opResize,
  compress as opCompress,
  convert as opConvert,
  crop as opCrop,
  watermark as opWatermark,
} from '@lokvis/engine-image-node';
import { PLUGIN_NAME, PLUGIN_VERSION, EXIF_READER_NAME } from './plugin.js';
import { readExifFromBlob } from './exif-reader.js';
import type { ImageOperation } from './operations.js';

/** Node 引擎名(对应 sharpEngine.name) */
export const PLUGIN_ENGINE_NODE = 'sharp' as const;

/** Node 环境下未实现的操作集合(标记为 stub) */
const NODE_STUB_CAPABILITIES = new Set<string>([
  'image.rotate',
  'image.flip',
  'image.background',
  'image.filter',
]);

/**
 * 构造 Node 环境下不支持的操作的 stub 函数。
 *
 * stub 函数永远抛错(给出明确的 capability 名 + 支持列表),
 * 但同时 isStub=true 让 CapabilityRegistry 自动跳过,executor 优先
 * 选择非 stub 实现(浏览器路径,见 mcp-server/src/router.ts)。
 * 当仅有 stub 实现可用时,executor 会调用本函数并抛出此错误。
 */
function createUnsupportedNodeOp(capability: string): ImageOperation {
  return async (_blob, _params, signal) => {
    if (signal?.aborted) {
      throw new DOMException('Operation aborted', 'AbortError');
    }
    throw new Error(
      `Operation "${capability}" is not supported by the sharp engine in Node environment. ` +
        `Supported operations: resize, compress, convert, crop, watermark. ` +
        `Use the browser path (canvas engine) for rotate / flip / background / filter.`
    );
  };
}

/**
 * 创建图像工具插件(Node 环境,基于 sharp 引擎)
 *
 * @example
 * ```ts
 * import { createLokvis } from '@lokvis/sdk';
 * import { imageToolsPluginNode } from '@lokvis/plugin-image/node';
 *
 * const lokvis = await createLokvis({
 *   plugins: [await imageToolsPluginNode()],
 * });
 * ```
 *
 * 注:本函数为 async,因为 `definePlugin` 接受的 installer 是同步的,
 * 而 Node 引擎的 5 个操作在模块加载时已通过 `import` 静态绑定到
 * `@lokvis/engine-image-node`,无需运行时动态加载。async 仅为保留未来
 * 引擎初始化(如 sharp 预热、libvips 缓存配置)的扩展点。
 */
export async function imageToolsPluginNode() {
  return definePlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description:
        'Official image tools (Node, sharp): resize / compress / convert / crop / watermark + EXIF reader',
      capabilities: IMAGE_CAPABILITIES,
      engine: PLUGIN_ENGINE_NODE,
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      // 9 个能力的实现绑定项(5 真实 + 4 stub)
      const entries = [
        { capability: 'image.resize', operation: opResize as ImageOperation },
        { capability: 'image.compress', operation: opCompress as ImageOperation },
        { capability: 'image.convert', operation: opConvert as ImageOperation },
        { capability: 'image.crop', operation: opCrop as ImageOperation },
        { capability: 'image.watermark', operation: opWatermark as ImageOperation },
        { capability: 'image.rotate', operation: createUnsupportedNodeOp('image.rotate') },
        { capability: 'image.flip', operation: createUnsupportedNodeOp('image.flip') },
        { capability: 'image.background', operation: createUnsupportedNodeOp('image.background') },
        { capability: 'image.filter', operation: createUnsupportedNodeOp('image.filter') },
      ];

      const impls = entries.map((entry) =>
        createBlobCapabilityImpl(
          {
            capability: entry.capability,
            engine: PLUGIN_ENGINE_NODE,
            outputType: 'image',
            operation: entry.operation,
            isStub: NODE_STUB_CAPABILITIES.has(entry.capability),
          },
          ctx
        )
      );
      for (const impl of impls) {
        ctx.registerCapability(impl);
      }

      // EXIF reader 在 Node 环境同样可用(exifr 是纯 JS,无 DOM 依赖)
      ctx.registerMetadataReader<ExifData>(EXIF_READER_NAME, async (asset) => {
        const blob = await ctx.runtime.getAssetBlob(asset);
        return readExifFromBlob(blob);
      });

      ctx.log(
        'info',
        `Registered ${impls.length} image capabilities (sharp engine, ` +
          `${impls.length - NODE_STUB_CAPABILITIES.size} real + ${NODE_STUB_CAPABILITIES.size} stub) + EXIF reader`
      );
    }
  );
}
