/**
 * @lokvis/cloud-bridge 公共 API(问题 A)。
 *
 * 把原 mcp-server 硬编码的 cloud 鉴权/计费逻辑抽到独立包,
 * 作为 mcp-server 的可注入依赖(符合 architecture.md §1.5
 * "lokvis-open 永远不导入 lokvis-cloud" 精神)。
 *
 * 用法:
 * ```ts
 * import { resolveCloudConfig, createAuthenticator, createBilling } from '@lokvis/cloud-bridge';
 *
 * const config = resolveCloudConfig(); // 从 process.env 读取
 * const authenticator = createAuthenticator(config);
 * const billing = createBilling(config);
 * ```
 */
export {
  isValidApiKeyFormat,
  CloudAuthenticator,
  createAuthenticator,
} from './auth.js';
export type { AuthenticatedUser, AuthResult } from './auth.js';

export {
  CloudBilling,
  createBilling,
} from './billing.js';
export type { BillingCheckResult } from './billing.js';

export {
  resolveCloudConfig,
} from './cloud-config.js';
export type { CloudConfig, PppPricing } from './cloud-config.js';

// F1:Cloud AI Client(封装 /v1/ai/* 调用,供 engine-ai cloud-proxy 转发)
export {
  CloudAiClient,
  CloudAiError,
  createAiClient,
  CLOUD_PROXY_ENGINE_NAME,
  CLOUD_PROXY_ENGINE_VERSION,
} from './ai-client.js';
export type {
  GenerateWorkflowParams,
  OptimizeWorkflowParams,
  DiagnoseErrorParams,
  DiagnoseErrorReport,
} from './ai-client.js';
