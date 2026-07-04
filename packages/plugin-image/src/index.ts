/**
 * @lokvis/plugin-image
 *
 * 官方图像处理插件。通过 engine-image 实现 9 个核心图像变换能力：
 * resize / compress / convert / crop / rotate / flip / watermark / background / filter
 *
 * 另通过 MetadataReader 机制注册 EXIF 读取能力(image.read-exif),
 * 供 runtime.readAssetExif 调用(UI 不直接依赖本包)。
 *
 * 设计原则：
 * - Plugin 只看到 PluginContext（Runtime 受限 API）与 engine-image
 * - 不直接依赖 React / Redux / Cloud
 *
 * 参考 docs/whitepaper/04-技术架构设计.md 第七节「Plugin Layer」。
 */

export { imageToolsPlugin as default, imageToolsPlugin, EXIF_READER_NAME } from './plugin.js';
export {
  buildImageCapabilityImplementations,
  type ImageCapabilityEntry,
} from './operations.js';
export { readExifFromBlob } from './exif-reader.js';
