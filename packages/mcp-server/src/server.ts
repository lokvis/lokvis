/**
 * MCP server 核心接口与工厂。
 *
 * 注意:本文件定义抽象层,不直接依赖 @modelcontextprotocol/sdk。
 * 实际 MCP server 启动逻辑在 Phase 2 W1-W2 实现时引入 SDK。
 * 这样骨架可在无 MCP SDK 依赖的情况下 typecheck 通过。
 */

import type { LokvisRuntime, RuntimeConfig } from '@lokvis/sdk';
import type { McpManifest } from '@lokvis/schema';
import { createLokvis } from '@lokvis/sdk';

/**
 * 能力域(决定注册哪些 tools)。
 * 当前仅 'image' 在 Phase 2 W5-W6 实现;其余为占位。
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
  /** 是否启用 workflow 执行 tool(lokvis_run_workflow) */
  enableWorkflow?: boolean;
  /** 运行模式 */
  mode?: 'stdio' | 'sse';
  /** SSE 模式的端口(仅 mode='sse' 时生效,默认 3001) */
  port?: number;
  /** Runtime 配置(透传给 createLokvis) */
  runtime?: RuntimeConfig;
}

/**
 * 创建 Lokvis MCP server。
 *
 * 流程:
 * 1. 创建 Lokvis Runtime(通过 createLokvis)
 * 2. 创建 MCP server 实例(实际 SDK 适配)
 * 3. 按 domains 注册 image / pdf / workflow 等 tools
 * 4. 注册 capabilities / workflows resource
 * 5. 注册 prompt 模板(optimize-for-web 等)
 * 6. 启动传输(stdio / SSE)
 *
 * 注:当前为 Phase 2 骨架,仅返回 Runtime 与 manifest,不实际启动 server。
 * tool 注册与 transport 启动在 Phase 2 W5-W10 实现。
 */
export async function createLokvisMcpServer(
  options: LokvisMcpOptions = {}
): Promise<{
  /** MCP server 实例(Phase 2 W1-W2 实现) */
  server: LokvisMcpServer | null;
  /** 已创建的 Lokvis Runtime */
  runtime: LokvisRuntime;
  /** MCP manifest(描述当前可暴露的能力) */
  manifest: McpManifest;
}> {
  // TODO Phase 2: 用 options.workdir 创建 NodeAssetStore 注入 runtime,
  //   使 Node 降级模式可读写本地文件(当前 runtime 使用默认内存/OPFS store,
  //   workdir 仅在 CLI 层接收,尚未真正生效)。
  const runtime = await createLokvis(options.runtime);
  const manifest = runtime.toMcpManifest();

  // Phase 2 W1-W2:创建实际 MCP server 并注册 tools
  // const server = new McpServer({ name: 'lokvis', version: '0.1.0' });
  // registerImageTools(server, runtime);
  // registerWorkflowTools(server, runtime);
  const server = null;

  return { server, runtime, manifest };
}
