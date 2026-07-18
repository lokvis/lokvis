/**
 * plugin-batch-watermark 入口(E1)
 *
 * 教学用 N→1 merge 示例插件:注册 `image.batch-watermark` 能力,
 * 把多张图片逐张盖上文字水印,再拼接成一张 contact sheet。
 *
 * 与 plugin-grayscale(1→1 single)互补,展示 `createMergeCapabilityImpl` 工厂用法。
 */
export {
  batchWatermarkPlugin,
  batchWatermark,
  buildBatchWatermarkCapabilityImplementations,
  PLUGIN_NAME,
  PLUGIN_VERSION,
  PLUGIN_ENGINE,
  type BatchWatermarkParams,
  type WatermarkPosition,
} from './plugin.js';
