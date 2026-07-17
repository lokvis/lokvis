/**
 * Engine Image Worker Adapter 单元测试
 *
 * 仅覆盖不依赖 Canvas / createImageBitmap 的路径:
 * - 方法表 / 未知方法 / 缺失输入
 * - startImageWorker 接线:ready 握手、ping→pong、request→response
 *
 * 真实图像处理(需 OffscreenCanvas)由 plugin-image 集成测试覆盖。
 */
import { describe, it, expect } from 'vitest';
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
    const handle = createImageWorkerHandler();
    // image.probe 返回元数据(非 Blob),transfer 应为空
    const { transfer } = await handle({
      id: 'probe-1',
      type: 'request',
      method: 'image.probe',
      params: { input: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }) },
    });
    expect(transfer).toEqual([]);
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
