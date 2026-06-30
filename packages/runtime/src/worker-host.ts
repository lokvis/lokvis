/**
 * WorkerHost —— 主线程侧的 Worker 管理器
 *
 * 职责(对应 PROJECT_PLAN 1.6):
 * - 生成 / 重启 Worker,完成 ready 握手。
 * - Request/Response 按 id 关联,每请求独立超时。
 * - 心跳(Heartbeat):周期 ping,超时未 pong 视为崩溃。
 * - 崩溃重启:传输层 error / 心跳超时 → 终止并重建(最多 maxRestarts 次)。
 * - 事件分发:Worker 主动 event + 生命周期事件(ready/restart/crash/dead)。
 *
 * 传输层抽象(WorkerTransport)使其与具体 Worker 实现解耦:
 * - 浏览器:createBrowserWorkerTransport(url)
 * - 测试:注入 Fake 传输,无需真实 Worker。
 */

import {
  WORKER_PROTOCOL_VERSION,
  DEFAULT_HEARTBEAT_INTERVAL_MS,
  DEFAULT_HEARTBEAT_TIMEOUT_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_MAX_RESTARTS,
  DEFAULT_READY_TIMEOUT_MS,
  createRequestId,
  isWorkerResponse,
  isWorkerPong,
  isWorkerReady,
  isWorkerEvent,
  isWorkerFatalError,
  type WorkerRequest,
  type WorkerPing,
} from './worker-protocol.js';

// ─── 传输层抽象 ─────────────────────────────────────────────────

/** 规范化的传输层错误 */
export interface WorkerTransportError {
  message: string;
  filename?: string;
  lineno?: number;
  stack?: string;
}

/**
 * 传输层接口:屏蔽 浏览器 Worker / Node worker_threads / Fake 差异。
 * Host 仅依赖该接口,便于单测注入 Fake。
 */
export interface WorkerTransport {
  /** 向 Worker 发消息(可附带可转移对象) */
  send(message: unknown, transfer?: Transferable[]): void;
  /** 监听 Worker → Host 消息,返回取消订阅 */
  onMessage(handler: (data: unknown) => void): () => void;
  /** 监听传输层错误(脚本加载失败 / 未捕获异常 / 异常退出),返回取消订阅 */
  onError(handler: (err: WorkerTransportError) => void): () => void;
  /** 终止 Worker */
  terminate(): void;
}

// ─── 错误类型 ───────────────────────────────────────────────────

/** Worker 崩溃(传输层错误或心跳超时) */
export class WorkerCrashedError extends Error {
  readonly reason: string;
  readonly restartCount: number;
  constructor(reason: string, restartCount: number) {
    super(`Worker crashed: ${reason}`);
    this.name = 'WorkerCrashedError';
    this.reason = reason;
    this.restartCount = restartCount;
  }
}

/** Worker 正在重启,拒绝新请求 */
export class WorkerRestartingError extends Error {
  constructor() {
    super('Worker is restarting');
    this.name = 'WorkerRestartingError';
  }
}

/** Worker 已死亡(超过最大重启次数) */
export class WorkerDeadError extends Error {
  readonly restartCount: number;
  constructor(restartCount: number) {
    super(`Worker is dead after ${restartCount} restart attempts`);
    this.name = 'WorkerDeadError';
    this.restartCount = restartCount;
  }
}

/** 单个请求超时 */
export class WorkerRequestTimeoutError extends Error {
  readonly method: string;
  constructor(method: string, timeoutMs: number) {
    super(`Request "${method}" timed out after ${timeoutMs}ms`);
    this.name = 'WorkerRequestTimeoutError';
    this.method = method;
  }
}

/** ready 握手失败(协议版本不匹配或超时) */
export class WorkerHandshakeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkerHandshakeError';
  }
}

// ─── Host 选项与事件 ────────────────────────────────────────────

export interface WorkerHostOptions {
  /** 心跳发送间隔 */
  heartbeatIntervalMs?: number;
  /** 心跳超时(未收到 pong 视为崩溃) */
  heartbeatTimeoutMs?: number;
  /** 单个请求默认超时 */
  requestTimeoutMs?: number;
  /** 等待 Worker ready 的超时 */
  readyTimeoutMs?: number;
  /** 崩溃后最大重启次数 */
  maxRestarts?: number;
  /** 传输层工厂(重启时复用) */
  createTransport: () => WorkerTransport;
  /** 是否输出日志 */
  enableLog?: boolean;
}

export type WorkerHostStatus =
  | 'idle' // 未启动
  | 'ready' // 可用
  | 'restarting' // 崩溃后重启中
  | 'dead' // 超过最大重启次数
  | 'disposed'; // 已销毁

/** 生命周期 + Worker 主动事件 */
export interface WorkerHostEventMap {
  ready: { restartCount: number };
  restart: { reason: string; restartCount: number };
  crash: { reason: string; restartCount: number };
  dead: { reason: string; restartCount: number };
  event: { event: string; payload?: unknown };
}

export type WorkerHostEventType = keyof WorkerHostEventMap;

type Listener<T> = (payload: T) => void;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  method: string;
}

// ─── WorkerHost ─────────────────────────────────────────────────

export class WorkerHost {
  private opts: Required<Omit<WorkerHostOptions, 'createTransport' | 'enableLog'>> &
    Pick<WorkerHostOptions, 'createTransport' | 'enableLog'>;

  private status: WorkerHostStatus = 'idle';
  private transport: WorkerTransport | null = null;
  private pending = new Map<string, PendingRequest>();
  private listeners = new Map<WorkerHostEventType, Set<Listener<unknown>>>();

  private restartCount = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private awaitingPong = false;
  private offMessage: (() => void) | null = null;
  private offError: (() => void) | null = null;

  constructor(opts: WorkerHostOptions) {
    this.opts = {
      heartbeatIntervalMs: opts.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS,
      heartbeatTimeoutMs: opts.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS,
      requestTimeoutMs: opts.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
      readyTimeoutMs: opts.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS,
      maxRestarts: opts.maxRestarts ?? DEFAULT_MAX_RESTARTS,
      createTransport: opts.createTransport,
      enableLog: opts.enableLog ?? false,
    };
  }

  get currentStatus(): WorkerHostStatus {
    return this.status;
  }

  /** 已发生的重启次数 */
  get currentRestartCount(): number {
    return this.restartCount;
  }

  /** 订阅事件,返回取消订阅 */
  on<K extends WorkerHostEventType>(
    type: K,
    handler: Listener<WorkerHostEventMap[K]>
  ): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(handler as Listener<unknown>);
    return () => set!.delete(handler as Listener<unknown>);
  }

  private emit<K extends WorkerHostEventType>(
    type: K,
    payload: WorkerHostEventMap[K]
  ): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const h of set) (h as Listener<WorkerHostEventMap[K]>)(payload);
  }

  private log(message: string): void {
    if (this.opts.enableLog) console.debug(`[WorkerHost] ${message}`);
  }

  // ─── 生命周期 ───────────────────────────────────────────────

  /** 启动并完成 ready 握手 */
  async init(): Promise<void> {
    if (this.status === 'disposed') throw new Error('WorkerHost is disposed');
    if (this.status !== 'idle') return; // 已启动
    await this.spawn();
  }

  /** 销毁:终止 Worker、清理定时器、拒绝所有 pending */
  async dispose(): Promise<void> {
    if (this.status === 'disposed') return;
    this.status = 'disposed';
    this.clearHeartbeat();
    this.rejectAllPending(new Error('WorkerHost disposed'));
    this.offMessage?.();
    this.offError?.();
    this.offMessage = null;
    this.offError = null;
    this.transport?.terminate();
    this.transport = null;
    this.listeners.clear();
  }

  // ─── 请求 ───────────────────────────────────────────────────

  /** 调用 Worker 方法并等待响应 */
  async request<T = unknown>(
    method: string,
    params?: unknown,
    options?: { transfer?: Transferable[]; timeoutMs?: number }
  ): Promise<T> {
    if (this.status === 'disposed') throw new Error('WorkerHost is disposed');
    if (this.status === 'dead') throw new WorkerDeadError(this.restartCount);
    if (this.status === 'restarting' || this.status === 'idle') {
      throw new WorkerRestartingError();
    }

    const id = createRequestId();
    const timeoutMs = options?.timeoutMs ?? this.opts.requestTimeoutMs;
    const msg: WorkerRequest = { id, type: 'request', method, params };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) {
          reject(new WorkerRequestTimeoutError(method, timeoutMs));
        }
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
        timer,
        method,
      });

      this.send(msg, options?.transfer);
    });
  }

  // ─── 内部:spawn / 消息处理 / 崩溃 ──────────────────────────

  /** 创建传输层、绑定监听、等待 ready */
  private async spawn(): Promise<void> {
    const transport = this.opts.createTransport();
    this.transport = transport;

    this.offMessage = transport.onMessage((data) => this.handleMessage(data));
    this.offError = transport.onError((err) =>
      this.handleCrash(`transport error: ${err.message}`)
    );

    // 等待 ready 握手(超时或协议不匹配则拒绝,由 catch 清理 transport)
    let readyTimer: ReturnType<typeof setTimeout>;
    try {
      await new Promise<void>((resolve, reject) => {
        let done = false;
        readyTimer = setTimeout(() => {
          if (done) return;
          done = true;
          reject(
            new WorkerHandshakeError(
              `Worker did not send ready within ${this.opts.readyTimeoutMs}ms`
            )
          );
        }, this.opts.readyTimeoutMs);
        readyTimer.unref?.();

        const off = this.on('ready', () => {
          if (done) return;
          done = true;
          clearTimeout(readyTimer);
          off();
          resolve();
        });
      });
    } catch (err) {
      clearTimeout(readyTimer!);
      this.offMessage?.();
      this.offError?.();
      this.offMessage = null;
      this.offError = null;
      transport.terminate();
      this.transport = null;
      throw err as Error;
    }

    this.status = 'ready';
    this.startHeartbeat();
  }

  private handleMessage(data: unknown): void {
    // ready(可能在握手期间或重启后)
    if (isWorkerReady(data)) {
      if (!data.protocolVersion || data.protocolVersion !== WORKER_PROTOCOL_VERSION) {
        this.handleCrash(
          `protocol mismatch: worker=${data.protocolVersion} host=${WORKER_PROTOCOL_VERSION}`
        );
        return;
      }
      // ready 事件由 spawn() 的监听器消费;重启后再次 ready 也触发
      this.emit('ready', { restartCount: this.restartCount });
      return;
    }

    if (isWorkerPong(data)) {
      this.awaitingPong = false;
      if (this.pongTimer) {
        clearTimeout(this.pongTimer);
        this.pongTimer = null;
      }
      return;
    }

    if (isWorkerResponse(data)) {
      const pending = this.pending.get(data.id);
      if (!pending) return; // 已超时或已取消
      this.pending.delete(data.id);
      clearTimeout(pending.timer);
      if (data.ok) pending.resolve(data.result);
      else {
        const e = data.error;
        const err = new Error(e.message);
        err.name = e.code ?? 'WorkerError';
        if (e.stack) err.stack = e.stack;
        pending.reject(err);
      }
      return;
    }

    if (isWorkerEvent(data)) {
      this.emit('event', { event: data.event, payload: data.payload });
      return;
    }

    if (isWorkerFatalError(data)) {
      // Worker 主动上报致命错误 → 视为崩溃
      this.handleCrash(`worker fatal: ${data.message}`);
      return;
    }
  }

  /** 崩溃处理:拒绝 pending → 终止 → 重启(受 maxRestarts 限制) */
  private handleCrash(reason: string): void {
    // 正在重启/已死亡/已销毁时,忽略额外的崩溃信号(避免重入)
    if (
      this.status === 'disposed' ||
      this.status === 'dead' ||
      this.status === 'restarting'
    ) {
      return;
    }

    this.log(`crash: ${reason}`);
    this.status = 'restarting';
    this.teardownTransport();
    this.rejectAllPending(new WorkerCrashedError(reason, this.restartCount));
    this.emit('crash', { reason, restartCount: this.restartCount });
    this.tryRestart(reason);
  }

  /**
   * 重启尝试循环。spawn 失败(ready 超时)时,直接 teardown 并重试,
   * 不经过 handleCrash 的 restarting 守卫——否则永远到不了 dead。
   */
  private tryRestart(reason: string): void {
    if (this.status === 'disposed') return;
    if (this.restartCount >= this.opts.maxRestarts) {
      this.status = 'dead';
      this.emit('dead', { reason, restartCount: this.restartCount });
      return;
    }
    this.restartCount++;
    this.log(`restarting (attempt ${this.restartCount}/${this.opts.maxRestarts})`);
    this.spawn()
      .then(() => {
        this.emit('restart', { reason, restartCount: this.restartCount });
      })
      .catch((err: Error) => {
        // 重启失败:终止本次(未握手成功的)transport,继续下一轮重试
        this.teardownTransport();
        this.tryRestart(`restart failed: ${err.message}`);
      });
  }

  /** 解绑当前 transport 的监听并终止 */
  private teardownTransport(): void {
    this.clearHeartbeat();
    this.offMessage?.();
    this.offError?.();
    this.offMessage = null;
    this.offError = null;
    this.transport?.terminate();
    this.transport = null;
  }

  // ─── 心跳 ───────────────────────────────────────────────────

  private startHeartbeat(): void {
    this.clearHeartbeat();
    this.awaitingPong = false;
    this.heartbeatTimer = setInterval(() => {
      this.sendPing();
    }, this.opts.heartbeatIntervalMs);
    this.heartbeatTimer.unref?.();
  }

  private sendPing(): void {
    if (this.awaitingPong) return; // 上一轮 pong 未回,等超时触发崩溃
    this.awaitingPong = true;
    const msg: WorkerPing = {
      id: createRequestId(),
      type: 'ping',
      ts: Date.now(),
    };
    this.send(msg);
    this.pongTimer = setTimeout(() => {
      this.handleCrash(`heartbeat timeout (no pong in ${this.opts.heartbeatTimeoutMs}ms)`);
    }, this.opts.heartbeatTimeoutMs);
    this.pongTimer.unref?.();
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
    this.awaitingPong = false;
  }

  // ─── 工具 ───────────────────────────────────────────────────

  private send(message: unknown, transfer?: Transferable[]): void {
    if (!this.transport) return;
    this.transport.send(message, transfer);
  }

  private rejectAllPending(error: Error): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(error);
    }
    this.pending.clear();
  }
}

// ─── 浏览器默认传输层 ───────────────────────────────────────────

/**
 * 创建浏览器 Web Worker 传输层。
 * 仅在浏览器主线程可用(Node 测试应注入 Fake 传输)。
 */
export function createBrowserWorkerTransport(url: string | URL): WorkerTransport {
  const worker = new Worker(url, { type: 'module' });
  const messageHandlers = new Set<(data: unknown) => void>();
  const errorHandlers = new Set<(err: WorkerTransportError) => void>();

  worker.addEventListener('message', (ev: MessageEvent) => {
    for (const h of messageHandlers) h(ev.data);
  });
  worker.addEventListener('error', (ev: ErrorEvent) => {
    const err: WorkerTransportError = {
      message: ev.message || 'Worker error',
      filename: ev.filename,
      lineno: ev.lineno,
      stack: ev.error instanceof Error ? ev.error.stack : undefined,
    };
    for (const h of errorHandlers) h(err);
  });

  return {
    send(message, transfer) {
      if (transfer && transfer.length > 0) worker.postMessage(message, transfer);
      else worker.postMessage(message);
    },
    onMessage(handler) {
      messageHandlers.add(handler);
      return () => messageHandlers.delete(handler);
    },
    onError(handler) {
      errorHandlers.add(handler);
      return () => errorHandlers.delete(handler);
    },
    terminate() {
      worker.terminate();
    },
  };
}
