/**
 * BrowserBridge:浏览器 ↔ Node MCP Server 的跨进程桥(M2.3)。
 *
 * 混合架构 E 的核心组件:
 *   浏览器内 lokvis-open Runtime 通过 WebSocket 连到本地 MCP Server,
 *   MCP Server 的 ToolRouter 优先把 tool 调用转发到浏览器(完整能力),
 *   浏览器未连接时降级到 Node engine(sharp)。
 *
 * 协议(基于 WebSocket 文本帧,JSON 编码):
 *   server → browser: { type:'call', id, tool, params }   转发 tool 调用
 *   browser → server: { type:'result', id, result }        返回结果(McpToolResult)
 *                  | { type:'error', id, error }            返回错误
 *   browser → server: { type:'ready' }                      浏览器就绪
 *
 * 当前为单浏览器连接(M2.1 单进程场景足够)。
 *
 * 参考:docs/reports/20260712-task-plan.md §M2.3
 */

import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';

/** callTool 默认超时(ms) */
const DEFAULT_CALL_TIMEOUT_MS = 30000;

/** 浏览器返回的 tool 结果(与 McpToolResult 对齐) */
export interface BridgeToolResult {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; data: string; mimeType: string }
    | { type: 'resource'; uri: string }
  >;
  isError?: boolean;
}

export interface BrowserBridgeOptions {
  /** 监听端口,传 0 由 OS 分配(测试用) */
  port: number;
  /** 单次 callTool 超时(毫秒,默认 30000) */
  callTimeoutMs?: number;
  /** 仅绑定本机(默认 true) */
  localhostOnly?: boolean;
}

/** 待处理的 callTool 请求 */
interface PendingCall {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * BrowserBridge:在指定端口启动 WebSocket server,等待浏览器连接。
 *
 * @example
 * ```ts
 * const bridge = new BrowserBridge({ port: 3002 });
 * await bridge.start();
 * // 浏览器内:new WebSocket('ws://localhost:3002') 并处理 call 消息
 * ```
 */
export class BrowserBridge {
  private wss: WebSocketServer | null = null;
  private socket: WebSocket | null = null;
  private readonly pending = new Map<string, PendingCall>();
  private resolvedPort: number | undefined;

  constructor(private readonly options: BrowserBridgeOptions) {}

  /** 启动 WebSocket server */
  async start(): Promise<void> {
    const { port, localhostOnly = true } = this.options;
    this.wss = new WebSocketServer({
      port,
      host: localhostOnly ? '127.0.0.1' : '0.0.0.0',
    });
    this.wss.on('connection', (ws) => this.handleConnection(ws));

    await new Promise<void>((resolve, reject) => {
      this.wss!.once('listening', resolve);
      this.wss!.once('error', reject);
    });
    const addr = this.wss.address();
    this.resolvedPort =
      addr && typeof addr === 'object' ? addr.port : port;
  }

  /** 实际监听端口(start 后可用) */
  getPort(): number | undefined {
    return this.resolvedPort;
  }

  /** 浏览器是否已连接 */
  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * 转发 tool 调用到浏览器,等待结果。
   * 浏览器未连接时立即抛错(由 ToolRouter 捕获并降级到 Node engine)。
   */
  async callTool(
    tool: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    if (!this.isConnected()) {
      throw new Error('Browser not connected');
    }
    const id = randomUUID();
    const { callTimeoutMs = DEFAULT_CALL_TIMEOUT_MS } = this.options;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Browser call timed out after ${callTimeoutMs}ms: ${tool}`));
      }, callTimeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      this.socket!.send(
        JSON.stringify({ type: 'call', id, tool, params })
      );
    });
  }

  /** 处理浏览器连接 */
  private handleConnection(ws: WebSocket): void {
    // 单连接:已有连接则关闭旧的
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    }
    this.socket = ws;

    ws.on('message', (data) => {
      let msg: any;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return; // 忽略非 JSON 帧
      }
      this.handleMessage(msg);
    });

    ws.on('close', () => {
      if (this.socket === ws) {
        this.socket = null;
      }
      // 浏览器断开:拒绝所有待处理调用
      for (const [id, pending] of this.pending) {
        clearTimeout(pending.timer);
        pending.reject(new Error('Browser disconnected'));
        this.pending.delete(id);
      }
    });
    ws.on('error', () => {
      // 错误由 close 事件兜底处理
    });
  }

  /** 处理浏览器发来的消息 */
  private handleMessage(msg: any): void {
    if (!msg || typeof msg !== 'object') return;
    const { type, id } = msg;
    if (type !== 'result' && type !== 'error') return;
    const pending = id ? this.pending.get(id) : undefined;
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pending.delete(id);
    if (type === 'result') {
      pending.resolve(msg.result);
    } else {
      pending.reject(new Error(msg.error ?? 'Unknown browser error'));
    }
  }

  /** 关闭桥与所有待处理调用 */
  async close(): Promise<void> {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error('BrowserBridge closed'));
    }
    this.pending.clear();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss!.close(() => resolve());
      });
      this.wss = null;
    }
  }
}
