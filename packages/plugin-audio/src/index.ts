/**
 * @lokvis/plugin-audio
 *
 * 官方音频处理插件。通过 engine-audio 实现 4 个核心音频能力:
 * trim / normalize / merge / transcode
 *
 * 设计原则:
 * - Plugin 只看到 PluginContext(Runtime 受限 API)与 engine-audio
 * - 不直接依赖 React / Redux / Cloud
 */

export { audioToolsPlugin as default, audioToolsPlugin } from './plugin.js';
export {
  buildAudioCapabilityImplementations,
  type AudioOperationEntry,
  type AudioOperationKind,
  type SingleAudioOperation,
  type MergeAudioOperation,
} from './operations.js';
