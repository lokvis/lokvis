/**
 * SSE 传输:把 MCP Server 暴露给 Web 客户端(M2.3)。
 *
 * 基于 Node http.Server + @modelcontextprotocol/sdk 的 SSEServerTransport:
 *   GET  /sse        — 建立 SSE 长连接,首个事件告知客户端 POST 端点
 *   POST /messages   — 客户端 → server 的 JSON-RPC 请求
 *
 * 当前为单会话实现(M2.1 单进程场景足够)。首个客户端连接后即占用,
 * 断开后允许新客户端连接。多会话并发留待 M2.4+。
 *
 * 参考:docs/reports/20260712-task-plan.md §M2.3
 */

import http from 'node:http';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

export interface LokvisSseServerOptions {
  /** 监听端口,传 0 由 OS 分配(测试用) */
  port: number;
  /** 客户端 POST 消息的端点(默认 '/messages') */
  messageEndpoint?: string;
  /** 仅绑定本机(默认 true,生产环境建议保持) */
  localhostOnly?: boolean;
}

/**
 * SSE MCP Server:在指定端口启动 HTTP server,承载单个 SSE 会话。
 *
 * @example
 * ```ts
 * const sse = new LokvisSseServer(server, { port: 3001 });
 * await sse.start();
 * // 客户端连 http://localhost:3001/sse
 * ```
 */
export class LokvisSseServer {
  private httpServer: http.Server | null = null;
  private transport: SSEServerTransport | null = null;
  private resolvedPort: number | undefined;

  constructor(
    private readonly server: Server,
    private readonly options: LokvisSseServerOptions
  ) {}

  /** 启动 HTTP server 并监听 */
  async start(): Promise<void> {
    const { port, messageEndpoint = '/messages', localhostOnly = true } = this.options;
    this.httpServer = http.createServer(async (req, res) => {
      if (!req.url) {
        res.statusCode = 400;
        res.end();
        return;
      }
      const url = new URL(req.url, 'http://localhost');
      const pathname = url.pathname;

      if (req.method === 'GET' && pathname === '/sse') {
        // 复用单会话:旧会话仍在则先关闭
        if (this.transport) {
          await this.transport.close().catch(() => {});
          this.transport = null;
        }
        this.transport = new SSEServerTransport(messageEndpoint, res);
        await this.server.connect(this.transport);
        return;
      }

      if (req.method === 'POST' && pathname === messageEndpoint) {
        if (!this.transport) {
          res.statusCode = 400;
          res.end('No active SSE session');
          return;
        }
        await this.transport.handlePostMessage(req, res);
        return;
      }

      res.statusCode = 404;
      res.end();
    });

    const host = localhostOnly ? '127.0.0.1' : '0.0.0.0';
    await new Promise<void>((resolve) => {
      this.httpServer!.listen(port, host, () => {
        const addr = this.httpServer!.address();
        this.resolvedPort =
          addr && typeof addr === 'object' ? addr.port : port;
        resolve();
      });
    });
  }

  /** 实际监听端口(start 后可用) */
  getPort(): number | undefined {
    return this.resolvedPort;
  }

  /** 当前是否有活跃 SSE 会话 */
  hasActiveSession(): boolean {
    return this.transport !== null;
  }

  /** 关闭 HTTP server 与活跃会话 */
  async close(): Promise<void> {
    if (this.transport) {
      await this.transport.close().catch(() => {});
      this.transport = null;
    }
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
      this.httpServer = null;
    }
  }
}
