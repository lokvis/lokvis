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
  type ImageOperationEntry,
} from './operations.js';
export { readExifFromBlob } from './exif-reader.js';
// Engine 预加载桥接（review fix：UI 通过 Capability 层访问 Engine 懒加载工具，避免跨层引用）
export {
  lazyLoadOperation,
  prefetchOperation,
  preloadTop5Operations,
  clearOperationCache,
  isOperationLoaded,
  TOP_5_OPERATIONS,
  type BlobOperation,
} from './engine-prefetch.js';
