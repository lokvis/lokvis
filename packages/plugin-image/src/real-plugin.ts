/**
 * Image Tools Plugin — Node/Web 共享实现(基于 sharp 引擎)
 *
 * node-plugin.ts 的实现此前与 operations.ts ~90% 重复,仅引擎来源不同。
 * 本模块抽取共享骨架:10 个 capability 绑定、EXIF + ImageMetadata 读取器、
 * info 日志,均由 buildRealImagePlugin(options, ops) 一次性构造。
 *
 * 与默认入口 `imageToolsPlugin()`(全 stub、engine-free)的区别:
 * 本模块 import `@lokvis/engine-image/node`,故仅供 `/node` 子路径使用,
 * 不进入默认入口 bundle(浏览器默认省 ~300KB 首屏)。
 */
import {
  createBlobCapabilityImpl,
  definePlugin,
  registerImplementations,
} from '@lokvis/plugin-sdk';
import { IMAGE_CAPABILITIES } from '@lokvis/capability';
import type { ExifData, ImageMetadata } from '@lokvis/schema';
import { METADATA_READER_NAMES } from '@lokvis/schema';
import { PLUGIN_NAME, PLUGIN_VERSION, EXIF_READER_NAME } from './plugin.js';
import { readExifFromBlob } from './exif-reader.js';
import type { ImageOperation } from './operations.js';

/** 元数据读取器名称(单一来源:@lokvis/schema METADATA_READER_NAMES) */
export const IMAGE_METADATA_READER_NAME = METADATA_READER_NAMES.imageMetadata;

/** single 形态的操作绑定项 */
interface RealImageEntry {
  capability: string;
  outputType: 'image';
  operation: ImageOperation;
}

/** buildRealImagePlugin 的环境相关参数 */
export interface RealImagePluginOptions {
  /** 引擎名(如 'sharp') */
  engineName: string;
  /** 日志中的引擎描述,如 "sharp engine" */
  logEngineDesc: string;
}

/** 操作函数集合(由 node/web 入口传入) */
export interface RealImageOperations {
  resize: ImageOperation;
  compress: ImageOperation;
  convert: ImageOperation;
  crop: ImageOperation;
  watermark: ImageOperation;
  rotate: ImageOperation;
  flip: ImageOperation;
  background: ImageOperation;
  filter: ImageOperation;
  favicon: ImageOperation;
  getMetadata: (blob: Blob) => Promise<ImageMetadata>;
}

/** 10 个真实操作绑定项 */
function realImageEntries(ops: RealImageOperations): RealImageEntry[] {
  return [
    { capability: 'image.resize', outputType: 'image', operation: ops.resize },
    { capability: 'image.compress', outputType: 'image', operation: ops.compress },
    { capability: 'image.convert', outputType: 'image', operation: ops.convert },
    { capability: 'image.crop', outputType: 'image', operation: ops.crop },
    { capability: 'image.watermark', outputType: 'image', operation: ops.watermark },
    { capability: 'image.rotate', outputType: 'image', operation: ops.rotate },
    { capability: 'image.flip', outputType: 'image', operation: ops.flip },
    { capability: 'image.background', outputType: 'image', operation: ops.background },
    { capability: 'image.filter', outputType: 'image', operation: ops.filter },
    { capability: 'image.favicon', outputType: 'image', operation: ops.favicon },
  ];
}

/**
 * 构造真实图像工具插件(Node/Web 共享)。
 *
 * 10 个真实能力(resize/compress/convert/crop/watermark/rotate/flip/background/filter/favicon)
 * + EXIF reader + ImageMetadata reader。
 */
export function buildRealImagePlugin(
  options: RealImagePluginOptions,
  ops: RealImageOperations
) {
  const { engineName, logEngineDesc } = options;
  return definePlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description:
        'Official image tools (sharp): resize / compress / convert / crop / watermark / rotate / flip / background / filter / favicon + EXIF reader',
      capabilities: IMAGE_CAPABILITIES,
      engine: engineName,
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      const entries = realImageEntries(ops);
      const impls = entries.map((entry) =>
        createBlobCapabilityImpl(
          {
            capability: entry.capability,
            engine: engineName,
            outputType: entry.outputType,
            operation: entry.operation,
            isStub: false,
          },
          ctx
        )
      );

      registerImplementations(ctx, impls);

      // EXIF reader(exifr 是纯 JS,无 DOM 依赖,Node/Web 均可用)
      ctx.registerMetadataReader<ExifData>(EXIF_READER_NAME, async (asset) => {
        const blob = await ctx.runtime.getAssetBlob(asset);
        return readExifFromBlob(blob);
      });

      // 图像 dimensions/format 查询 reader(供 mcp-server 报告处理结果尺寸)
      ctx.registerMetadataReader<ImageMetadata>(
        IMAGE_METADATA_READER_NAME,
        async (asset, readerCtx) => {
          const blob = await ctx.runtime.getAssetBlob(asset);
          try {
            return await ops.getMetadata(blob);
          } catch (err) {
            readerCtx.log('warn', `getMetadata failed: ${err instanceof Error ? err.message : String(err)}`);
            return null;
          }
        }
      );

      ctx.log(
        'info',
        `Registered ${impls.length} image capabilities (${logEngineDesc}, all real) + EXIF reader + metadata reader`
      );
    }
  );
}
