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
 * 导出路径：
 * - `@lokvis/plugin-video`：默认入口(全 stub,不加载 wasm)
 * - `@lokvis/plugin-video/web`：浏览器版(ffmpeg.wasm,7 个真实操作)
 * - `@lokvis/plugin-video/node`：Node 版(ffmpeg-static,7 个真实操作)
 *
 * 参考 docs/whitepaper/04-技术架构设计.md 第七节「Plugin Layer」。
 */

export { videoToolsPlugin as default, videoToolsPlugin } from './plugin.js';
export { videoToolsPluginWeb } from './web-plugin.js';
export {
  buildVideoCapabilityImplementations,
  type VideoOperationEntry,
} from './operations.js';
