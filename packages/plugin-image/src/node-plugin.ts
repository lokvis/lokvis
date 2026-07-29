/**
 * Image Tools Plugin — Node 环境版本(基于 sharp 引擎)
 *
 * 与浏览器版本 `imageToolsPlugin()` 的区别:
 * - engine: 'sharp'(基于 libvips),而非 'canvas'(基于浏览器 Canvas API)
 * - 全部 10 个操作由 `@lokvis/engine-image/node` 实现:
 *   resize / compress / convert / crop / watermark /
 *   rotate / flip / background / filter / favicon
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
import type { ExifData, ImageMetadata } from '@lokvis/schema';
import { METADATA_READER_NAMES } from '@lokvis/schema';
import {
  resize as opResize,
  compress as opCompress,
  convert as opConvert,
  crop as opCrop,
  watermark as opWatermark,
  rotate as opRotate,
  flip as opFlip,
  background as opBackground,
  filter as opFilter,
  encodeIco as opFavicon,
  getMetadata,
} from '@lokvis/engine-image/node';
import { PLUGIN_NAME, PLUGIN_VERSION, EXIF_READER_NAME } from './plugin.js';
import { readExifFromBlob } from './exif-reader.js';
import type { ImageOperation } from './operations.js';

/** Node 引擎名(对应 sharpEngine.name) */
export const PLUGIN_ENGINE_NODE = 'sharp' as const;

/** 元数据读取器名称(单一来源:@lokvis/schema METADATA_READER_NAMES) */
export const IMAGE_METADATA_READER_NAME = METADATA_READER_NAMES.imageMetadata;

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
 * 而 Node 引擎的 10 个操作在模块加载时已通过 `import` 静态绑定到
 * `@lokvis/engine-image/node`,无需运行时动态加载。async 仅为保留未来
 * 引擎初始化(如 sharp 预热、libvips 缓存配置)的扩展点。
 */
export async function imageToolsPluginNode() {
  return definePlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description:
        'Official image tools (Node, sharp): resize / compress / convert / crop / watermark / rotate / flip / background / filter / favicon + EXIF reader',
      capabilities: IMAGE_CAPABILITIES,
      engine: PLUGIN_ENGINE_NODE,
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      // 10 个能力的实现绑定项(全部为真实 sharp 实现)
      // engine-image/node 操作签名已对齐 ImageOperation(blob, Record<string, unknown>, signal),
      // 无需类型断言(AGENTS.md「禁止 as unknown as 双断言」精神)
      const entries: Array<{ capability: string; operation: ImageOperation }> = [
        { capability: 'image.resize', operation: opResize },
        { capability: 'image.compress', operation: opCompress },
        { capability: 'image.convert', operation: opConvert },
        { capability: 'image.crop', operation: opCrop },
        { capability: 'image.watermark', operation: opWatermark },
        { capability: 'image.rotate', operation: opRotate },
        { capability: 'image.flip', operation: opFlip },
        { capability: 'image.background', operation: opBackground },
        { capability: 'image.filter', operation: opFilter },
        { capability: 'image.favicon', operation: opFavicon },
      ];

      const impls = entries.map((entry) =>
        createBlobCapabilityImpl(
          {
            capability: entry.capability,
            engine: PLUGIN_ENGINE_NODE,
            outputType: 'image',
            operation: entry.operation,
            isStub: false,
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

      // 图像 dimensions/format 查询 reader(供 mcp-server 报告处理结果尺寸)。
      // 内部调 engine-image/node 的 getMetadata(sharp .metadata()),
      // 走 MetadataReader 机制避免上层(mcp-server)直接依赖 engine-image。
      ctx.registerMetadataReader<ImageMetadata>(
        IMAGE_METADATA_READER_NAME,
        async (asset, readerCtx) => {
          const blob = await ctx.runtime.getAssetBlob(asset);
          try {
            return await getMetadata(blob);
          } catch (err) {
            // 解析失败与"无数据"区分:warn 上报,返回 null 不影响主流程
            readerCtx.log('warn', `getMetadata failed: ${err instanceof Error ? err.message : String(err)}`);
            return null;
          }
        }
      );

      ctx.log(
        'info',
        `Registered ${impls.length} image capabilities (sharp engine, all real) + EXIF reader + metadata reader`
      );
    }
  );
}
