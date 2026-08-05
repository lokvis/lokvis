/**
 * Image Tools Plugin — Node 环境版本(基于 sharp 引擎)
 *
 * 通过子路径 `@lokvis/plugin-image/node` 导出,避免浏览器构建加载 sharp:
 *   import { imageToolsPluginNode } from '@lokvis/plugin-image/node';
 *
 * 本文件为 thin wrapper,实际逻辑由 real-plugin.ts 的 buildRealImagePlugin 处理。
 */
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
import { buildRealImagePlugin } from './real-plugin.js';
import type { ImageOperation } from './operations.js';

/** Node 引擎名(对应 sharpEngine.name) */
export const PLUGIN_ENGINE_NODE = 'sharp' as const;

/**
 * 创建图像工具插件(Node 环境,基于 sharp 引擎)
 *
 * 10 个真实能力 + EXIF reader + ImageMetadata reader。
 */
export async function imageToolsPluginNode() {
  return buildRealImagePlugin(
    {
      engineName: PLUGIN_ENGINE_NODE,
      logEngineDesc: 'sharp engine',
    },
    {
      resize: opResize as ImageOperation,
      compress: opCompress as ImageOperation,
      convert: opConvert as ImageOperation,
      crop: opCrop as ImageOperation,
      watermark: opWatermark as ImageOperation,
      rotate: opRotate as ImageOperation,
      flip: opFlip as ImageOperation,
      background: opBackground as ImageOperation,
      filter: opFilter as ImageOperation,
      favicon: opFavicon as ImageOperation,
      getMetadata,
    }
  );
}
