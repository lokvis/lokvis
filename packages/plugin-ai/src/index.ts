/**
 * @lokvis/plugin-ai
 *
 * 官方 AI 工具插件。通过 engine-ai 实现 5 个 AI 能力:
 * ocr / caption / background-remove / generate-workflow / optimize-workflow
 *
 * 设计原则:
 * - Plugin 只看到 PluginContext(Runtime 受限 API)与 engine-ai
 * - 不直接依赖 React / Redux / Cloud
 * - AI 只设计,不执行:生成的 workflow 由 Runtime 确定性执行
 */

export { aiToolsPlugin as default, aiToolsPlugin } from './plugin.js';
export {
  buildAiCapabilityImplementations,
  type AiCapabilityEntry,
  type SingleAiOperation,
} from './operations.js';
