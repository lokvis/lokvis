/**
 * plugin-grayscale 入口(W18.3)
 *
 * 教学用最小示例插件:注册 `image.grayscale` 能力,把彩色图片转为灰度。
 */
export {
  grayscalePlugin,
  grayscale,
  buildGrayscaleCapabilityImplementations,
  PLUGIN_NAME,
  PLUGIN_VERSION,
  PLUGIN_ENGINE,
  type GrayscaleAlgorithm,
} from './plugin.js';
