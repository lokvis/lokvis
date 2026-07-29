/**
 * Image Tools Plugin 定义
 *
 * 通过 definePlugin 注册 9 个图像变换能力声明,
 * installer 阶段把每个能力映射到 engine-image 的实现。
 *
 * 此外注册 1 个元数据读取器(image.read-exif),走 MetadataReader 机制
 * 而非 Capability execute —— EXIF 读取是 Blob→ExifData 查询,不符合
 * Asset→Asset 变换契约(见 schema/src/plugin.ts MetadataReader 注释)。
 */

import { definePlugin } from '@lokvis/plugin-sdk';
import { IMAGE_CAPABILITIES } from '@lokvis/capability';
import type { ExifData } from '@lokvis/schema';
import { METADATA_READER_NAMES } from '@lokvis/schema';
import { buildImageCapabilityImplementations } from './operations.js';
import { readExifFromBlob } from './exif-reader.js';

export const PLUGIN_NAME = 'lokvis-image-tools';
export const PLUGIN_VERSION = '0.1.0';
export const PLUGIN_ENGINE = 'canvas';

/** 元数据读取器名称(单一来源:@lokvis/schema METADATA_READER_NAMES) */
export const EXIF_READER_NAME = METADATA_READER_NAMES.imageExif;

/**
 * 创建图像工具插件
 *
 * @example
 * ```ts
 * import { createLokvis } from '@lokvis/sdk';
 * import { imageToolsPlugin } from '@lokvis/plugin-image';
 *
 * const lokvis = await createLokvis({
 *   plugins: [imageToolsPlugin()],
 * });
 * ```
 */
export function imageToolsPlugin() {
  return definePlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description:
        'Official image tools: resize / compress / convert / crop / rotate / flip / watermark / background / filter + EXIF reader',
      capabilities: IMAGE_CAPABILITIES,
      engine: PLUGIN_ENGINE,
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      // 变换能力(Asset→Asset,经 CapabilityRegistry / WorkflowExecutor)
      const impls = buildImageCapabilityImplementations(ctx);
      for (const impl of impls) {
        ctx.registerCapability(impl);
      }

      // 元数据读取(Asset→ExifData,经 MetadataReader,不经 WorkflowExecutor)
      // Runtime.readAssetExif 通过此 reader 调用,UI 不直接依赖 plugin / engine
      // TD-3.4:reader 接收 MetadataReaderContext,透传 log 给 readExifFromBlob,
      // 使解析异常可经 ctx.log('warn', ...) 上报(与"无 EXIF"区分)
      ctx.registerMetadataReader<ExifData>(EXIF_READER_NAME, async (asset, readerCtx) => {
        const blob = await ctx.runtime.getAssetBlob(asset);
        return readExifFromBlob(blob, { log: readerCtx.log });
      });

      ctx.log(
        'info',
        `Registered ${impls.length} image capabilities + EXIF reader`
      );
    }
  );
}
