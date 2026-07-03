/**
 * WorkerHost + Worker 协议 单元测试
 *
 * 覆盖(PROJECT_PLAN 1.9):
 * - 协议助手函数与类型守卫
 * - init / ready 握手
 * - request / response 关联与超时
 * - 心跳:正常 pong / 超时触发崩溃
 * - 崩溃重启:transport error 与心跳超时
 * - 超过 maxRestarts → dead
 * - dispose、事件转发、协议版本不匹配
 *
 * 通过注入 FakeTransport(实现 WorkerTransport)在 Node 环境模拟 Worker,
 * 无需真实浏览器 Worker。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WorkerHost,
  WorkerCrashedError,
  WorkerRestartingError,
  WorkerDeadError,
  WorkerRequestTimeoutError,
  WorkerRequestAbortedError,
  WorkerHandshakeError,
  type WorkerTransport,
  type WorkerTransportError,
} from '../worker-host.js';
import {
  WORKER_PROTOCOL_VERSION,
  createRequestId,
  isWorkerResponse,
  isWorkerPong,
  isWorkerReady,
  isWorkerEvent,
  isWorkerFatalError,
  isWorkerMessageToHost,
  isProtocolCompatible,
} from '../worker-protocol.js';

// ─── FakeTransport ──────────────────────────────────────────────

/** 测试用传输层:记录发出的消息,提供向 Host 注入消息/错误的方法 */
class FakeTransport implements WorkerTransport {
  sent: unknown[] = [];
  terminated = false;
  private msgHandlers = new Set<(d: unknown) => void>();
  private errHandlers = new Set<(e: WorkerTransportError) => void>();

  send(message: unknown, _transfer?: Transferable[]): void {
    this.sent.push(message);
  }
  onMessage(h: (d: unknown) => void): () => void {
    this.msgHandlers.add(h);
    return () => this.msgHandlers.delete(h);
  }
  onError(h: (e: WorkerTransportError) => void): () => void {
    this.errHandlers.add(h);
    return () => this.errHandlers.delete(h);
  }
  terminate(): void {
    this.terminated = true;
  }

  /** 模拟 Worker → Host 发消息 */
  emitToHost(data: unknown): void {
    for (const h of this.msgHandlers) h(data);
  }
  /** 模拟传输层错误(崩溃) */
  emitError(err: WorkerTransportError): void {
    for (const h of this.errHandlers) h(err);
  }

  get lastSent(): unknown {
    return this.sent[this.sent.length - 1];
  }
}

/** 构造一个 ready 消息 */
function ready(version: string = WORKER_PROTOCOL_VERSION) {
  return { type: 'ready' as const, protocolVersion: version };
}

/** 测试夹具:管理多个 transport(重启时复用 factory) */
function setup(
  opts?: Partial<ConstructorParameters<typeof WorkerHost>[0]>
): {
  host: WorkerHost;
  transports: FakeTransport[];
  current: () => FakeTransport;
} {
  const transports: FakeTransport[] = [];
  const factory = () => {
    const t = new FakeTransport();
    transports.push(t);
    return t;
  };
  const host = new WorkerHost({
    createTransport: factory,
    heartbeatIntervalMs: 1000,
    heartbeatTimeoutMs: 2000,
    requestTimeoutMs: 1000,
    readyTimeoutMs: 1000,
    maxRestarts: 3,
    ...opts,
  });
  return {
    host,
    transports,
    current: () => transports[transports.length - 1]!,
  };
}

/** 完成 init 握手 */
async function initReady(host: WorkerHost, current: () => FakeTransport): Promise<void> {
  const p = host.init();
  current().emitToHost(ready());
  await p;
}

// ─── 协议助手 ───────────────────────────────────────────────────

describe('worker-protocol 助手', () => {
  it('createRequestId 应返回唯一字符串', () => {
    const a = createRequestId();
    const b = createRequestId();
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it('isWorkerResponse 应识别响应消息', () => {
    expect(isWorkerResponse({ id: '1', type: 'response', ok: true, result: 42 })).toBe(true);
    expect(
      isWorkerResponse({ id: '1', type: 'response', ok: false, error: { message: 'x' } })
    ).toBe(true);
    expect(isWorkerResponse({ type: 'pong' })).toBe(false);
    expect(isWorkerResponse(null)).toBe(false);
  });

  it('isWorkerPong / isWorkerReady / isWorkerEvent / isWorkerFatalError 类型守卫', () => {
    expect(isWorkerPong({ id: '1', type: 'pong', ts: 1 })).toBe(true);
    expect(isWorkerReady({ type: 'ready', protocolVersion: '0.1.0' })).toBe(true);
    expect(isWorkerEvent({ type: 'event', event: 'progress' })).toBe(true);
    expect(isWorkerFatalError({ type: 'error', message: 'boom' })).toBe(true);
    expect(isWorkerEvent({ type: 'error', message: 'boom' })).toBe(false);
  });

  it('isProtocolCompatible 应严格匹配版本', () => {
    expect(isProtocolCompatible(WORKER_PROTOCOL_VERSION)).toBe(true);
    expect(isProtocolCompatible('0.2.0')).toBe(false);
  });

  it('isWorkerMessageToHost 应识别所有合法的 Worker→Host 消息', () => {
    expect(isWorkerMessageToHost({ id: '1', type: 'response', ok: true, result: 1 })).toBe(true);
    expect(isWorkerMessageToHost({ id: '1', type: 'pong', ts: 1 })).toBe(true);
    expect(isWorkerMessageToHost({ type: 'event', event: 'progress' })).toBe(true);
    expect(isWorkerMessageToHost({ type: 'ready', protocolVersion: '0.1.0' })).toBe(true);
    expect(isWorkerMessageToHost({ type: 'error', message: 'boom' })).toBe(true);
  });

  it('isWorkerMessageToHost 应拒绝非消息对象 / 未知 type / Host→Worker 消息', () => {
    expect(isWorkerMessageToHost(null)).toBe(false);
    expect(isWorkerMessageToHost(undefined)).toBe(false);
    expect(isWorkerMessageToHost('string')).toBe(false);
    expect(isWorkerMessageToHost(42)).toBe(false);
    expect(isWorkerMessageToHost({ type: 'request' })).toBe(false);
    expect(isWorkerMessageToHost({ type: 'ping' })).toBe(false);
    expect(isWorkerMessageToHost({ type: 'cancel' })).toBe(false);
    expect(isWorkerMessageToHost({})).toBe(false);
    expect(isWorkerMessageToHost({ type: 'unknown' })).toBe(false);
  });

  it('createRequestId 在无 crypto.randomUUID 时应回退到 Date+random', () => {
    const original = globalThis.crypto;
    // 临时移除 randomUUID
    const cryptoStub = { ...original, randomUUID: undefined as unknown };
    vi.stubGlobal('crypto', cryptoStub);
    try {
      const id = createRequestId();
      expect(id).toMatch(/^req_\d+_/);
      const a = createRequestId();
      const b = createRequestId();
      expect(a).not.toBe(b);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('createRequestId 在有 crypto.randomUUID 时应返回 UUID', () => {
    // Node 24 默认有 crypto.randomUUID
    const id = createRequestId();
    // UUID 格式 8-4-4-4-12
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});

// ─── init 与 request/response ───────────────────────────────────

describe('WorkerHost init + request', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('init 在收到 ready 前不 resolve', () => {
    const { host, current } = setup();
    const p = host.init();
    expect(host.currentStatus).toBe('idle');
    // 尚未发送 ready,Promise 应挂起
    let resolved = false;
    p.then(() => (resolved = true));
    // flush 微任务
    return Promise.resolve().then(() => {
      expect(resolved).toBe(false);
      current().emitToHost(ready());
      return p.then(() => {
        expect(host.currentStatus).toBe('ready');
      });
    });
  });

  it('init 收到错误协议版本应崩溃', async () => {
    const { host, current } = setup({ maxRestarts: 0, readyTimeoutMs: 50 });
    const p = host.init();
    // 先挂 assertion,避免 advance 期间触发未处理 rejection
    const assertion = expect(p).rejects.toThrow(/protocol mismatch|did not send ready/);
    current().emitToHost(ready('0.0.0-mismatch'));
    // 推进时间让 ready 超时(mismatch → crash → dead,spawn 最终由 readyTimer 拒绝)
    await vi.advanceTimersByTimeAsync(60);
    await assertion;
  });

  it('init ready 超时应抛 WorkerHandshakeError', async () => {
    const { host } = setup({ readyTimeoutMs: 50, maxRestarts: 0 });
    const p = host.init();
    const assertion = expect(p).rejects.toBeInstanceOf(WorkerHandshakeError);
    // 不发送 ready,推进时间触发超时
    await vi.advanceTimersByTimeAsync(60);
    await assertion;
  });

  it('request 应发送带 id/method/params 的请求', async () => {
    const { host, current } = setup();
    await initReady(host, current);

    const reqP = host.request('image.resize', { width: 10 });
    const sent = current().lastSent as { id: string; type: string; method: string; params: unknown };
    expect(sent.type).toBe('request');
    expect(sent.method).toBe('image.resize');
    expect(sent.params).toEqual({ width: 10 });
    expect(typeof sent.id).toBe('string');

    current().emitToHost({ id: sent.id, type: 'response', ok: true, result: 'ok' });
    await expect(reqP).resolves.toBe('ok');
  });

  it('response ok=false 应 reject 并携带 message', async () => {
    const { host, current } = setup();
    await initReady(host, current);

    const reqP = host.request('image.resize');
    const sent = current().lastSent as { id: string };
    current().emitToHost({
      id: sent.id,
      type: 'response',
      ok: false,
      error: { message: 'bad params', code: 'E_BAD' },
    });
    await expect(reqP).rejects.toThrow('bad params');
    await expect(reqP).rejects.toMatchObject({ name: 'E_BAD' });
  });

  it('request 超时(完整流程)应抛 WorkerRequestTimeoutError', async () => {
    const { host, current } = setup({ requestTimeoutMs: 50 });
    await initReady(host, current);

    const reqP = host.request('image.resize');
    // 先挂 assertion,避免 advance 期间触发未处理 rejection
    const assertion = expect(reqP).rejects.toBeInstanceOf(WorkerRequestTimeoutError);
    // 不回 response,推进时间
    await vi.advanceTimersByTimeAsync(60);
    await assertion;
  });
});

// ─── 心跳 ───────────────────────────────────────────────────────

describe('WorkerHost 心跳', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('应按间隔发送 ping,收到 pong 不崩溃', async () => {
    const { host, current } = setup({ heartbeatIntervalMs: 1000, heartbeatTimeoutMs: 2000 });
    await initReady(host, current);

    // 推进一个心跳间隔 → 应发送 ping
    await vi.advanceTimersByTimeAsync(1000);
    const ping = current().lastSent as { type: string; id: string };
    expect(ping.type).toBe('ping');

    // 回 pong
    current().emitToHost({ id: ping.id, type: 'pong', ts: Date.now() });

    // 再推进多轮,持续回 pong,不应崩溃
    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(1000);
      const p = current().lastSent as { type: string; id: string };
      if (p?.type === 'ping') {
        current().emitToHost({ id: p.id, type: 'pong', ts: Date.now() });
      }
    }
    expect(host.currentStatus).toBe('ready');
  });

  it('ping 后超时未收到 pong 应触发崩溃重启', async () => {
    const { host, current, transports } = setup({
      heartbeatIntervalMs: 1000,
      heartbeatTimeoutMs: 2000,
      maxRestarts: 3,
    });
    await initReady(host, current);
    expect(transports).toHaveLength(1);

    // 推进到 ping 发出
    await vi.advanceTimersByTimeAsync(1000);
    // 不回 pong,推进到心跳超时
    await vi.advanceTimersByTimeAsync(2000);

    // 此时旧 transport 应被终止,新 transport 已创建(restarting)
    expect(transports[0]!.terminated).toBe(true);
    expect(transports.length).toBeGreaterThanOrEqual(2);

    // 完成新 transport 的 ready 握手
    current().emitToHost(ready());
    // flush 让 spawn resolve + emit restart
    await vi.advanceTimersByTimeAsync(0);
    expect(host.currentStatus).toBe('ready');
    expect(host.currentRestartCount).toBe(1);
  });
});

// ─── 崩溃重启 ───────────────────────────────────────────────────

describe('WorkerHost 崩溃重启', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('transport error 应触发崩溃:pending 被拒、旧 transport 终止、重启', async () => {
    const { host, current, transports } = setup({ maxRestarts: 3 });
    await initReady(host, current);

    const crashEvents: { reason: string }[] = [];
    const restartEvents: { restartCount: number }[] = [];
    host.on('crash', (e) => crashEvents.push(e));
    host.on('restart', (e) => restartEvents.push(e));

    // 发起一个未完成的请求
    const reqP = host.request('image.resize');
    const sent = current().lastSent as { id: string };
    // 先挂 assertion,避免 emitError 同步拒绝时产生未处理 rejection
    const crashAssertion = expect(reqP).rejects.toBeInstanceOf(WorkerCrashedError);

    // 触发崩溃
    current().emitError({ message: 'boom' });

    // pending 应被拒为 WorkerCrashedError
    await crashAssertion;
    expect(crashEvents).toHaveLength(1);
    expect(crashEvents[0]!.reason).toMatch(/boom/);

    // 旧 transport 终止
    expect(transports[0]!.terminated).toBe(true);

    // 完成重启握手
    current().emitToHost(ready());
    await vi.advanceTimersByTimeAsync(0);
    expect(host.currentStatus).toBe('ready');
    expect(restartEvents).toHaveLength(1);
    expect(restartEvents[0]!.restartCount).toBe(1);

    // 重启后新请求可正常工作
    const newReq = host.request('image.compress');
    const newSent = current().lastSent as { id: string };
    expect(newSent.id).not.toBe(sent.id);
    current().emitToHost({ id: newSent.id, type: 'response', ok: true, result: 'done' });
    await expect(newReq).resolves.toBe('done');
  });

  it('重启期间 request 应抛 WorkerRestartingError', async () => {
    const { host, current } = setup({ maxRestarts: 3 });
    await initReady(host, current);

    current().emitError({ message: 'crash' });
    // 此时 status=restarting,新请求应立即被拒
    await expect(host.request('image.resize')).rejects.toBeInstanceOf(WorkerRestartingError);

    // 恢复
    current().emitToHost(ready());
    await vi.advanceTimersByTimeAsync(0);
    expect(host.currentStatus).toBe('ready');
  });

  it('超过 maxRestarts 应进入 dead,后续 request 抛 WorkerDeadError', async () => {
    const { host, current } = setup({ maxRestarts: 1, readyTimeoutMs: 50 });
    await initReady(host, current);

    const deadEvents: { restartCount: number }[] = [];
    host.on('dead', (e) => deadEvents.push(e));

    // 触发崩溃 → 重启尝试 1(新 transport 不发 ready)→ ready 超时 → 重启失败
    // → restartCount(1) >= maxRestarts(1) → dead
    current().emitError({ message: 'crash' });
    // 推进足够时间让 ready 超时
    await vi.advanceTimersByTimeAsync(100);

    expect(host.currentStatus).toBe('dead');
    expect(deadEvents).toHaveLength(1);
    await expect(host.request('image.resize')).rejects.toBeInstanceOf(WorkerDeadError);
  });

  it('Worker 主动 fatal error 应视为崩溃', async () => {
    const { host, current } = setup({ maxRestarts: 3 });
    await initReady(host, current);

    const crashEvents: { reason: string }[] = [];
    host.on('crash', (e) => crashEvents.push(e));

    current().emitToHost({ type: 'error', message: 'engine exploded' });
    await vi.advanceTimersByTimeAsync(0);

    expect(crashEvents).toHaveLength(1);
    expect(crashEvents[0]!.reason).toMatch(/engine exploded/);
    expect(host.currentStatus).toBe('restarting');
  });
});

// ─── dispose 与事件转发 ─────────────────────────────────────────

describe('WorkerHost dispose 与事件', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('dispose 应终止 transport、拒绝 pending、状态 disposed', async () => {
    const { host, current } = setup();
    await initReady(host, current);

    const reqP = host.request('image.resize');
    // 先挂 assertion,dispose 会同步拒绝 pending
    const assertion = expect(reqP).rejects.toThrow(/disposed/);
    await host.dispose();

    expect(host.currentStatus).toBe('disposed');
    await assertion;
    // dispose 后 request 应抛
    await expect(host.request('image.resize')).rejects.toThrow(/disposed/);
  });

  it('Worker 主动 event 应转发到 host event 监听器', async () => {
    const { host, current } = setup();
    await initReady(host, current);

    const events: { event: string; payload?: unknown }[] = [];
    host.on('event', (e) => events.push(e));

    current().emitToHost({ type: 'event', event: 'progress', payload: { ratio: 0.5 } });
    expect(events).toHaveLength(1);
    expect(events[0]!.event).toBe('progress');
    expect(events[0]!.payload).toEqual({ ratio: 0.5 });
  });
});

// ─── AbortSignal / cancel(W3.5)──────────────────────────────────

describe('WorkerHost request AbortSignal', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('signal 已 aborted 时应立即抛 WorkerRequestAbortedError(不发送)', async () => {
    const { host, current } = setup();
    await initReady(host, current);

    const sentBefore = current().sent.length;
    const controller = new AbortController();
    controller.abort();

    await expect(
      host.request('image.resize', {}, { signal: controller.signal })
    ).rejects.toBeInstanceOf(WorkerRequestAbortedError);

    // 不应发送任何 request 消息
    expect(current().sent.length).toBe(sentBefore);
  });

  it('请求发出后 abort 应:发 WorkerCancel + 立即 reject WorkerRequestAbortedError', async () => {
    const { host, current } = setup();
    await initReady(host, current);

    const controller = new AbortController();
    const reqP = host.request('image.resize', { width: 10 }, { signal: controller.signal });

    // 1. 应已发送 request 消息
    const sentMsg = current().lastSent as { id: string; type: string; method: string };
    expect(sentMsg.type).toBe('request');
    expect(sentMsg.method).toBe('image.resize');
    const reqId = sentMsg.id;

    // 2. 先挂 assertion,避免 abort 同步 reject 产生未处理 rejection
    const assertion = expect(reqP).rejects.toBeInstanceOf(WorkerRequestAbortedError);

    // 3. 触发 abort
    controller.abort();

    await assertion;

    // 4. 应已发送 WorkerCancel 消息(id 匹配)
    const cancelMsg = current().lastSent as { type: string; id: string };
    expect(cancelMsg.type).toBe('cancel');
    expect(cancelMsg.id).toBe(reqId);
  });

  it('abort 后 pending 应被清理(无泄漏)', async () => {
    const { host, current } = setup();
    await initReady(host, current);

    const controller = new AbortController();
    const reqP = host.request('image.resize', {}, { signal: controller.signal });
    const assertion = expect(reqP).rejects.toBeInstanceOf(WorkerRequestAbortedError);

    controller.abort();
    await assertion;

    // 即便 Worker 迟迟回响应,也不应再 resolve/reject(已从 pending 删除)
    const sentMsg = current().sent.find(
      (m) => (m as { type: string }).type === 'request'
    ) as { id: string };
    current().emitToHost({ id: sentMsg.id, type: 'response', ok: true, result: 'late' });
    // reqP 已 rejected,不会再次 settle
    await expect(reqP).rejects.toBeInstanceOf(WorkerRequestAbortedError);
  });

  it('未 abort 的 signal 不影响正常响应', async () => {
    const { host, current } = setup();
    await initReady(host, current);

    const controller = new AbortController();
    const reqP = host.request('image.resize', {}, { signal: controller.signal });
    const sent = current().lastSent as { id: string };

    current().emitToHost({ id: sent.id, type: 'response', ok: true, result: 'ok' });
    await expect(reqP).resolves.toBe('ok');
    expect(controller.signal.aborted).toBe(false);
  });

  it('abort 后 clearTimeout 应已执行(超时不再触发)', async () => {
    const { host, current } = setup({ requestTimeoutMs: 50 });
    await initReady(host, current);

    const controller = new AbortController();
    const reqP = host.request('image.resize', {}, { signal: controller.signal });
    const assertion = expect(reqP).rejects.toBeInstanceOf(WorkerRequestAbortedError);

    controller.abort();
    await assertion;

    // 推进超过 requestTimeout,不应再触发 TimeoutError(已 reject 为 Aborted)
    await vi.advanceTimersByTimeAsync(100);
    await expect(reqP).rejects.toBeInstanceOf(WorkerRequestAbortedError);
  });

  it('WorkerRequestAbortedError 应携带 method', async () => {
    const { host, current } = setup();
    await initReady(host, current);

    const controller = new AbortController();
    controller.abort();
    try {
      await host.request('image.compress', {}, { signal: controller.signal });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(WorkerRequestAbortedError);
      expect((e as WorkerRequestAbortedError).method).toBe('image.compress');
    }
  });
});
