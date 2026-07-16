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
  McpAuthenticator,
  createAuthenticator,
} from './auth.js';
export type { AuthenticatedUser, AuthResult } from './auth.js';

export {
  McpBilling,
  createBilling,
} from './billing.js';
export type { BillingCheckResult } from './billing.js';

export {
  resolveCloudConfig,
} from './cloud-config.js';
export type { CloudConfig } from './cloud-config.js';
