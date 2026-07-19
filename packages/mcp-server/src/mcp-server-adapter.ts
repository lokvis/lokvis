/**
 * McpServerAdapter:将 @modelcontextprotocol/sdk 的 low-level Server API
 * 适配到 LokvisMcpServer 接口。
 *
 * 使用 low-level Server API(setRequestHandler)而非 high-level McpServer API,
 * 因为后者要求 Zod schema 定义 inputSchema,而我们的 tool handlers 使用
 * raw JSON schema(与 manifest 约定一致)。
 *
 * 注册流程:
 * 1. registerTool() 将 tool 定义存入内部 Map
 * 2. start() 时设置 ListToolsRequest / CallToolRequest handler
 * 3. handler 从 Map 查找 tool 并调用其 handler
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type {
  LokvisMcpServer,
  McpToolHandler,
  McpResourceHandler,
  McpPromptHandler,
} from './server.js';
import { LokvisSseServer } from './sse-transport.js';
import type { LokvisSseServerOptions } from './sse-transport.js';

/** 内部 tool 注册记录 */
interface RegisteredTool {
  name: string;
  description: string;
  inputSchema: object;
  handler: McpToolHandler;
}

/** 内部 resource 注册记录 */
interface RegisteredResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  handler: McpResourceHandler;
}

/** 内部 prompt 注册记录 */
interface RegisteredPrompt {
  name: string;
  description: string;
  handler: McpPromptHandler;
  argumentsSchema?: object;
}

/**
 * MCP Server 适配器,实现 LokvisMcpServer 接口。
 *
 * @example
 * ```ts
 * const server = new McpServerAdapter('lokvis', '0.1.0');
 * server.registerTool('lokvis_image_resize', 'Resize image', schema, handler);
 * await server.start(); // 阻塞,通过 stdio 通信
 * ```
 */
export class McpServerAdapter implements LokvisMcpServer {
  private readonly server: Server;
  private transport: Transport | null = null;
  private readonly tools = new Map<string, RegisteredTool>();
  private readonly resources = new Map<string, RegisteredResource>();
  private readonly prompts = new Map<string, RegisteredPrompt>();

  constructor(
    private readonly name: string,
    private readonly version: string,
    /** 注入自定义 transport(测试用),默认创建 StdioServerTransport */
    private readonly transportFactory?: () => Transport
  ) {
    this.server = this.createServerInstance();
  }

  /**
   * 创建一个全新的 Server 实例并挂载所有已注册的 handler。
   *
   * 用于 SSE 多会话场景:每个 SSE 连接需要一个独立的 Server 实例
   * (SDK Server 一次只能 connect 一个 transport)。
   * handler 闭包捕获 this,因此读取的是当前最新的 tools/resources/prompts Map。
   */
  private createServerInstance(): Server {
    const server = new Server(
      { name: this.name, version: this.version },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );
    this.attachHandlers(server);
    return server;
  }

  /** 在指定 Server 实例上挂载 MCP 请求 handler(tool/resource/prompt 的 list 和 call) */
  private attachHandlers(server: Server): void {
    // ─── Tools ──────────────────────────────────────────
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: Array.from(this.tools.values()).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request): Promise<any> => {
      const { name, arguments: args } = request.params;
      const tool = this.tools.get(name);
      if (!tool) {
        return {
          content: [
            { type: 'text' as const, text: `Tool "${name}" not found` },
          ],
          isError: true,
        };
      }
      try {
        return await tool.handler(args ?? {});
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Tool execution error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    });

    // ─── Resources ──────────────────────────────────────
    server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: Array.from(this.resources.values()).map((r) => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
      })),
    }));

    server.setRequestHandler(ReadResourceRequestSchema, async (request): Promise<any> => {
      const { uri } = request.params;
      const resource = this.resources.get(uri);
      if (!resource) {
        throw new Error(`Resource "${uri}" not found`);
      }
      return resource.handler(uri);
    });

    // ─── Prompts ────────────────────────────────────────
    server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: Array.from(this.prompts.values()).map((p) => ({
        name: p.name,
        description: p.description,
        arguments: p.argumentsSchema
          ? Object.entries(p.argumentsSchema).map(([key, schema]) => ({
              name: key,
              ...(schema as { description?: string }).description
                ? { description: (schema as { description: string }).description }
                : {},
              required: true,
            }))
          : [],
      })),
    }));

    server.setRequestHandler(GetPromptRequestSchema, async (request): Promise<any> => {
      const { name } = request.params;
      const prompt = this.prompts.get(name);
      if (!prompt) {
        throw new Error(`Prompt "${name}" not found`);
      }
      return prompt.handler(request.params.arguments ?? {});
    });
  }

  registerTool(
    name: string,
    description: string,
    inputSchema: object,
    handler: McpToolHandler
  ): void {
    this.tools.set(name, { name, description, inputSchema, handler });
  }

  registerResource(
    uri: string,
    name: string,
    description: string,
    mimeType: string,
    handler: McpResourceHandler
  ): void {
    this.resources.set(uri, { uri, name, description, mimeType, handler });
  }

  registerPrompt(
    name: string,
    description: string,
    handler: McpPromptHandler,
    argumentsSchema?: object
  ): void {
    this.prompts.set(name, { name, description, handler, argumentsSchema });
  }

  /** 获取已注册的 tool 名称列表(测试/调试用) */
  getRegisteredToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 启动 server:创建 transport 并连接。
   *
   * stdio 模式下,此方法会阻塞直到 transport 关闭(stdin EOF)。
   */
  async start(): Promise<void> {
    this.transport = this.transportFactory
      ? this.transportFactory()
      : new StdioServerTransport();
    await this.server.connect(this.transport);
  }

  /**
   * 以 SSE 模式启动:在指定端口监听 HTTP,暴露 /sse + /messages 端点。
   *
   * 与 start()(stdio 阻塞)互斥;调用方选择其中一种。
   * 返回 LokvisSseServer 供调用方 close()。
   *
   * 传入 server 工厂以支持多会话并发:每个 SSE 连接创建独立 Server 实例。
   * options 透传 maxConnections/corsOrigins/authToken/heartbeatIntervalMs。
   */
  async startSse(
    port: number,
    options?: Omit<LokvisSseServerOptions, 'port'>
  ): Promise<LokvisSseServer> {
    const sse = new LokvisSseServer(
      () => this.createServerInstance(),
      { port, ...options }
    );
    await sse.start();
    return sse;
  }

  async close(): Promise<void> {
    await this.server.close();
  }
}
