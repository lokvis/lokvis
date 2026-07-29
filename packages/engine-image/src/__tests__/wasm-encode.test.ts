/**
 * encodeSmart 统一编码分发测试（native-first / wasm-fallback）
 *
 * 覆盖分发矩阵：
 * - png/jpeg 恒真短路（不触发原生探测）
 * - 原生支持的格式走 canvas 路径
 * - 原生探测结果模块级缓存（探测一次）
 * - avif 原生不支持 + wasm 启用 → encodeAvifWasm（getImageData 提取像素）
 * - avif 原生不支持 + wasm 禁用 → 回退 encodeImage（保持 throw 语义）
 * - avif 原生不支持 + 无 Worker 环境（Node/SSR）→ 回退 encodeImage
 * - 无兜底格式（gif）→ 回退 encodeImage（保持 throw 语义）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCanvasEncode = vi.fn();
const mockDetectFormatSupport = vi.fn();
const mockGetImageData = vi.fn();
const mockEncodeAvifWasm = vi.fn();

vi.mock('../canvas-engine.js', () => ({
  encodeImage: mockCanvasEncode,
  detectFormatSupport: mockDetectFormatSupport,
  get2DContext: vi.fn(() => ({ getImageData: mockGetImageData })),
}));

vi.mock('../wasm/avif-encoder.js', () => ({
  encodeAvifWasm: mockEncodeAvifWasm,
}));

const { encodeSmart, clearNativeSupportCache } = await import(
  '../operations/wasm-encode.js'
);
const { configureWasmEncoders, resetWasmEncoderConfig } = await import(
  '../wasm-config.js'
);

const fakeCanvas = { width: 2, height: 2 } as OffscreenCanvas;
const fakeImageData = {
  data: new Uint8ClampedArray(2 * 2 * 4),
  width: 2,
  height: 2,
};
const AVIF_BLOB = new Blob([new Uint8Array([1])], { type: 'image/avif' });
const CANVAS_BLOB = new Blob([new Uint8Array([2])], { type: 'image/webp' });

function mockNativeSupport(support: Record<string, boolean>) {
  mockDetectFormatSupport.mockResolvedValue({
    png: true,
    jpeg: true,
    webp: false,
    avif: false,
    gif: false,
    ...support,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  clearNativeSupportCache();
  resetWasmEncoderConfig();
  vi.stubGlobal('Worker', class {});
  mockCanvasEncode.mockResolvedValue(CANVAS_BLOB);
  mockEncodeAvifWasm.mockResolvedValue(AVIF_BLOB);
  mockGetImageData.mockReturnValue(fakeImageData);
  mockNativeSupport({ webp: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('encodeSmart 原生路径', () => {
  it('png 短路走 canvas 编码，不触发原生探测', async () => {
    const out = await encodeSmart(fakeCanvas, 'png', 95);
    expect(out).toBe(CANVAS_BLOB);
    expect(mockCanvasEncode).toHaveBeenCalledWith(fakeCanvas, 'png', 95);
    expect(mockDetectFormatSupport).not.toHaveBeenCalled();
  });

  it('jpeg 短路走 canvas 编码，不触发原生探测', async () => {
    await encodeSmart(fakeCanvas, 'jpeg', 85);
    expect(mockCanvasEncode).toHaveBeenCalledWith(fakeCanvas, 'jpeg', 85);
    expect(mockDetectFormatSupport).not.toHaveBeenCalled();
  });

  it('原生支持的格式（webp）走 canvas 编码', async () => {
    const out = await encodeSmart(fakeCanvas, 'webp', 80);
    expect(out).toBe(CANVAS_BLOB);
    expect(mockCanvasEncode).toHaveBeenCalledWith(fakeCanvas, 'webp', 80);
    expect(mockEncodeAvifWasm).not.toHaveBeenCalled();
  });

  it('原生探测结果模块级缓存：多次编码只探测一次', async () => {
    await encodeSmart(fakeCanvas, 'webp', 80);
    await encodeSmart(fakeCanvas, 'avif', 80);
    await encodeSmart(fakeCanvas, 'webp', 60);
    expect(mockDetectFormatSupport).toHaveBeenCalledTimes(1);
  });
});

describe('encodeSmart WASM 兜底路径', () => {
  it('avif 原生不支持 + wasm 启用 → encodeAvifWasm，不经过 canvas 编码', async () => {
    mockNativeSupport({ avif: false });
    const signal = new AbortController().signal;
    const out = await encodeSmart(fakeCanvas, 'avif', 50, signal);
    expect(out).toBe(AVIF_BLOB);
    expect(mockGetImageData).toHaveBeenCalledWith(0, 0, 2, 2);
    expect(mockEncodeAvifWasm).toHaveBeenCalledWith(fakeImageData, 50, signal);
    expect(mockCanvasEncode).not.toHaveBeenCalled();
  });

  it('avif 原生支持时不加载 wasm（native-first）', async () => {
    mockNativeSupport({ avif: true });
    const out = await encodeSmart(fakeCanvas, 'avif', 50);
    expect(out).toBe(CANVAS_BLOB);
    expect(mockCanvasEncode).toHaveBeenCalledWith(fakeCanvas, 'avif', 50);
    expect(mockEncodeAvifWasm).not.toHaveBeenCalled();
  });

  it('wasm 禁用（configureWasmEncoders enabled:false）→ 回退 canvas 编码保持 throw 语义', async () => {
    mockNativeSupport({ avif: false });
    configureWasmEncoders({ enabled: false });
    mockCanvasEncode.mockRejectedValueOnce(
      new Error("This browser does not support encoding 'avif'")
    );
    await expect(encodeSmart(fakeCanvas, 'avif', 50)).rejects.toThrow(
      /does not support encoding 'avif'/
    );
    expect(mockEncodeAvifWasm).not.toHaveBeenCalled();
  });

  it('无 Worker 环境（Node/SSR）→ 回退 canvas 编码', async () => {
    mockNativeSupport({ avif: false });
    vi.stubGlobal('Worker', undefined);
    await encodeSmart(fakeCanvas, 'avif', 50);
    expect(mockCanvasEncode).toHaveBeenCalledWith(fakeCanvas, 'avif', 50);
    expect(mockEncodeAvifWasm).not.toHaveBeenCalled();
  });

  it('无兜底格式（gif 原生不支持）→ 回退 canvas 编码保持 throw 语义', async () => {
    mockNativeSupport({ gif: false });
    await encodeSmart(fakeCanvas, 'gif', 95);
    expect(mockCanvasEncode).toHaveBeenCalledWith(fakeCanvas, 'gif', 95);
    expect(mockEncodeAvifWasm).not.toHaveBeenCalled();
  });
});
