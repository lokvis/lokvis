/**
 * Engine Image Worker Adapter 单元测试
 *
 * 覆盖:
 * - 方法表 / 未知方法 / 缺失输入
 * - startImageWorker 接线:ready 握手、ping→pong、request→response
 * - W21.4: BlobRef Transferable 零拷贝路径(Blob 结果抽 ArrayBuffer 入 transfer list)
 *
 * 通过 mock canvas-engine 在 Node 环境模拟真实图像操作(无需 OffscreenCanvas),
 * 真实端到端渲染由 plugin-image 集成测试覆盖。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── mock canvas-engine(W21.4:让 image.resize / image.probe 在 Node 可运行)──
// 所有操作依赖 canvasEngine.decode / encode、createCanvas、get2DContext。
// mock 后可验证 createImageWorkerHandler 对 Blob 结果的 transfer list 行为。
//
// 注意:本测试文件通过静态 import 加载 worker-adapter(→ operations → canvas-engine),
// vi.mock factory 会在 canvas-engine 被加载时立即执行,早于 const 声明的初始化。
// 因此必须用 vi.hoisted 提升 mock fn 声明,避免 TDZ(ReferenceError: Cannot access
// 'mockDecode' before initialization)。
// 对比 operations-signal.test.ts 用动态 import,无此问题。
const { mockDecode, mockEncode } = vi.hoisted(() => ({
  mockDecode: vi.fn(),
  mockEncode: vi.fn(),
}));

vi.mock('../canvas-engine.js', () => ({
  canvasEngine: {
    decode: mockDecode,
    encode: mockEncode,
  },
  createCanvas: vi.fn((w: number, h: number) => ({
    width: w,
    height: h,
    getContext: () => mockCtx(),
  })),
  get2DContext: vi.fn(() => mockCtx()),
  detectFormatSupport: vi.fn(async () => ({
    png: true,
    jpeg: true,
    webp: true,
    avif: false,
    gif: true,
  })),
}));

/** 桩 Canvas 2D Context(仅记录调用,不真正渲染) */
function mockCtx() {
  return {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 100 })),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    fillStyle: '',
    font: '',
    globalAlpha: 1,
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    filter: '',
    textBaseline: 'middle',
  };
}

import {
  createImageWorkerHandler,
  dispatchImageMethod,
  listImageWorkerMethods,
  startImageWorker,
  IMAGE_WORKER_PROTOCOL_VERSION,
} from '../worker-adapter.js';

/** 假 Worker 作用域(W21.4: 记录 transfer list) */
class FakeScope {
  posted: unknown[] = [];
  /** W21.4: 每条消息对应的 transfer list(undefined 表示未传) */
  transfers: (Transferable[] | undefined)[] = [];
  private handlers: Record<'message' | 'messageerror', Array<(ev: MessageEvent) => void>> = {
    message: [],
    messageerror: [],
  };
  postMessage(message: unknown, transfer?: Transferable[]): void {
    this.posted.push(message);
    this.transfers.push(transfer);
  }
  addEventListener(
    type: 'message' | 'messageerror',
    handler: (ev: MessageEvent) => void
  ): void {
    this.handlers[type].push(handler);
  }
  /** 模拟 Worker 收到主线程消息 */
  emit(data: unknown): void {
    for (const h of this.handlers.message) h({ data } as MessageEvent);
  }
  get last(): unknown {
    return this.posted[this.posted.length - 1];
  }
  /** W21.4: 最后一条消息的 transfer list */
  get lastTransfer(): Transferable[] | undefined {
    return this.transfers[this.transfers.length - 1];
  }
}

/** 等待微任务刷新(startImageWorker 的消息处理是 async) */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('listImageWorkerMethods / dispatchImageMethod', () => {
  it('应列出 9 个图像操作方法(与 canvas engine 能力对齐)', () => {
    const methods = listImageWorkerMethods();
    expect(methods).toHaveLength(9);
    expect(methods).toContain('image.resize');
    expect(methods).toContain('image.compress');
    expect(methods).toContain('image.watermark');
    expect(methods).toContain('image.background');
    expect(methods).toContain('image.filter');
  });

  it('未知方法应抛错', async () => {
    await expect(dispatchImageMethod('image.unknown', {})).rejects.toThrow(
      /Unknown image method/
    );
  });

  it('已知方法但缺少 input Blob 应抛错', async () => {
    await expect(
      dispatchImageMethod('image.resize', { options: { width: 10 } })
    ).rejects.toThrow(/requires params\.input/);
  });

  it('image.filter 已注册到 Worker 方法表(缺少 input 应抛 input 错误而非 Unknown)', async () => {
    await expect(
      dispatchImageMethod('image.filter', { options: { preset: 'grayscale' } })
    ).rejects.toThrow(/requires params\.input/);
  });

  it('image.probe 缺少 input 应抛错', async () => {
    await expect(dispatchImageMethod('image.probe', {})).rejects.toThrow(
      /requires params\.input/
    );
  });
});

describe('createImageWorkerHandler', () => {
  beforeEach(() => {
    mockDecode.mockReset();
    mockEncode.mockReset();
  });

  it('未知方法应返回 ok=false 响应,携带原 id', async () => {
    const handle = createImageWorkerHandler();
    const { response } = await handle({ id: 'r1', type: 'request', method: 'nope', params: {} });
    expect(response).toEqual({
      id: 'r1',
      type: 'response',
      ok: false,
      error: expect.objectContaining({ message: expect.stringMatching(/Unknown/) }),
    });
  });

  it('W21.4: 非 Blob 结果 transfer 应为空数组', async () => {
    // mock canvasEngine.decode 返回 fake bitmap,image.probe 真正走成功路径
    // 返回 ImageProbeResult(非 Blob),transfer 应为空
    mockDecode.mockResolvedValue({
      bitmap: { width: 100, height: 100, close: vi.fn() },
      width: 100,
      height: 100,
    });
    const handle = createImageWorkerHandler();
    const { response, transfer } = await handle({
      id: 'probe-1',
      type: 'request',
      method: 'image.probe',
      params: { input: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }) },
    });
    expect(response.ok).toBe(true);
    // 非 Blob 结果:result 是 ImageProbeResult 元数据对象(无 kind 字段)
    expect((response as { result: { kind?: string } }).result.kind).toBeUndefined();
    expect(transfer).toEqual([]);
  });

  it('W21.4: Blob 结果应封装为 BlobRef 信封,transfer list 含该 ArrayBuffer', async () => {
    // 模拟 image.resize 真实返回一个 Blob(经 canvasEngine.encode)
    const outBytes = new Uint8Array([1, 2, 3, 4, 5]);
    const outBlob = new Blob([outBytes], { type: 'image/png' });
    mockDecode.mockResolvedValue({
      bitmap: { width: 100, height: 100, close: vi.fn() },
      width: 100,
      height: 100,
    });
    mockEncode.mockResolvedValue(outBlob);

    const handle = createImageWorkerHandler();
    const { response, transfer } = await handle({
      id: 'resize-1',
      type: 'request',
      method: 'image.resize',
      params: {
        input: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }),
        options: { width: 50, height: 50 },
      },
    });

    // 1. 响应成功
    expect(response.ok).toBe(true);
    // 2. result 是 BlobRef 信封
    const result = (response as { result: unknown }).result as {
      kind: string;
      meta: { size: number; type: string };
      buffer: ArrayBuffer;
    };
    expect(result.kind).toBe('blob');
    expect(result.meta).toEqual({ size: outBlob.size, type: outBlob.type });
    expect(result.buffer).toBeInstanceOf(ArrayBuffer);
    expect(result.buffer.byteLength).toBe(outBytes.length);
    // 3. transfer list 恰好含 1 个 Transferable,且是同一个 ArrayBuffer(零拷贝)
    expect(transfer).toHaveLength(1);
    expect(transfer[0]).toBe(result.buffer);
    // 4. 重组验证:从 ArrayBuffer 能还原与原 Blob 等价的内容
    const rebuilt = new Blob([result.buffer], { type: result.meta.type });
    expect(rebuilt.size).toBe(outBlob.size);
    expect(rebuilt.type).toBe(outBlob.type);
  });

  it('W21.4: 不同 Blob 结果的 transfer list 互不干扰(每次请求独立)', async () => {
    const blob1 = new Blob([new Uint8Array([1, 2])], { type: 'image/png' });
    const blob2 = new Blob([new Uint8Array([3, 4, 5, 6])], { type: 'image/webp' });
    mockDecode.mockResolvedValue({
      bitmap: { width: 10, height: 10, close: vi.fn() },
      width: 10,
      height: 10,
    });
    const handle = createImageWorkerHandler();

    // 第一次请求 → blob1
    mockEncode.mockResolvedValueOnce(blob1);
    const r1 = await handle({
      id: 'req-1',
      type: 'request',
      method: 'image.resize',
      params: { input: new Blob([new Uint8Array([0])], { type: 'image/png' }), options: { width: 5 } },
    });
    // 第二次请求 → blob2
    mockEncode.mockResolvedValueOnce(blob2);
    const r2 = await handle({
      id: 'req-2',
      type: 'request',
      method: 'image.resize',
      params: { input: new Blob([new Uint8Array([0])], { type: 'image/png' }), options: { width: 8 } },
    });

    const ref1 = (r1.response as { result: { kind: string; buffer: ArrayBuffer } }).result;
    const ref2 = (r2.response as { result: { kind: string; buffer: ArrayBuffer } }).result;
    expect(ref1.kind).toBe('blob');
    expect(ref2.kind).toBe('blob');
    expect(ref1.buffer).not.toBe(ref2.buffer);
    expect(r1.transfer).toEqual([ref1.buffer]);
    expect(r2.transfer).toEqual([ref2.buffer]);
  });

  it('缺失 input 应返回 ok=false 响应', async () => {
    const handle = createImageWorkerHandler();
    const res = await handle({
      id: 'r2',
      type: 'request',
      method: 'image.resize',
      params: { options: { width: 10 } },
    });
    expect(res.response.id).toBe('r2');
    expect(res.response.ok).toBe(false);
  });
});

describe('startImageWorker', () => {
  beforeEach(() => {
    mockDecode.mockReset();
    mockEncode.mockReset();
  });

  it('启动即发送 ready,响应 ping→pong,request→response', async () => {
    const scope = new FakeScope();
    startImageWorker(scope);

    // 1. 立即发送 ready
    expect(scope.posted[0]).toEqual({
      type: 'ready',
      protocolVersion: IMAGE_WORKER_PROTOCOL_VERSION,
    });

    // 2. ping → pong
    scope.emit({ id: 'ping-1', type: 'ping', ts: 1 });
    await flush();
    expect(scope.last).toMatchObject({ id: 'ping-1', type: 'pong' });

    // 3. request(未知方法)→ response ok=false
    scope.emit({ id: 'req-1', type: 'request', method: 'nope', params: {} });
    await flush();
    expect(scope.last).toEqual({
      id: 'req-1',
      type: 'response',
      ok: false,
      error: expect.objectContaining({ message: expect.any(String) }),
    });
    // 未知方法无 Blob 结果,postMessage 未传 transfer list
    expect(scope.lastTransfer).toBeUndefined();
  });

  it('W21.4: Blob 结果应通过 postMessage(message, transfer) 零拷贝发送', async () => {
    // 端到端验证:startImageWorker 收到 image.resize request →
    // 处理返回 Blob → createImageWorkerHandler 抽 ArrayBuffer 入 transfer →
    // postMessage(response, [buffer]) 调用 FakeScope.postMessage 带 transfer list
    const outBlob = new Blob([new Uint8Array([10, 20, 30])], { type: 'image/png' });
    mockDecode.mockResolvedValue({
      bitmap: { width: 100, height: 100, close: vi.fn() },
      width: 100,
      height: 100,
    });
    mockEncode.mockResolvedValue(outBlob);

    const scope = new FakeScope();
    startImageWorker(scope);

    // 清空 ready 消息,便于后续断言
    scope.posted.length = 0;
    scope.transfers.length = 0;

    scope.emit({
      id: 'resize-end-to-end',
      type: 'request',
      method: 'image.resize',
      params: {
        input: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }),
        options: { width: 50, height: 50 },
      },
    });
    await flush();

    // 1. 响应消息已发送
    expect(scope.posted).toHaveLength(1);
    const msg = scope.last as {
      id: string;
      type: string;
      ok: boolean;
      result: { kind: string; meta: { size: number; type: string }; buffer: ArrayBuffer };
    };
    expect(msg.id).toBe('resize-end-to-end');
    expect(msg.type).toBe('response');
    expect(msg.ok).toBe(true);
    expect(msg.result.kind).toBe('blob');
    expect(msg.result.meta).toEqual({ size: outBlob.size, type: outBlob.type });
    // 2. transfer list 恰好含 result.buffer(零拷贝移交)
    expect(scope.lastTransfer).toBeDefined();
    expect(scope.lastTransfer).toHaveLength(1);
    expect(scope.lastTransfer![0]).toBe(msg.result.buffer);
    expect(scope.lastTransfer![0]).toBeInstanceOf(ArrayBuffer);
  });

  it('W21.4: 非 Blob 结果应通过 postMessage(message) 发送(无 transfer list)', async () => {
    // image.probe 返回元数据,postMessage 不传 transfer(或传空数组)
    mockDecode.mockResolvedValue({
      bitmap: { width: 100, height: 100, close: vi.fn() },
      width: 100,
      height: 100,
    });

    const scope = new FakeScope();
    startImageWorker(scope);
    scope.posted.length = 0;
    scope.transfers.length = 0;

    scope.emit({
      id: 'probe-end-to-end',
      type: 'request',
      method: 'image.probe',
      params: { input: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }) },
    });
    await flush();

    expect(scope.posted).toHaveLength(1);
    const msg = scope.last as { id: string; ok: boolean; result: { kind?: string } };
    expect(msg.ok).toBe(true);
    expect(msg.result.kind).toBeUndefined(); // 非 BlobRef
    // 非 Blob 结果:startImageWorker 走 postMessage(response) 无 transfer 分支
    // FakeScope.postMessage 第二参数缺省为 undefined
    expect(scope.lastTransfer).toBeUndefined();
  });

  it('非对象 / 未知 type 消息应被忽略(不抛错)', async () => {
    const scope = new FakeScope();
    startImageWorker(scope);
    const before = scope.posted.length;

    scope.emit(null);
    scope.emit({ type: 'something-else' });
    await flush();

    expect(scope.posted.length).toBe(before); // 没有新增响应
  });
});
