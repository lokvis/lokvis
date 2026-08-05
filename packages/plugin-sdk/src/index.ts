/**
 * @lokvis/plugin-sdk
 *
 * Plugin 开发 SDK。Plugin 只能看到 Runtime API，看不到 React/Redux/Cloud。
 * 通过 definePlugin 定义插件，安装时通过 PluginContext 注册能力。
 *
 * 定位(见 docs/AI生态冲击调整方案.md §4):
 * - 角色:浏览器内嵌入场景的兼容层,不再是生态核心
 * - 优先级:Alpha 预览(0.1.0-alpha),不发布 v1.0
 * - 替代方案:若想让 AI 调用你的能力,推荐使用 @lokvis/mcp-server(MCP 标准)
 *
 * 适用场景:
 * 1. 用 @lokvis/sdk 嵌入 Lokvis 到自己网站,需自定义能力 → Plugin SDK
 * 2. 让 Claude/ChatGPT/Cursor 调用本地能力 → MCP server(推荐)
 *
 * 维持现状的 API:definePlugin / createCapabilityImpl / definePanel 不变。
 *
 * 实现见 plugin-sdk.ts;本文件为 barrel(re-export)。
 */

export type {
  Asset,
  AssetMetadata,
  AssetType,
  Capability,
  CapabilityImplementation,
  ExecutionContext,
  PluginConfig,
  PluginContext,
  PluginInstaller,
  PluginPermission,
  PanelDefinition,
} from '@lokvis/schema';

export {
  definePlugin,
  createCapabilityImpl,
  definePanel,
  defaultDeriveOutputMetadata,
  deriveOutputMetadata,
  deriveOutputMetadataWithSource,
  createBlobCapabilityImpl,
  createMergeCapabilityImpl,
  createSplitCapabilityImpl,
  registerImplementations,
  isStubEngine,
  createBlobMetadataReader,
  createStubMessage,
} from './plugin-sdk.js';

export type {
  BlobCapabilityOptions,
  MergeCapabilityOptions,
  SplitCapabilityOptions,
  EngineDescriptor,
  MetadataReaderContext,
  BlobOperation,
  MergeOperation,
  SplitOperation,
} from './plugin-sdk.js';
