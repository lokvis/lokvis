/**
 * @lokvis/plugin-video
 *
 * 官方视频处理插件。通过 engine-video 实现 7 个核心视频能力：
 * compress / transcode / trim / merge / extract-audio / to-gif / screenshot
 *
 * 设计原则：
 * - Plugin 只看到 PluginContext（Runtime 受限 API）与 engine-video
 * - 不直接依赖 React / Redux / Cloud
 *
 * 参考 docs/whitepaper/04-技术架构设计.md 第七节「Plugin Layer」。
 */

export { videoToolsPlugin as default, videoToolsPlugin } from './plugin.js';
export {
  buildVideoCapabilityImplementations,
  type VideoOperationEntry,
} from './operations.js';
