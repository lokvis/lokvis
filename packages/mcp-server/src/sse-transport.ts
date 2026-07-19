/**
 * SSE 传输:把 MCP Server 暴露给 Web 客户端(M2.3,Phase 3 M1 硬化)。
 *
 * 基于 Node http.Server + @modelcontextprotocol/sdk 的 SSEServerTransport:
 *   GET  /sse        — 建立 SSE 长连接,首个事件告知客户端 POST 端点(含 sessionId)
 *   POST /messages   — 客户端 → server 的 JSON-RPC 请求(按 sessionId 路由)
 *
 * 生产级能力(Phase 3 M1):
 *   - 多会话并发(sessions Map + server factory,默认 maxConnections=10)
 *   - CORS 配置(corsOrigins 白名单 + OPTIONS 预检)
 *   - SSE 鉴权(Authorization: Bearer <token>)
 *   - 心跳保活(setInterval 写入 `: ping` 注释行)
 *   - 客户端断开检测(res.on('close') 清理 session)
 *   - 结构化日志(logEvent JSON 输出)
 *
 * 参考:docs/reports/20260712-task-plan.md §M2.3 + Phase 3 M1
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
  /** 最大并发会话数(默认 10,超限返回 503) */
  maxConnections?: number;
  /** 允许跨域的 Origin 白名单(默认 [] 不允许跨域;['*'] 允许所有) */
  corsOrigins?: string[];
  /** SSE 鉴权 token,客户端需携带 `Authorization: Bearer <token>`(未设置时跳过鉴权) */
  authToken?: string;
  /** 心跳间隔毫秒(默认 15000,设 0 禁用) */
  heartbeatIntervalMs?: number;
}

/** 单个 SSE 会话的运行时状态 */
interface SessionEntry {
  transport: SSEServerTransport;
  server: Server;
  heartbeat: ReturnType<typeof setInterval> | null;
}

type LogLevel = 'info' | 'warn' | 'error';

/**
 * 结构化日志:输出单行 JSON,便于采集与解析。
 * 与现有 `[lokvis-mcp]` 前缀日志共存(close 失败仍用 console.warn)。
 */
function logEvent(level: LogLevel, msg: string, fields?: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields }));
}

/**
 * SSE MCP Server:在指定端口启动 HTTP server,承载多个 SSE 会话。
 *
 * 构造参数接受单个 Server 或 Server 工厂:
 *   - 单个 Server:仅支持单会话(SDK Server 一次只能 connect 一个 transport)
 *   - Server 工厂:支持多会话并发(每个连接创建独立 Server 实例)
 *
 * @example
 * ```ts
 * const sse = new LokvisSseServer(() => makeServer(), { port: 3001 });
 * await sse.start();
 * // 客户端连 http://localhost:3001/sse
 * ```
 */
export class LokvisSseServer {
  private httpServer: http.Server | null = null;
  private readonly sessions = new Map<string, SessionEntry>();
  private resolvedPort: number | undefined;

  constructor(
    private readonly serverOrFactory: Server | (() => Server),
    private readonly options: LokvisSseServerOptions
  ) {}

  /** 启动 HTTP server 并监听 */
  async start(): Promise<void> {
    const { port, messageEndpoint = '/messages', localhostOnly = true } = this.options;

    this.httpServer = http.createServer(async (req, res) => {
      await this.handleRequest(req, res, messageEndpoint);
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
    return this.sessions.size > 0;
  }

  /** 当前活跃会话数 */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /** 关闭 HTTP server 与所有活跃会话 */
  async close(): Promise<void> {
    // 先取出所有 session 再清空 Map,避免 res.on('close') 回调中的 cleanup 与迭代竞争
    const entries = Array.from(this.sessions.values());
    this.sessions.clear();

    for (const entry of entries) {
      if (entry.heartbeat) {
        clearInterval(entry.heartbeat);
        entry.heartbeat = null;
      }
      await entry.transport.close().catch((err) => {
        console.warn('[lokvis-mcp] SSE transport close failed:', err);
      });
      await entry.server.close().catch((err) => {
        console.warn('[lokvis-mcp] MCP server close failed:', err);
      });
    }

    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
      this.httpServer = null;
    }
    logEvent('info', 'shutdown');
  }

  // ─── 内部:请求路由 ────────────────────────────────────

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    messageEndpoint: string
  ): Promise<void> {
    if (!req.url) {
      res.statusCode = 400;
      res.end();
      return;
    }
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;
    const origin = req.headers.origin;

    // 注入 CORS 响应头(仅当 corsOrigins 非空时)
    this.applyCorsHeaders(res, origin);

    // OPTIONS 预检请求
    if (req.method === 'OPTIONS') {
      if (origin && !this.isOriginAllowed(origin)) {
        logEvent('warn', 'cors_rejected', { origin, path: pathname });
        res.statusCode = 403;
        res.end();
        return;
      }
      res.statusCode = 204;
      res.end();
      return;
    }

    // SSE / messages 端点的 CORS 与鉴权校验
    const isSseEndpoint = pathname === '/sse' || pathname === messageEndpoint;
    if (isSseEndpoint && origin && !this.isOriginAllowed(origin)) {
      logEvent('warn', 'cors_rejected', { origin, path: pathname });
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }
    if (isSseEndpoint && !this.checkAuth(req)) {
      logEvent('warn', 'auth_failed', { path: pathname });
      res.statusCode = 401;
      res.setHeader('WWW-Authenticate', 'Bearer');
      res.end('Unauthorized');
      return;
    }

    if (req.method === 'GET' && pathname === '/sse') {
      await this.handleSseConnect(res);
      return;
    }

    if (req.method === 'POST' && pathname === messageEndpoint) {
      await this.handlePostMessage(req, res, url);
      return;
    }

    res.statusCode = 404;
    res.end();
  }

  /** 处理 GET /sse:创建新会话 */
  private async handleSseConnect(res: http.ServerResponse): Promise<void> {
    const messageEndpoint = this.options.messageEndpoint ?? '/messages';

    // 并发上限校验
    if (this.sessions.size >= this.maxConnections) {
      logEvent('warn', 'max_connections_exceeded', {
        count: this.sessions.size,
        max: this.maxConnections,
      });
      res.statusCode = 503;
      res.end('Max connections exceeded');
      return;
    }

    // 每个会话创建独立 Server 实例(SDK Server 一次只能 connect 一个 transport)
    const server = this.createServer();
    const transport = new SSEServerTransport(messageEndpoint, res);
    const sessionId = transport.sessionId;

    const entry: SessionEntry = {
      transport,
      server,
      heartbeat: null,
    };

    // 清理函数:从 Map 移除并停止心跳(幂等,可被多次调用)
    const cleanup = (): void => {
      if (entry.heartbeat) {
        clearInterval(entry.heartbeat);
        entry.heartbeat = null;
      }
      const existed = this.sessions.delete(sessionId);
      if (existed) {
        logEvent('info', 'client_disconnected', { sessionId });
      }
    };

    // 客户端断开检测:res.on('close') 触发时清理 session
    // SDK 在 transport.start() 内部也会注册 res.on('close') 处理 transport 自身清理,
    // 我们的监听器先注册先触发,仅负责本地 Map 与心跳清理。
    res.on('close', () => {
      cleanup();
    });

    try {
      this.sessions.set(sessionId, entry);
      await server.connect(transport);

      // 心跳保活:连接成功后启动定时器,定期写入 SSE 注释行
      const heartbeatMs = this.heartbeatIntervalMs;
      if (heartbeatMs > 0) {
        entry.heartbeat = setInterval(() => {
          if (res.writableEnded || res.destroyed) {
            cleanup();
            return;
          }
          try {
            res.write(': ping\n\n');
          } catch {
            cleanup();
          }
        }, heartbeatMs);
      }

      logEvent('info', 'client_connected', {
        sessionId,
        count: this.sessions.size,
      });
    } catch (err) {
      cleanup();
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Failed to establish session');
      }
      logEvent('error', 'connect_failed', {
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** 处理 POST /messages:按 sessionId 路由到对应 transport */
  private async handlePostMessage(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL
  ): Promise<void> {
    // sessionId 优先从 query param 读取(SDK 客户端默认放在这里),其次从 header
    const sessionId =
      url.searchParams.get('sessionId') ??
      (req.headers['x-session-id'] as string | undefined);

    if (!sessionId) {
      res.statusCode = 400;
      res.end('Missing sessionId');
      return;
    }

    const entry = this.sessions.get(sessionId);
    if (!entry) {
      res.statusCode = 400;
      res.end('No active SSE session');
      return;
    }

    logEvent('info', 'message_received', { sessionId });
    await entry.transport.handlePostMessage(req, res);
    logEvent('info', 'message_sent', { sessionId });
  }

  // ─── 内部:CORS / 鉴权 ─────────────────────────────────

  /** 注入 CORS 响应头(corsOrigins 为空时不注入任何头,浏览器默认拒绝跨域) */
  private applyCorsHeaders(res: http.ServerResponse, origin: string | undefined): void {
    if (this.corsOrigins.length === 0) return;
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Id');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (this.corsOrigins.includes('*')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (origin && this.corsOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  }

  /** 判断 Origin 是否在白名单内(corsOrigins 为空时一律拒绝跨域) */
  private isOriginAllowed(origin: string): boolean {
    if (this.corsOrigins.length === 0) return false;
    if (this.corsOrigins.includes('*')) return true;
    return this.corsOrigins.includes(origin);
  }

  /** 校验 Authorization: Bearer <token>(未配置 authToken 时一律放行) */
  private checkAuth(req: http.IncomingMessage): boolean {
    if (!this.authToken) return true;
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;
    const match = /^Bearer\s+(.+)$/.exec(authHeader);
    if (!match) return false;
    return match[1] === this.authToken;
  }

  // ─── 内部:选项访问器(带默认值) ──────────────────────

  private createServer(): Server {
    return typeof this.serverOrFactory === 'function'
      ? this.serverOrFactory()
      : this.serverOrFactory;
  }

  private get maxConnections(): number {
    return this.options.maxConnections ?? 10;
  }

  private get heartbeatIntervalMs(): number {
    return this.options.heartbeatIntervalMs ?? 15000;
  }

  private get authToken(): string | undefined {
    return this.options.authToken;
  }

  private get corsOrigins(): string[] {
    return this.options.corsOrigins ?? [];
  }
}
