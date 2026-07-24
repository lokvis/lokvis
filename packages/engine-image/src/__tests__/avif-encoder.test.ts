/**
 * AVIF WASM 编码器 host 桥接（avif-encoder.ts）单测。
 *
 * encodeSmart 的分发矩阵已在 wasm-encode.test.ts 覆盖；本文件聚焦
 * host ↔ worker 桥接层的行为契约（设计文档 D2 / D5）：
 *
 * - Worker 单例：codec 初始化只发生一次，连续编码复用同一 worker
 * - pending Map 多路复用：并发请求按 id 分别 settle，乱序响应不串扰
 * - RGBA buffer 以 transferable 零拷贝传输，wasmUrl 随消息传递
 * - 取消语义（D5）：abort = terminate worker + 所有 in-flight 以 AbortError 拒绝
 *   （含发起方自身——预取消路径 throwIfAborted 同样抛 AbortError，语义一致）
 * - 崩溃重建：worker error 事件拒绝所有 in-flight 并清空单例，下次编码自动重建
 *
 * 通过 mock 全局 Worker（捕获 message/error handler + 记录 postMessage）
 * 在 Node 环境模拟 worker 通信；每个用例 vi.resetModules() 重建模块级单例，
 * 避免 worker / nextRequestId / pending 跨用例泄漏。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  AvifEncodeRequest,
  AvifEncodeResponse,
} from '../wasm/avif-encoder.js';

/** 假 Worker：记录 postMessage / transfer，暴露 emit 助手模拟 worker 回信 */
class MockWorker {
  static instances: MockWorker[] = [];
  readonly messageHandlers: Array<(e: MessageEvent) => void> = [];
  readonly errorHandlers: Array<() => void> = [];
  readonly posted: Array<{ msg: AvifEncodeRequest; transfer?: Transferable[] }> =
    [];
  terminated = false;

  constructor(_url: URL | string, _opts?: WorkerOptions) {
    MockWorker.instances.push(this);
  }

  addEventListener(type: 'message' | 'error', handler: (e: never) => void): void {
    if (type === 'message') {
      this.messageHandlers.push(handler as (e: MessageEvent) => void);
    } else {
      this.errorHandlers.push(handler as () => void);
    }
  }

  removeEventListener(): void {}

  postMessage(msg: AvifEncodeRequest, transfer?: Transferable[]): void {
    this.posted.push({ msg, transfer });
  }

  terminate(): void {
    this.terminated = true;
  }

  // ── 测试助手 ──────────────────────────────────────────────
  emitMessage(data: AvifEncodeResponse): void {
    for (const h of this.messageHandlers) {
      h({ data } as MessageEvent);
    }
  }

  emitError(): void {
    for (const h of this.errorHandlers) {
      h();
    }
  }
}

let encodeAvifWasm: typeof import('../wasm/avif-encoder.js').encodeAvifWasm;
let terminateAvifWorker: typeof import(
  '../wasm/avif-encoder.js'
).terminateAvifWorker;

/** 构造符合 ImageData 契约的假像素对象（Node 无 ImageData 全局） */
function fakeImageData(width = 2, height = 2): ImageData {
  return {
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height,
  } as ImageData;
}

function buf(...bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

beforeEach(async () => {
  MockWorker.instances = [];
  vi.stubGlobal('Worker', MockWorker);
  vi.resetModules();
  const mod = await import('../wasm/avif-encoder.js');
  encodeAvifWasm = mod.encodeAvifWasm;
  terminateAvifWorker = mod.terminateAvifWorker;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('encodeAvifWasm 成功路径', () => {
  it('编码请求经 postMessage 传递 RGBA buffer（transferable 零拷贝）+ wasmUrl', async () => {
    const img = fakeImageData(2, 2);
    const promise = encodeAvifWasm(img, 80);

    expect(MockWorker.instances).toHaveLength(1);
    const worker = MockWorker.instances[0]!;
    expect(worker.posted).toHaveLength(1);

    const { msg, transfer } = worker.posted[0]!;
    expect(msg.width).toBe(2);
    expect(msg.height).toBe(2);
    expect(msg.quality).toBe(80);
    // data 是像素 buffer 本体，且列入 transfer list（零拷贝移交）
    expect(msg.data).toBe(img.data.buffer);
    expect(transfer).toEqual([img.data.buffer]);
    // wasmUrl 由 host 侧 resolveAvifWasmUrl 解析后随消息传递（worker 独立 realm）
    expect(msg.wasmUrl).toMatch(/avif\.wasm$/);

    worker.emitMessage({ id: msg.id, ok: true, buffer: buf(0x42) });
    const blob = await promise;
    expect(blob.type).toBe('image/avif');
    expect(blob.size).toBe(1);
  });

  it('响应 resolve 为 image/avif Blob，内容来自 worker 返回的 buffer', async () => {
    const promise = encodeAvifWasm(fakeImageData(), 80);
    const worker = MockWorker.instances[0]!;
    const { id } = worker.posted[0]!.msg;

    worker.emitMessage({ id, ok: true, buffer: buf(10, 20, 30) });
    const blob = await promise;
    expect(blob.type).toBe('image/avif');
    expect(blob.size).toBe(3);
    expect(Array.from(new Uint8Array(await blob.arrayBuffer()))).toEqual([
      10, 20, 30,
    ]);
  });
});

describe('Worker 单例与多路复用', () => {
  it('连续编码复用同一 worker 单例（codec 只初始化一次）', async () => {
    const p1 = encodeAvifWasm(fakeImageData(), 80);
    const p2 = encodeAvifWasm(fakeImageData(), 80);

    expect(MockWorker.instances).toHaveLength(1);
    const worker = MockWorker.instances[0]!;
    expect(worker.posted).toHaveLength(2);

    const id1 = worker.posted[0]!.msg.id;
    const id2 = worker.posted[1]!.msg.id;
    expect(id2).toBe(id1 + 1);

    worker.emitMessage({ id: id1, ok: true, buffer: buf(1) });
    worker.emitMessage({ id: id2, ok: true, buffer: buf(2) });
    await Promise.all([p1, p2]);
  });

  it('并发请求按 id 分别 settle（乱序响应不串扰）', async () => {
    const p1 = encodeAvifWasm(fakeImageData(), 80);
    const p2 = encodeAvifWasm(fakeImageData(), 80);
    const worker = MockWorker.instances[0]!;
    const id1 = worker.posted[0]!.msg.id;
    const id2 = worker.posted[1]!.msg.id;

    // 乱序：先回 id2 再回 id1
    worker.emitMessage({ id: id2, ok: true, buffer: buf(0xaa) });
    worker.emitMessage({ id: id1, ok: true, buffer: buf(0xbb) });

    const [b1, b2] = await Promise.all([p1, p2]);
    expect(new Uint8Array(await b1.arrayBuffer())[0]).toBe(0xbb);
    expect(new Uint8Array(await b2.arrayBuffer())[0]).toBe(0xaa);
  });

  it('未知 id 的响应被忽略（不抛错，不影响正常请求 settle）', async () => {
    const promise = encodeAvifWasm(fakeImageData(), 80);
    const worker = MockWorker.instances[0]!;
    const { id } = worker.posted[0]!.msg;

    // 无对应 pending 的 id：静默忽略
    worker.emitMessage({ id: 999, ok: true, buffer: buf(1) });
    // 正常响应仍能 resolve
    worker.emitMessage({ id, ok: true, buffer: buf(7) });

    const blob = await promise;
    expect(new Uint8Array(await blob.arrayBuffer())[0]).toBe(7);
  });
});

describe('错误与取消语义（D5）', () => {
  it('worker 返回 ok=false 时 reject 为 Error，携带错误消息', async () => {
    const promise = encodeAvifWasm(fakeImageData(), 80);
    const worker = MockWorker.instances[0]!;
    const { id } = worker.posted[0]!.msg;

    worker.emitMessage({ id, ok: false, error: 'AVIF encoding failed' });
    await expect(promise).rejects.toThrow('AVIF encoding failed');
  });

  it('预取消的 signal 立即拒绝（AbortError），不创建 worker', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      encodeAvifWasm(fakeImageData(), 80, controller.signal)
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(MockWorker.instances).toHaveLength(0);
  });

  it('编码中途 abort：发起方与并发请求均以 AbortError 拒绝，worker 被 terminate', async () => {
    const controller = new AbortController();
    const pAbort = encodeAvifWasm(fakeImageData(), 80, controller.signal);
    const pOther = encodeAvifWasm(fakeImageData(), 80);
    const worker = MockWorker.instances[0]!;

    controller.abort();

    // 发起方自身也须 settle（AbortError），而非悬挂
    await expect(pAbort).rejects.toMatchObject({ name: 'AbortError' });
    // 并发 in-flight 请求一并失败
    await expect(pOther).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.terminated).toBe(true);
  });

  it('abort 后下一次编码重建 worker 单例', async () => {
    const controller = new AbortController();
    const p1 = encodeAvifWasm(fakeImageData(), 80, controller.signal);
    controller.abort();
    await expect(p1).rejects.toMatchObject({ name: 'AbortError' });
    expect(MockWorker.instances).toHaveLength(1);

    const p2 = encodeAvifWasm(fakeImageData(), 80);
    expect(MockWorker.instances).toHaveLength(2);
    const worker2 = MockWorker.instances[1]!;
    const { id } = worker2.posted[0]!.msg;
    worker2.emitMessage({ id, ok: true, buffer: buf(5) });
    await p2;
  });

  it('worker 崩溃（error 事件）：拒绝所有 in-flight，清空单例使下次重建', async () => {
    const promise = encodeAvifWasm(fakeImageData(), 80);
    const worker = MockWorker.instances[0]!;

    worker.emitError();
    await expect(promise).rejects.toThrow('AVIF encoder worker crashed');

    const p2 = encodeAvifWasm(fakeImageData(), 80);
    expect(MockWorker.instances).toHaveLength(2);
    const worker2 = MockWorker.instances[1]!;
    const { id } = worker2.posted[0]!.msg;
    worker2.emitMessage({ id, ok: true, buffer: buf(9) });
    await p2;
  });
});

describe('terminateAvifWorker', () => {
  it('无 worker 时调用不抛错（幂等）', () => {
    expect(() => terminateAvifWorker()).not.toThrow();
  });

  it('终止当前单例后，下次编码重建新 worker', async () => {
    const promise = encodeAvifWasm(fakeImageData(), 80);
    const worker = MockWorker.instances[0]!;
    const { id } = worker.posted[0]!.msg;
    worker.emitMessage({ id, ok: true, buffer: buf(1) });
    await promise;

    terminateAvifWorker();
    expect(worker.terminated).toBe(true);

    const p2 = encodeAvifWasm(fakeImageData(), 80);
    expect(MockWorker.instances).toHaveLength(2);
    const worker2 = MockWorker.instances[1]!;
    const id2 = worker2.posted[0]!.msg.id;
    worker2.emitMessage({ id: id2, ok: true, buffer: buf(2) });
    await p2;
  });
});
