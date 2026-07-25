/**
 * MCP server 核心接口与工厂。
 *
 * 使用 @modelcontextprotocol/sdk 的 low-level Server API 实现,
 * 通过 McpServerAdapter 适配到 LokvisMcpServer 接口。
 * tool handler 使用 raw JSON schema 定义 inputSchema(无需 Zod)。
 */

import type { LokvisRuntime, RuntimeConfig } from '@lokvis/sdk';
import type { McpManifest } from '@lokvis/schema';
import { createLokvis } from '@lokvis/sdk';
import { imageToolsPluginNode } from '@lokvis/plugin-image/node';
import { pdfToolsPluginNode } from '@lokvis/plugin-pdf/node';
import type { CloudConfig } from '@lokvis/cloud-bridge';
import { createAuthenticator, createBilling } from '@lokvis/cloud-bridge';
import type { CloudAuthenticator, CloudBilling } from '@lokvis/cloud-bridge';
import { McpServerAdapter } from './mcp-server-adapter.js';
import { NodeAssetStore } from './node-asset-store.js';
import { getImageToolRegistrations } from './tools/image.js';
import { getPdfToolRegistrations } from './tools/pdf.js';
import { getVideoToolRegistrations } from './tools/video.js';
import { getAudioToolRegistrations } from './tools/audio.js';
import { BrowserBridge } from './browser-bridge.js';
import { ToolRouter } from './router.js';
import type { ToolHandler } from './router.js';

/**
 * 能力域(决定注册哪些 tools)。
 * 当前 'image'(5 个 tool:resize/compress/convert/crop/watermark)、
 * 'pdf'(5 个 tool:merge/compress/split/rotate/watermark)已实装,
 * 均经 runtime.run 走完整 capability 系统;
 * 'video'(7 个 tool)/'audio'(4 个 tool)已注册 handler,但 engine 为 stub
 * (runtime.run 会返回 "capability not found",待 engine 实装后即可工作);
 * 'ai' 为占位(待对应 engine 实装后补 tool handler)。
 */
export type LokvisMcpDomain = 'image' | 'pdf' | 'video' | 'audio' | 'ai';

/** MCP tool 处理函数签名(由 tool 注册时提供) */
export type McpToolHandler = (params: Record<string, unknown>) => Promise<McpToolResult>;

/** MCP resource 处理函数签名 */
export type McpResourceHandler = (uri: string) => Promise<McpResourceResult>;

/** MCP prompt 处理函数签名 */
export type McpPromptHandler = (params: Record<string, unknown>) => Promise<McpPromptResult>;

/** MCP tool 调用结果 */
export interface McpToolResult {
  /** 内容块(text / image / resource) */
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; data: string; mimeType: string }
    | { type: 'resource'; uri: string }
  >;
  /** 是否为错误结果(AI 可据此调整策略) */
  isError?: boolean;
}

/** MCP resource 读取结果 */
export interface McpResourceResult {
  contents: Array<{
    uri: string;
    mimeType: string;
    text: string;
  }>;
}

/** MCP prompt 调用结果 */
export interface McpPromptResult {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: { type: 'text'; text: string };
  }>;
}

/**
 * MCP server 抽象接口。
 * 由实际 MCP SDK 适配器实现(@modelcontextprotocol/sdk 在 Phase 2 引入)。
 */
export interface LokvisMcpServer {
  /** 注册 tool */
  registerTool(
    name: string,
    description: string,
    inputSchema: object,
    handler: McpToolHandler
  ): void;
  /** 注册 resource */
  registerResource(
    uri: string,
    name: string,
    description: string,
    mimeType: string,
    handler: McpResourceHandler
  ): void;
  /** 注册 prompt 模板(可选 argumentsSchema 描述 AI 客户端应如何传参) */
  registerPrompt(
    name: string,
    description: string,
    handler: McpPromptHandler,
    /** prompt 参数的 JSON Schema(可选,见 MCP 规范 §3.5.4) */
    argumentsSchema?: object
  ): void;
  /** 启动 server(阻塞,直到收到关闭信号) */
  start(): Promise<void>;
  /** 关闭 server */
  close(): Promise<void>;
}

/**
 * MCP 传输层抽象。
 * stdio(桌面客户端)与 SSE(Web 客户端)两种实现。
 */
export interface LokvisMcpTransport {
  /** 启动传输,绑定到 server 的请求处理 */
  start(handler: (request: unknown) => Promise<unknown>): Promise<void>;
  /** 关闭传输 */
  close(): Promise<void>;
}

/**
 * createLokvisMcpServer 配置。
 */
export interface LokvisMcpOptions {
  /** 工作目录:资产读写根路径(Node 模式) */
  workdir?: string;
  /** 启用的能力域,默认 ['image'] */
  domains?: LokvisMcpDomain[];
  /** 运行模式 */
  mode?: 'stdio' | 'sse';
  /** SSE 模式的端口(仅 mode='sse' 时生效,默认 3001) */
  port?: number;
  /**
   * BrowserBridge 监听端口(混合架构 E)。
   * 提供时启动 WebSocket server,浏览器可连接并接管 tool 调用(完整能力);
   * 未提供时仅走 Node engine 降级路径(基础能力)。
   */
  bridgePort?: number;
  /** Runtime 配置(透传给 createLokvis) */
  runtime?: RuntimeConfig;
  /**
   * Cloud 配置(鉴权 + 计费),由 @lokvis/cloud-bridge 提供。
   * 未提供时 cloud AI tool 不可用(仅本地 tool 运行)。
   * 由 resolveCloudConfig() 从 env 读取后注入。
   */
  cloud?: CloudConfig;
  /** 注入自定义 transport 工厂(测试用),默认创建 StdioServerTransport */
  transportFactory?: () => import('@modelcontextprotocol/sdk/shared/transport.js').Transport;
}

/**
 * 创建 Lokvis MCP server。
 *
 * 流程:
 * 1. 创建 NodeAssetStore(如果 workdir 提供)并注入 RuntimeConfig
 * 2. 创建 Lokvis Runtime(通过 createLokvis)
 * 3. 安装 imageToolsPluginNode / pdfToolsPluginNode(按 domains,注册 capabilities)
 * 4. 创建 McpServerAdapter(包装 @modelcontextprotocol/sdk Server)
 * 5. 按 domains 收集 tool registrations,构造 toolHandlers Map + ToolRouter
 * 6. 注册 tools 到 server(handler 经 ToolRouter 路由:浏览器优先 → Node 降级)
 * 7. 返回 server + runtime + manifest(transport 启动由调用方触发)
 *
 * tool 命名遵循 manifest 约定:`lokvis_${capability.replace(/\./g, '_')}`
 */
export async function createLokvisMcpServer(
  options: LokvisMcpOptions = {}
): Promise<{
  /** MCP server 实例(已注册 tools,但尚未启动 transport) */
  server: McpServerAdapter;
  /** 已创建的 Lokvis Runtime */
  runtime: LokvisRuntime;
  /** MCP manifest(描述当前可暴露的能力) */
  manifest: McpManifest;
  /** BrowserBridge(若 bridgePort 提供,已启动;否则为未启动实例) */
  bridge: BrowserBridge;
  /** ToolRouter(image tool 调用经此路由:浏览器优先 → Node 降级) */
  router: ToolRouter;
  /** Cloud 鉴权器(若 cloud 配置提供,否则 undefined) */
  authenticator?: CloudAuthenticator;
  /** Cloud 计费器(若 cloud 配置提供,否则 undefined) */
  billing?: CloudBilling;
}> {
  const {
    workdir,
    domains = ['image'],
    runtime: runtimeConfig,
    transportFactory,
    bridgePort,
    cloud,
  } = options;

  // Cloud 鉴权/计费:若提供 cloud 配置,创建 authenticator + billing
  // (Phase 2 cloud AI tool 接入时由 tool handler 消费 billing;
  //  cli.ts 可使用返回的 authenticator 做 API Key 验证)
  const authenticator = cloud ? createAuthenticator(cloud) : undefined;
  const billing = cloud ? createBilling(cloud) : undefined;

  // 如果 workdir 提供,创建 NodeAssetStore 注入 runtime
  let resolvedRuntimeConfig: RuntimeConfig = { ...runtimeConfig };
  if (workdir) {
    const assetStore = new NodeAssetStore(workdir);
    await assetStore.init();
    // Node 模式不启用 OPFS/IndexedDB(浏览器专属)
    resolvedRuntimeConfig = {
      ...resolvedRuntimeConfig,
      enableOpfs: false,
      enableIndexedDB: false,
      assetStore,
    };
  }

  const runtime = await createLokvis(resolvedRuntimeConfig);

  // TD-1.1:按 domains 安装 Node 端 plugin,注册 capabilities,
  // 让 runtime.run(workflow) 能经 CapabilityRegistry 解析到真实 engine 实现。
  // 仅安装 domains 内的 plugin(避免无用依赖加载)。
  if (domains.includes('image')) {
    await runtime.installPlugin(await imageToolsPluginNode());
  }
  if (domains.includes('pdf')) {
    await runtime.installPlugin(await pdfToolsPluginNode());
  }

  const manifest = runtime.toMcpManifest();

  // 创建 MCP server adapter
  const server = new McpServerAdapter(
    manifest.serverName,
    manifest.version,
    transportFactory
  );

  // BrowserBridge(混合架构 E):若提供 bridgePort 则启动,等待浏览器连接
  const bridge = new BrowserBridge({ port: bridgePort ?? 0 });
  if (bridgePort !== undefined) {
    await bridge.start();
  }

  // 收集 tool registration:image / pdf handler 均接收 runtime(走 capability 系统,
  // 经 runtime.run + CapabilityRegistry 解析到 engine 实现)。
  const imageRegistrations = domains.includes('image')
    ? getImageToolRegistrations(runtime)
    : [];
  const pdfRegistrations = domains.includes('pdf')
    ? getPdfToolRegistrations(runtime)
    : [];
  // video/audio engine 尚未实装(stub),tools 注册后 runtime.run 会返回
  // "capability not found" 错误。tool handler 结构正确,待 engine 实装后即可工作。
  const videoRegistrations = domains.includes('video')
    ? getVideoToolRegistrations(runtime)
    : [];
  const audioRegistrations = domains.includes('audio')
    ? getAudioToolRegistrations(runtime)
    : [];
  const allRegistrations = [
    ...imageRegistrations,
    ...pdfRegistrations,
    ...videoRegistrations,
    ...audioRegistrations,
  ];

  // 构造 toolHandlers Map:tool name → handler(Node 降级路径直接调用)
  // tool.handler 类型为 (params) => Promise<McpToolResult>,可赋值给 ToolHandler
  // (返回类型协变:Promise<McpToolResult> → Promise<unknown>),无需断言
  const toolHandlers = new Map<string, ToolHandler>();
  for (const tool of allRegistrations) {
    toolHandlers.set(tool.name, tool.handler);
  }

  // ToolRouter:浏览器优先(完整能力)→ Node 降级(直接调 tool handler)
  const router = new ToolRouter(bridge, toolHandlers);

  // 按 domains 注册 tools(handler 经 ToolRouter 路由)
  for (const tool of allRegistrations) {
    server.registerTool(
      tool.name,
      tool.description,
      tool.inputSchema,
      async (params) => {
        const result = await router.execute(tool.name, params);
        return result as McpToolResult;
      }
    );
  }

  return { server, runtime, manifest, bridge, router, authenticator, billing };
}
