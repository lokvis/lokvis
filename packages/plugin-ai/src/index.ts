/**
 * @lokvis/plugin-ai
 *
 * 官方 AI 工具插件。通过 engine-ai 实现 6 个 AI 能力:
 * ocr / caption / background-remove / generate-workflow / optimize-workflow /
 * diagnose-error
 *
 * F1 变更:
 * - 6 个能力(新增 ai.diagnose-error)
 * - aiToolsPlugin 接受可选 { cloudCaller } 注入,cloud-proxy 能力在有 caller
 *   时走真实 cloud-bridge CloudAiClient,无 caller 时走 stub
 *
 * 设计原则:
 * - Plugin 只看到 PluginContext(Runtime 受限 API)与 engine-ai
 * - 不直接依赖 React / Redux / Cloud(engine-ai 通过 AiCloudCaller 接口抽象)
 * - AI 只设计,不执行:生成的 workflow 由 Runtime 确定性执行
 */

export { aiToolsPlugin as default, aiToolsPlugin } from './plugin.js';
export {
  buildAiCapabilityImplementations,
  type SingleAiOperation,
} from './operations.js';
