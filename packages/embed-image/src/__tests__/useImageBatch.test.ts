/**
 * useImageBatch hook 单测(Layer 0)。
 *
 * 测试覆盖:
 *   - 初始状态(ready / items / busy / 统计)
 *   - addFiles 生成唯一 key + inputUrl(queued)
 *   - 顺序调度(任一时刻最多一个 processing)
 *   - buildParams 按 item 的 inputInfo 计算参数
 *   - 单 item 失败不中断后续(失败落在 item.error)
 *   - paramsKey 变化 → 非 processing item 重置 queued 重跑(buildParams 读最新闭包)
 *   - removeItem / reset 释放 ObjectURL
 *   - onBatchComplete 整批完成只触发一次,统计正确
 *
 * useLokvisRuntime 与 getImageInfo 被 mock;buildSingleStepImageWorkflow 用真实实现。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

// ─── mock useLokvisRuntime:runtime 由 ref 持有 ──────────
const runtimeRef: { current: MockRuntime | null } = { current: null };
const runtimeCallArgs: Array<{ auth: unknown; plugins: unknown }> = [];
vi.mock('../internal/useLokvisRuntime', () => ({
  useLokvisRuntime: (auth: unknown, plugins: unknown) => {
    runtimeCallArgs.push({ auth, plugins });
    return {
      runtime: runtimeRef.current,
      ready: runtimeRef.current !== null,
      error: null,
    };
  },
}));

// ─── mock getImageInfo:jsdom 无 Image().decode / ObjectURL ──
vi.mock('../internal/download', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../internal/download')>();
  return {
    ...actual,
    getImageInfo: vi.fn(async (blob: Blob) => ({
      width: 100,
      height: 100,
      size: blob.size,
      format: 'PNG',
    })),
  };
});

import { useImageBatch, type UseImageBatchOptions } from '../hooks/useImageBatch';

// ─── mock runtime ────────────────────────────────────────
interface MockRuntime {
  importAsset: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
  exportAsset: ReturnType<typeof vi.fn>;
}

let assetCounter = 0;
let urlCounter = 0;
let inFlight = 0;
let maxInFlight = 0;

const importAssetMock = vi.fn(async () => `asset-${++assetCounter}`);
const exportAssetMock = vi.fn(async () => new Blob(['output'], { type: 'image/webp' }));
const runMock = vi.fn();

const mockRuntime: MockRuntime = {
  importAsset: importAssetMock,
  run: runMock,
  exportAsset: exportAssetMock,
};

/** 默认 run:成功且记录并发数(验证顺序调度) */
function setRunSuccess() {
  runMock.mockImplementation(async () => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await Promise.resolve();
    inFlight--;
    return { status: 'completed', outputs: ['out'], error: undefined };
  });
}

// ─── 工具函数 ────────────────────────────────────────────

/** 逐个推进异步处理链:每轮让出一个微任务并刷新 React 挂起工作 */
async function flush(rounds = 80) {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function makeFile(name: string, content: string): File {
  return new File([content], name, { type: 'image/png' });
}

function makeOptions(overrides: Partial<UseImageBatchOptions> = {}): UseImageBatchOptions {
  return {
    capability: 'image.resize',
    buildParams: () => ({ width: 100 }),
    paramsKey: 'k1',
    ...overrides,
  };
}

beforeEach(() => {
  assetCounter = 0;
  urlCounter = 0;
  inFlight = 0;
  maxInFlight = 0;
  runtimeCallArgs.length = 0;
  importAssetMock.mockReset();
  importAssetMock.mockImplementation(async () => `asset-${++assetCounter}`);
  exportAssetMock.mockReset();
  exportAssetMock.mockImplementation(async () => new Blob(['output'], { type: 'image/webp' }));
  runMock.mockReset();
  setRunSuccess();
  runtimeRef.current = mockRuntime;
  // jsdom 未实现 ObjectURL API
  URL.createObjectURL = vi.fn(() => `blob:mock-${++urlCounter}`);
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
});

describe('useImageBatch', () => {
  it('初始状态:ready=true / items 为空 / busy=false / 统计为 0', () => {
    const { result } = renderHook(() => useImageBatch(makeOptions()));
    expect(result.current.ready).toBe(true);
    expect(result.current.initError).toBeNull();
    expect(result.current.items).toEqual([]);
    expect(result.current.busy).toBe(false);
    expect(result.current.doneCount).toBe(0);
    expect(result.current.totalInputBytes).toBe(0);
    expect(result.current.totalOutputBytes).toBe(0);
  });

  it('runtime 未就绪时 ready=false', () => {
    runtimeRef.current = null;
    const { result } = renderHook(() => useImageBatch(makeOptions()));
    expect(result.current.ready).toBe(false);
  });

  it('plugins 透传给 useLokvisRuntime(W23)', () => {
    const plugins: never[] = [];
    renderHook(() => useImageBatch(makeOptions({ plugins })));
    expect(runtimeCallArgs[0]?.plugins).toBe(plugins);
  });

  it('addFiles 生成唯一 key 与 inputUrl,状态为 queued', () => {
    // runtime 未就绪:隔离 addFiles 行为,条目全部停留 queued(不启动调度)
    runtimeRef.current = null;
    const { result } = renderHook(() => useImageBatch(makeOptions()));
    act(() => {
      result.current.addFiles([makeFile('a.png', 'abc'), makeFile('a.png', 'abc')]);
    });
    const items = result.current.items;
    expect(items).toHaveLength(2);
    // 同 name/size/lastModified 的文件 key 仍唯一(序号递增)
    expect(items[0]!.key).not.toBe(items[1]!.key);
    expect(items[0]!.status).toBe('queued');
    expect(items[1]!.status).toBe('queued');
    expect(items[0]!.inputUrl).toBe('blob:mock-1');
    expect(items[1]!.inputUrl).toBe('blob:mock-2');
    expect(result.current.totalInputBytes).toBe(6);
  });

  it('顺序调度:多个文件依次处理,任一时刻最多一个 processing', async () => {
    const { result } = renderHook(() => useImageBatch(makeOptions()));
    act(() => {
      result.current.addFiles([makeFile('a.png', 'a'), makeFile('b.png', 'bb'), makeFile('c.png', 'ccc')]);
    });
    await flush();

    expect(result.current.items.every((i) => i.status === 'done')).toBe(true);
    expect(importAssetMock).toHaveBeenCalledTimes(3);
    expect(runMock).toHaveBeenCalledTimes(3);
    expect(exportAssetMock).toHaveBeenCalledTimes(3);
    // 并发峰值为 1 → 严格顺序
    expect(maxInFlight).toBe(1);
    expect(result.current.doneCount).toBe(3);
  });

  it('buildParams 以 item 的 inputInfo 计算参数并传入 workflow', async () => {
    const buildParams = vi.fn((info: { width: number } | null) => ({
      width: info ? info.width / 2 : 0,
    }));
    const { result } = renderHook(() => useImageBatch(makeOptions({ buildParams })));
    act(() => {
      result.current.addFiles([makeFile('a.png', 'abc')]);
    });
    await flush();

    expect(buildParams).toHaveBeenCalled();
    // inputInfo 由 getImageInfo 提供(width=100)
    expect(buildParams.mock.calls[0]?.[0]).toMatchObject({ width: 100 });
    const wf = runMock.mock.calls[0]?.[0];
    expect(wf.nodes[0].capability).toBe('image.resize');
    expect(wf.nodes[0].params.width).toBe(50);
    // 输出信息落库
    expect(result.current.items[0]!.outputInfo).toMatchObject({ size: 6 });
    expect(result.current.totalOutputBytes).toBe(6);
  });

  it('单 item 失败不中断后续,失败信息落在 item.error', async () => {
    let call = 0;
    runMock.mockImplementation(async () => {
      call++;
      if (call === 2) return { status: 'failed', outputs: [], error: 'boom' };
      return { status: 'completed', outputs: ['out'], error: undefined };
    });
    const { result } = renderHook(() => useImageBatch(makeOptions()));
    act(() => {
      result.current.addFiles([makeFile('a.png', 'a'), makeFile('b.png', 'b'), makeFile('c.png', 'c')]);
    });
    await flush();

    const statuses = result.current.items.map((i) => i.status);
    expect(statuses).toEqual(['done', 'error', 'done']);
    expect(result.current.items[1]!.error).toBe('boom');
    // 三个 item 都尝试执行(失败不中断)
    expect(runMock).toHaveBeenCalledTimes(3);
    expect(result.current.doneCount).toBe(2);
  });

  it('paramsKey 变化时非 processing item 重置 queued 并用最新 buildParams 重跑', async () => {
    const buildParams1 = vi.fn(() => ({ width: 100 }));
    const { result, rerender } = renderHook(
      (opts: UseImageBatchOptions) => useImageBatch(opts),
      { initialProps: makeOptions({ buildParams: buildParams1 }) }
    );
    act(() => {
      result.current.addFiles([makeFile('a.png', 'abc')]);
    });
    await flush();
    expect(result.current.items[0]!.status).toBe('done');
    expect(runMock).toHaveBeenCalledTimes(1);

    // 切换 paramsKey + 新 buildParams
    const buildParams2 = vi.fn(() => ({ width: 200 }));
    rerender(makeOptions({ buildParams: buildParams2, paramsKey: 'k2' }));
    await flush();

    expect(result.current.items[0]!.status).toBe('done');
    expect(runMock).toHaveBeenCalledTimes(2);
    // 第二次使用最新闭包(buildParams2)
    expect(buildParams2).toHaveBeenCalled();
    expect(runMock.mock.calls[1]?.[0].nodes[0].params.width).toBe(200);
  });

  it('removeItem 移除条目并 revoke 其 inputUrl', () => {
    const { result } = renderHook(() => useImageBatch(makeOptions()));
    act(() => {
      result.current.addFiles([makeFile('a.png', 'a'), makeFile('b.png', 'b')]);
    });
    const key = result.current.items[0]!.key;
    act(() => {
      result.current.removeItem(key);
    });
    expect(result.current.items).toHaveLength(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-1');
  });

  it('reset 清空全部条目并 revoke 所有 inputUrl', () => {
    const { result } = renderHook(() => useImageBatch(makeOptions()));
    act(() => {
      result.current.addFiles([makeFile('a.png', 'a'), makeFile('b.png', 'b')]);
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.items).toEqual([]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-1');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-2');
  });

  it('onBatchComplete 整批完成只触发一次,统计正确', async () => {
    let call = 0;
    runMock.mockImplementation(async () => {
      call++;
      if (call === 2) return { status: 'failed', outputs: [], error: 'boom' };
      return { status: 'completed', outputs: ['out'], error: undefined };
    });
    const onBatchComplete = vi.fn();
    const { result } = renderHook(() => useImageBatch(makeOptions({ onBatchComplete })));
    act(() => {
      result.current.addFiles([makeFile('a.png', 'abc'), makeFile('b.png', 'abcd')]);
    });
    await flush();

    expect(onBatchComplete).toHaveBeenCalledTimes(1);
    expect(onBatchComplete).toHaveBeenCalledWith({
      total: 2,
      done: 1,
      failed: 1,
      inputBytes: 7,
      outputBytes: 6,
    });
  });
});
