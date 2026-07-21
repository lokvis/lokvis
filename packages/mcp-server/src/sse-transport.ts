/**
 * SSE 传输:把 MCP Server 暴露给 Web 客户端(M2.3,Phase 3 M1 production-ready)。
 *
 * 基于 Node http.Server + @modelcontextprotocol/sdk 的 SSEServerTransport:
 *   GET  /sse        — 建立 SSE 长连接,首个事件告知客户端 POST 端点(含 sessionId)
 *   POST /messages   — 客户端 → server 的 JSON-RPC 请求(按 sessionId 路由)
 *   GET  /health     — 健康检查端点(供 LB / 监控探针),返回 activeSessions / maxConnections
 *
 * 生产级能力(Phase 3 M1 production-ready):
 *   - 多会话并发(sessions Map + server factory,默认 maxConnections=10)
 *   - CORS 配置(corsOrigins 白名单 + OPTIONS 预检)
 *   - SSE 鉴权(Authorization: Bearer <token>,timingSafeEqual 防时序攻击)
 *   - 心跳保活(setInterval 写入 `: ping` 注释行)
 *   - 客户端断开检测(res.on('close') 清理 session)
 *   - POST body 大小限制(默认 1MB,防 DoS)
 *   - /health 健康检查端点(供 LB / k8s readinessProbe)
 *   - close() 超时保护(默认 5s,防卡死)
 *   - 结构化日志(logEvent JSON 输出)
 *
 * 参考:docs/reports/20260712-task-plan.md §M2.3 + Phase 3 M1
 */

import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

export interface LokvisSseServerOptions {
  /** 监听端口,传 0 由 OS 分配(测试用) */
  port: number;
  /** 客户端 POST 消息的端点(默认 '/messages') */
  messageEndpoint?: string;
  /** 仅绑定本机(默认 true,生产环境建议保持,由反向代理处理外部流量) */
  localhostOnly?: boolean;
  /** 最大并发会话数(默认 10,超限返回 503) */
  maxConnections?: number;
  /** 允许跨域的 Origin 白名单(默认 [] 不允许跨域;['*'] 允许所有) */
  corsOrigins?: string[];
  /** SSE 鉴权 token,客户端需携带 `Authorization: Bearer <token>`(未设置时跳过鉴权) */
  authToken?: string;
  /** 心跳间隔毫秒(默认 15000,设 0 禁用) */
  heartbeatIntervalMs?: number;
  /** POST body 最大字节数(默认 1MB,超出返回 413 Payload Too Large) */
  maxRequestBytes?: number;
  /** close() 超时毫秒(默认 5000,超时后强制 destroy 仍卡住的连接) */
  closeTimeoutMs?: number;
}

/** 单个 SSE 会话的运行时状态 */
interface SessionEntry {
  transport: SSEServerTransport;
  server: Server;
  heartbeat: ReturnType<typeof setInterval> | null;
  /** 会话建立时间(用于 /health 统计) */
  startedAt: number;
  /** 最近一次 POST 消息时间(用于 /health 统计与 idle 检测) */
  lastActivityAt: number;
}

/** /health 端点返回的统计信息(供 LB / 监控探针消费) */
export interface SseHealthStats {
  status: 'ok' | 'shutting_down';
  activeSessions: number;
  maxConnections: number;
  /** server 启动以来的毫秒数 */
  uptimeMs: number;
}

type LogLevel = 'info' | 'warn' | 'error';

/** 默认 POST body 大小上限:1MB(JSON-RPC 请求通常 <10KB,1MB 留足余量) */
const DEFAULT_MAX_REQUEST_BYTES = 1024 * 1024;
/** close() 默认超时:5s(超时后强制 destroy,避免卡死) */
const DEFAULT_CLOSE_TIMEOUT_MS = 5000;

/**
 * 结构化日志:输出单行 JSON,便于采集与解析。
 * 与现有 `[lokvis-mcp]` 前缀日志共存(close 失败仍用 console.warn)。
 */
function logEvent(level: LogLevel, msg: string, fields?: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields }));
}

/**
 * 常量时间字符串比较(防时序攻击)。
 *
 * `===` 在字符不匹配时立即返回,泄露 token 长度 / 前缀信息;
 * timingSafeEqual 要求两 Buffer 等长,故先做长度校验(长度本身不算敏感),
 * 再对内容做常量时间比较。
 */
function safeEqualToken(received: string, expected: string): boolean {
  const a = Buffer.from(received, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  // timingSafeEqual 要求等长 Buffer,上面已保证;返回 0 / 1
  return timingSafeEqual(a, b);
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
  /** server 启动时间戳(用于 /health uptimeMs 计算) */
  private startedAt: number | null = null;
  /** close() 进行中标记(用于 /health 状态) */
  private shuttingDown = false;

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
        this.startedAt = Date.now();
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

  /**
   * 当前活跃会话 ID 列表(供监控 / 调试 / 测试用)。
   *
   * 返回副本,调用方修改不影响内部状态。
   * 不在 /health 端点暴露(避免泄露会话标识)。
   */
  getSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /** 返回 /health 统计信息(供程序化访问,与 GET /health 端点一致) */
  getStats(): SseHealthStats {
    return {
      status: this.shuttingDown ? 'shutting_down' : 'ok',
      activeSessions: this.sessions.size,
      maxConnections: this.maxConnections,
      uptimeMs: this.startedAt ? Date.now() - this.startedAt : 0,
    };
  }

  /**
   * 关闭 HTTP server 与所有活跃会话。
   *
   * 超时保护:若 closeTimeoutMs 内仍有 session/transport 未关闭,
   * 强制 destroy HTTP server,避免残留连接卡住进程退出。
   */
  async close(): Promise<void> {
    this.shuttingDown = true;

    // 先取出所有 session 再清空 Map,避免 res.on('close') 回调中的 cleanup 与迭代竞争
    const entries = Array.from(this.sessions.values());
    this.sessions.clear();

    const closeAll = async (): Promise<void> => {
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
    };

    const timeoutMs = this.closeTimeoutMs;
    await Promise.race([
      closeAll(),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);

    // 超时兜底:若 httpServer 仍存在,强制 destroy(立即关闭所有连接)
    if (this.httpServer) {
      this.httpServer.closeAllConnections?.();
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
    // URL 解析防护:极少数情况下 req.url 可能为非法字符串
    let url: URL;
    try {
      url = new URL(req.url ?? '', 'http://localhost');
    } catch {
      res.statusCode = 400;
      res.end('Bad request URL');
      return;
    }
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

    // GET /health — 健康检查(LB / k8s readinessProbe 用,无需鉴权)
    if (req.method === 'GET' && pathname === '/health') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(this.getStats()));
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
    const now = Date.now();

    const entry: SessionEntry = {
      transport,
      server,
      heartbeat: null,
      startedAt: now,
      lastActivityAt: now,
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

    // POST body 大小限制:读取 Content-Length 预检 + 流式累计
    // 防 DoS:恶意客户端发送超大 body 可耗尽内存
    const maxBytes = this.maxRequestBytes;
    const contentLength = Number(req.headers['content-length'] ?? 0);
    if (contentLength > maxBytes) {
      res.statusCode = 413;
      res.end('Payload Too Large');
      logEvent('warn', 'payload_too_large', {
        sessionId,
        contentLength,
        max: maxBytes,
      });
      return;
    }

    // 流式累计校验:Content-Length 可能缺失(chunked encoding),
    // 用 data 事件累计字节数,超限时立即中断。
    //
    // M1.1: 中止不仅要回 413 + 移除监听器,还要彻底拆掉 transport 后续操作,
    // 否则 SDK transport 仍会尝试从 req 读 body,在 res 已 end 后再 write 抛错
    // (ERR_STREAM_WRITE_AFTER_END)。两件套:
    //   1. req.destroy() — 销毁 IncomingMessage 流,让 SDK transport
    //      的 req.on('data') / req.on('end') 立即停止,避免继续累积内存;
    //      也会让 await handlePostMessage 因 req 流错误而提前 reject。
    //   2. res.end() 由本回调执行,transport 后续 write 因 writableEnded
    //      直接被 Node 丢弃;若 transport 已先 end(res.writableEnded=true),
    //      不再二次 end(避免 ERR_STREAM_WRITE_AFTER_END)。
    let receivedBytes = 0;
    let exceeded = false;
    const onData = (chunk: Buffer) => {
      receivedBytes += chunk.length;
      if (receivedBytes > maxBytes && !exceeded) {
        exceeded = true;
        // 顺序:先标记 → 拆监听器 → 销毁 req → 回 413
        req.removeListener('data', onData);
        // req.destroy() 可能触发 'error' 事件;若 SDK 注册了 error handler 会吞掉,
        // 否则 Node 默认 throw 进程退出。destroy 前先注册兜底 error 监听器吸收异常。
        req.on('error', () => { /* 已通过 exceeded 标记,忽略后续 socket error */ });
        try {
          req.destroy();
        } catch {
          /* socket 已关闭等竞态 — 忽略 */
        }
        // res 可能已被 transport 写过头部(handlePostMessage 提前 start),
        // 此时再 res.end() 会抛 ERR_STREAM_WRITE_AFTER_END — 检查 + try/catch 兜底。
        try {
          if (!res.writableEnded) {
            res.statusCode = 413;
            res.end('Payload Too Large');
          }
        } catch {
          /* transport 已 end — 忽略 */
        }
        logEvent('warn', 'payload_too_large_streaming', {
          sessionId,
          receivedBytes,
          max: maxBytes,
        });
      }
    };
    req.on('data', onData);

    entry.lastActivityAt = Date.now();
    logEvent('info', 'message_received', { sessionId });
    // req 被 destroy 后,SDK transport 的 handlePostMessage 内部读 req 流会
    // 立即 reject('aborted' / 'stream destroyed'),不会继续向 res 写。
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
    const receivedToken = match?.[1];
    if (!receivedToken) return false;
    return safeEqualToken(receivedToken, this.authToken);
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

  private get maxRequestBytes(): number {
    return this.options.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES;
  }

  private get closeTimeoutMs(): number {
    return this.options.closeTimeoutMs ?? DEFAULT_CLOSE_TIMEOUT_MS;
  }
}
