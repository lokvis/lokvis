/**
 * Cloud AI Client(F1)
 *
 * 封装对 lokvis-cloud `/v1/ai/*` 端点的调用,把 engine-ai 的 cloud-proxy
 * 操作转发至云端 AI 服务(Open Core 原则:开源仓库不内置 AI 推理,
 * 所有 AI 调用经 cloud-bridge 转发)。
 *
 * 三个方法对应 engine-ai 的三个 cloud-proxy 能力:
 * - generateWorkflow():自然语言 → Workflow Schema
 * - optimizeWorkflow():优化已有 workflow
 * - diagnoseError():诊断 workflow 执行错误
 *
 * 流程(每个方法):
 * 1. 必须有 apiKey(无则返回明确错误,不静默降级)
 * 2. POST cloud API,带 x-api-key header
 * 3. 解析 JSON 响应;非 2xx 抛错(401 鉴权失败 / 402 余额不足 / 5xx 服务降级)
 * 4. 网络错误/超时返回明确错误(不重试,由调用方决定)
 *
 * 不依赖 engine-ai(避免循环依赖),由 plugin-ai 通过依赖注入消费。
 */

import type { CloudConfig } from './cloud-config.js';
import { DEFAULT_API_BASE_URL, DEFAULT_UPGRADE_URL } from './cloud-config.js';
import { cloudFetch } from './internal/cloud-fetch.js';

/** AI 请求超时(60s,AI 推理可能较慢) */
const AI_FETCH_TIMEOUT_MS = 60_000;

/** cloud-proxy 引擎名(用于 engine-ai 的 cloudProxyEngine 标识) */
export const CLOUD_PROXY_ENGINE_NAME = 'cloud-proxy' as const;

/** cloud-proxy 引擎版本(非 stub,F1 实装) */
export const CLOUD_PROXY_ENGINE_VERSION = '0.1.0';

/**
 * AI 调用错误(区分 401 / 402 / 网络错误,供 plugin-ai 上层包装)。
 */
export class CloudAiError extends Error {
  constructor(
    message: string,
    public readonly kind: 'auth' | 'billing' | 'network' | 'server' | 'unknown',
    public readonly statusCode?: number,
    public readonly upgradeUrl?: string
  ) {
    super(message);
    this.name = 'CloudAiError';
  }
}

/** generateWorkflow 参数(prompt 必填,contextAssetIds 可选) */
export interface GenerateWorkflowParams {
  prompt: string;
  contextAssetIds?: string[];
}

/** optimizeWorkflow 参数(workflow 必填,prompt 可选) */
export interface OptimizeWorkflowParams {
  workflow: unknown;
  prompt?: string;
}

/** diagnoseError 参数(error 必填,workflow/nodeId 可选) */
export interface DiagnoseErrorParams {
  error: { message: string; stack?: string; code?: string };
  workflow?: unknown;
  nodeId?: string;
}

/** diagnoseError 返回的诊断报告 */
export interface DiagnoseErrorReport {
  /** 根因分析(简短) */
  rootCause: string;
  /** 修复建议(可执行步骤) */
  remediation: string[];
  /** 相关节点 ID(如能定位) */
  suspectNodeId?: string;
  /** 严重程度 */
  severity: 'info' | 'warning' | 'error';
}

/**
 * Cloud AI Client。
 *
 * 不内置鉴权/计费(由 plugin-ai 上层在调用前完成 auth.verify() +
 * billing.checkCloudAiCall()),本类只负责 HTTP 转发与错误分类。
 *
 * 用法:
 * ```ts
 * const config = resolveCloudConfig();
 * const aiClient = new CloudAiClient(config);
 * const workflow = await aiClient.generateWorkflow({ prompt: 'resize image' });
 * ```
 */
export class CloudAiClient {
  private readonly apiBaseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly upgradeUrl: string;

  constructor(options: {
    apiKey?: string;
    apiBaseUrl?: string;
    upgradeUrl?: string;
  }) {
    this.apiKey = options.apiKey;
    this.apiBaseUrl = options.apiBaseUrl ?? DEFAULT_API_BASE_URL;
    this.upgradeUrl = options.upgradeUrl ?? DEFAULT_UPGRADE_URL;
  }

  /** 是否配置了 API Key(未配置时所有方法直接抛 auth 错误) */
  hasApiKey(): boolean {
    return !!this.apiKey;
  }

  /**
   * 自然语言 → Workflow Schema。
   * POST /v1/ai/generate-workflow
   */
  async generateWorkflow(
    params: GenerateWorkflowParams
  ): Promise<unknown> {
    if (!params.prompt || typeof params.prompt !== 'string') {
      throw new CloudAiError(
        'generateWorkflow requires a non-empty prompt',
        'unknown'
      );
    }
    return this.post('/v1/ai/generate-workflow', params);
  }

  /**
   * 优化已有 workflow。
   * POST /v1/ai/optimize-workflow
   */
  async optimizeWorkflow(
    params: OptimizeWorkflowParams
  ): Promise<unknown> {
    if (!params.workflow) {
      throw new CloudAiError(
        'optimizeWorkflow requires a workflow object',
        'unknown'
      );
    }
    return this.post('/v1/ai/optimize-workflow', params);
  }

  /**
   * 诊断 workflow 执行错误。
   * POST /v1/ai/diagnose-error
   */
  async diagnoseError(
    params: DiagnoseErrorParams
  ): Promise<DiagnoseErrorReport> {
    if (!params.error || !params.error.message) {
      throw new CloudAiError(
        'diagnoseError requires an error object with a message',
        'unknown'
      );
    }
    return this.post('/v1/ai/diagnose-error', params) as Promise<DiagnoseErrorReport>;
  }

  /** 通用 POST 转发(带超时 + 错误分类) */
  private async post(path: string, body: unknown): Promise<unknown> {
    if (!this.apiKey) {
      throw new CloudAiError(
        'Cloud AI requires an API key. Set LOKVIS_API_KEY or pass apiKey to enable cloud-proxy features.',
        'auth'
      );
    }

    let res: Response;
    try {
      res = await cloudFetch({
        apiBaseUrl: this.apiBaseUrl,
        apiKey: this.apiKey,
        path,
        method: 'POST',
        body,
        timeoutMs: AI_FETCH_TIMEOUT_MS,
        extraHeaders: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new CloudAiError(
          `Cloud AI request timed out after ${AI_FETCH_TIMEOUT_MS}ms`,
          'network'
        );
      }
      throw new CloudAiError(
        `Failed to reach cloud AI: ${err instanceof Error ? err.message : String(err)}`,
        'network'
      );
    }

    if (!res.ok) {
      // 分类错误:401 auth / 402 billing / 4xx client / 5xx server
      let errorBody: { error?: string; message?: string } | null = null;
      try {
        errorBody = (await res.json()) as { error?: string; message?: string };
      } catch {
        errorBody = null;
      }
      const message =
        errorBody?.error ?? errorBody?.message ?? res.statusText;

      if (res.status === 401) {
        throw new CloudAiError(
          `Cloud AI auth failed: ${message}`,
          'auth',
          res.status
        );
      }
      if (res.status === 402) {
        throw new CloudAiError(
          `Cloud AI billing issue: ${message}`,
          'billing',
          res.status,
          this.upgradeUrl
        );
      }
      if (res.status >= 500) {
        throw new CloudAiError(
          `Cloud AI server error (${res.status}): ${message}`,
          'server',
          res.status
        );
      }
      throw new CloudAiError(
        `Cloud AI request failed (${res.status}): ${message}`,
        'unknown',
        res.status
      );
    }

    return res.json();
  }
}

/**
 * 从 CloudConfig 构造 CloudAiClient。
 *
 * 便于 mcp-server / plugin-ai 上层一行注入:
 * ```ts
 * const config = resolveCloudConfig();
 * const aiClient = createAiClient(config);
 * ```
 */
export function createAiClient(config: CloudConfig): CloudAiClient {
  return new CloudAiClient({
    apiKey: config.apiKey,
    apiBaseUrl: config.apiBaseUrl,
    upgradeUrl: config.upgradeUrl,
  });
}
