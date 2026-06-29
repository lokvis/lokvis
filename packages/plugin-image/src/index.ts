/**
 * @lokvis/plugin-image
 *
 * 官方图像处理插件。通过 engine-image 实现 8 个核心图像能力：
 * resize / compress / convert / crop / rotate / flip / watermark / background
 *
 * 设计原则：
 * - Plugin 只看到 PluginContext（Runtime 受限 API）与 engine-image
 * - 不直接依赖 React / Redux / Cloud
 *
 * 参考 docs/whitepaper/04-技术架构设计.md 第七节「Plugin Layer」。
 */

export { imageToolsPlugin as default, imageToolsPlugin } from './plugin.js';
export {
  buildImageCapabilityImplementations,
  type ImageCapabilityEntry,
} from './operations.js';
