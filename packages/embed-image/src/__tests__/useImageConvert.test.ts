/**
 * useImageConvert hook(Layer 0)单测。
 *
 * 测试覆盖:
 *   - 初始状态(默认 / 自定义 initialPreset)
 *   - IMAGE_CONVERT_PRESETS 常量正确性
 *   - handleFiles 透传给 useImageTool
 *   - autoRun:inputId 变化触发 runWorkflow(用 image.convert capability)
 *   - PNG 预设不传 quality
 *   - 有损格式预设传 quality
 *   - setPreset 在已有输入时立即重跑
 *   - setPreset 在 busy 时不重跑
 *   - onComplete 去重触发
 *   - reset / clearError 透传
 *   - outputFormat 透传
 *   - run() 手动触发
 *   - error / initError 透传
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { UseImageToolResult } from '../internal/useImageTool';
import { useImageConvert, IMAGE_CONVERT_PRESETS } from '../hooks/useImageConvert';
import { detectEncodeSupport } from '../internal/format-support';

// ─── mock useImageTool ─────────────────────────────────────

const stateRef: { current: UseImageToolResult } = {
  current: {} as UseImageToolResult,
};

vi.mock('../internal/useImageTool', () => ({
  useImageTool: () => stateRef.current,
}));

// jsdom 不实现 canvas.toBlob,真实 detectEncodeSupport 会挂起并泄漏控制台错误。
// mock 为"全部格式支持",与测试"浏览器能力齐全"的假设一致
// (静默回退检测本身已在 engine-image canvas-engine.test.ts 覆盖)。
vi.mock('../internal/format-support', () => ({
  detectEncodeSupport: vi.fn(async (formats: readonly string[]) => {
    const support: Record<string, boolean> = {};
    for (const fmt of formats) {
      support[fmt] = true;
    }
    return support;
  }),
}));

// wasm 兜底开关 mock:默认关闭(保持既有"纯原生门控"用例语义不变),
// wasm 专项用例按需 mockReturnValue(true)。
const wasmEncodersEnabledMock = vi.fn(() => false);
vi.mock('@lokvis/engine-image', () => ({
  wasmEncodersEnabled: () => wasmEncodersEnabledMock(),
}));

const runWorkflowMock = vi.fn();
const runWorkflowRawMock = vi.fn();
const handleFilesMock = vi.fn();
const resetMock = vi.fn();
const clearErrorMock = vi.fn();

function setMockState(overrides: Partial<UseImageToolResult> = {}) {
  stateRef.current = {
    runtime: null,
    ready: true,
    initError: null,
    inputId: null,
    inputUrl: null,
    inputInfo: null,
    outputBlob: null,
    outputUrl: null,
    outputInfo: null,
    busy: false,
    error: null,
    handleFiles: handleFilesMock,
    runWorkflow: runWorkflowMock,
    runWorkflowRaw: runWorkflowRawMock,
    reset: resetMock,
    clearError: clearErrorMock,
    ...overrides,
  };
}

function resetMocks() {
  runWorkflowMock.mockReset();
  runWorkflowRawMock.mockReset();
  handleFilesMock.mockReset();
  resetMock.mockReset();
  clearErrorMock.mockReset();
  wasmEncodersEnabledMock.mockReset();
  wasmEncodersEnabledMock.mockReturnValue(false);
}

describe('useImageConvert', () => {
  beforeEach(() => {
    resetMocks();
    setMockState();
  });

  describe('初始状态', () => {
    it('默认 preset 为 webp', () => {
      const { result } = renderHook(() => useImageConvert());
      expect(result.current.preset).toBe('webp');
    });

    it('initialPreset 可自定义', () => {
      const { result } = renderHook(() =>
        useImageConvert({ initialPreset: 'avif' })
      );
      expect(result.current.preset).toBe('avif');
    });

    it('初始 outputFormat 为 null(无输出)', () => {
      const { result } = renderHook(() => useImageConvert());
      expect(result.current.outputFormat).toBeNull();
    });

    it('透传 ready / inputUrl / outputUrl 等基础状态', () => {
      setMockState({
        ready: true,
        inputUrl: 'blob:input',
        outputUrl: 'blob:output',
      });
      const { result } = renderHook(() => useImageConvert());
      expect(result.current.ready).toBe(true);
      expect(result.current.inputUrl).toBe('blob:input');
      expect(result.current.outputUrl).toBe('blob:output');
    });
  });

  describe('IMAGE_CONVERT_PRESETS 常量', () => {
    it('png 预设无 quality(无损)', () => {
      expect(IMAGE_CONVERT_PRESETS['png'].format).toBe('png');
      expect(IMAGE_CONVERT_PRESETS['png'].quality).toBeUndefined();
    });

    it('webp 预设 quality=90', () => {
      expect(IMAGE_CONVERT_PRESETS['webp'].format).toBe('webp');
      expect(IMAGE_CONVERT_PRESETS['webp'].quality).toBe(90);
    });

    it('avif 预设 quality=80', () => {
      expect(IMAGE_CONVERT_PRESETS['avif'].format).toBe('avif');
      expect(IMAGE_CONVERT_PRESETS['avif'].quality).toBe(80);
    });

    it('jpeg 预设 quality=90', () => {
      expect(IMAGE_CONVERT_PRESETS['jpeg'].format).toBe('jpeg');
      expect(IMAGE_CONVERT_PRESETS['jpeg'].quality).toBe(90);
    });
  });

  describe('handleFiles', () => {
    it('透传给 useImageTool.handleFiles', async () => {
      const { result } = renderHook(() => useImageConvert());
      const files = [new File(['x'], 'a.png', { type: 'image/png' })];
      await act(async () => {
        await result.current.handleFiles(files);
      });
      expect(handleFilesMock).toHaveBeenCalledWith(files);
    });
  });

  describe('autoRun', () => {
    it('inputId 变化时触发 runWorkflow,使用 image.convert capability', async () => {
      const { rerender } = renderHook(() => useImageConvert());
      setMockState({ inputId: 'input-1', ready: true });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      expect(runWorkflowMock).toHaveBeenCalledTimes(1);
      const wf = runWorkflowMock.mock.calls[0]![0];
      expect(wf.nodes[0].capability).toBe('image.convert');
    });

    it('PNG 预设不传 quality', async () => {
      const { rerender } = renderHook(() =>
        useImageConvert({ initialPreset: 'png' })
      );
      setMockState({ inputId: 'input-1', ready: true });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      const params = runWorkflowMock.mock.calls[0]![0].nodes[0].params;
      expect(params.format).toBe('png');
      expect(params.quality).toBeUndefined();
    });

    it('WebP 预设传 quality=90', async () => {
      const { rerender } = renderHook(() =>
        useImageConvert({ initialPreset: 'webp' })
      );
      setMockState({ inputId: 'input-1', ready: true });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      const params = runWorkflowMock.mock.calls[0]![0].nodes[0].params;
      expect(params.format).toBe('webp');
      expect(params.quality).toBe(90);
    });

    it('AVIF 预设传 quality=80', async () => {
      const { rerender } = renderHook(() =>
        useImageConvert({ initialPreset: 'avif' })
      );
      setMockState({ inputId: 'input-1', ready: true });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      const params = runWorkflowMock.mock.calls[0]![0].nodes[0].params;
      expect(params.format).toBe('avif');
      expect(params.quality).toBe(80);
    });

    it('autoRun=false 时不自动触发', async () => {
      const { rerender } = renderHook(() =>
        useImageConvert({ autoRun: false })
      );
      setMockState({ inputId: 'input-1', ready: true });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      expect(runWorkflowMock).not.toHaveBeenCalled();
    });

    it('同一 inputId 不重复触发', async () => {
      const { rerender } = renderHook(() => useImageConvert());
      setMockState({ inputId: 'input-1', ready: true });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      setMockState({ inputId: 'input-1', ready: true });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      expect(runWorkflowMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('setPreset', () => {
    it('更新 preset 状态', () => {
      const { result } = renderHook(() => useImageConvert());
      act(() => {
        result.current.setPreset('avif');
      });
      expect(result.current.preset).toBe('avif');
    });

    it('已有输入时立即重跑', async () => {
      const { result } = renderHook(() => useImageConvert());
      setMockState({ inputId: 'input-1', ready: true });
      await act(async () => {
        result.current.setPreset('jpeg');
      });
      expect(runWorkflowMock).toHaveBeenCalled();
      const params = runWorkflowMock.mock.calls[0]![0].nodes[0].params;
      expect(params.format).toBe('jpeg');
      expect(params.quality).toBe(90);
    });

    it('busy 时不重跑(但仍更新 preset)', async () => {
      const { result, rerender } = renderHook(() => useImageConvert());
      // 先触发 autoRun
      setMockState({ inputId: 'input-1', ready: true });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      expect(runWorkflowMock).toHaveBeenCalledTimes(1);
      // 切到 busy,再切 preset
      setMockState({ inputId: 'input-1', ready: true, busy: true });
      rerender();
      act(() => {
        result.current.setPreset('png');
      });
      expect(result.current.preset).toBe('png');
      expect(runWorkflowMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('formatSupport', () => {
    it('检测完成后暴露各格式的真实编码支持', async () => {
      const { result } = renderHook(() => useImageConvert());
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.formatSupport).toEqual({
        png: true,
        webp: true,
        avif: true,
        jpeg: true,
      });
    });

    it('浏览器不支持的格式(如 avif)被标记为 false', async () => {
      vi.mocked(detectEncodeSupport).mockResolvedValueOnce({
        png: true,
        webp: true,
        avif: false,
        jpeg: true,
      });
      const { result } = renderHook(() => useImageConvert());
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.formatSupport?.avif).toBe(false);
      expect(result.current.formatSupport?.webp).toBe(true);
    });

    it('setPreset 拒绝不支持的预设(防止静默回退 PNG)', async () => {
      vi.mocked(detectEncodeSupport).mockResolvedValueOnce({
        png: true,
        webp: true,
        avif: false,
        jpeg: true,
      });
      const { result } = renderHook(() => useImageConvert());
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.formatSupport?.avif).toBe(false);
      act(() => {
        result.current.setPreset('avif');
      });
      // 预设保持默认 webp,不切换到不支持的 avif
      expect(result.current.preset).toBe('webp');
    });

    it('setPreset 允许支持的预设', async () => {
      vi.mocked(detectEncodeSupport).mockResolvedValueOnce({
        png: true,
        webp: true,
        avif: false,
        jpeg: true,
      });
      const { result } = renderHook(() => useImageConvert());
      await act(async () => {
        await Promise.resolve();
      });
      act(() => {
        result.current.setPreset('jpeg');
      });
      expect(result.current.preset).toBe('jpeg');
    });
  });

  describe('formatSupport wasm 兜底', () => {
    it('wasm 启用 + 原生缺 avif → avif 有效支持但标记为慢速', async () => {
      wasmEncodersEnabledMock.mockReturnValue(true);
      vi.mocked(detectEncodeSupport).mockResolvedValueOnce({
        png: true,
        webp: true,
        avif: false,
        jpeg: true,
      });
      const { result } = renderHook(() => useImageConvert());
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.formatSupport?.avif).toBe(true);
      expect(result.current.slowEncode?.avif).toBe(true);
    });

    it('wasm 启用 + 原生支持 avif → avif 支持且非慢速', async () => {
      wasmEncodersEnabledMock.mockReturnValue(true);
      vi.mocked(detectEncodeSupport).mockResolvedValueOnce({
        png: true,
        webp: true,
        avif: true,
        jpeg: true,
      });
      const { result } = renderHook(() => useImageConvert());
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.formatSupport?.avif).toBe(true);
      expect(result.current.slowEncode?.avif).toBe(false);
    });

    it('wasm 关闭 + 原生缺 avif → avif 不可用且非慢速', async () => {
      wasmEncodersEnabledMock.mockReturnValue(false);
      vi.mocked(detectEncodeSupport).mockResolvedValueOnce({
        png: true,
        webp: true,
        avif: false,
        jpeg: true,
      });
      const { result } = renderHook(() => useImageConvert());
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.formatSupport?.avif).toBe(false);
      expect(result.current.slowEncode?.avif).toBe(false);
    });

    it('wasm 兜底使 avif 可用时 setPreset 允许切换 avif', async () => {
      wasmEncodersEnabledMock.mockReturnValue(true);
      vi.mocked(detectEncodeSupport).mockResolvedValueOnce({
        png: true,
        webp: true,
        avif: false,
        jpeg: true,
      });
      const { result } = renderHook(() => useImageConvert());
      await act(async () => {
        await Promise.resolve();
      });
      act(() => {
        result.current.setPreset('avif');
      });
      expect(result.current.preset).toBe('avif');
    });

    it('检测中 slowEncode 为 null(与 formatSupport 一致)', () => {
      const { result } = renderHook(() => useImageConvert());
      expect(result.current.slowEncode).toBeNull();
    });

    it('非 avif 格式永不标记为慢速', async () => {
      wasmEncodersEnabledMock.mockReturnValue(true);
      const { result } = renderHook(() => useImageConvert());
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.slowEncode).toEqual({
        png: false,
        webp: false,
        avif: false,
        jpeg: false,
      });
    });
  });

  describe('onComplete', () => {
    it('outputBlob 出现时触发一次 onComplete', async () => {
      const onComplete = vi.fn();
      const { rerender } = renderHook(() =>
        useImageConvert({ onComplete })
      );
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 100, height: 100, size: 1000, format: 'PNG' },
        outputBlob: new Blob(['x']),
        outputUrl: 'blob:output',
        outputInfo: { width: 100, height: 100, size: 500, format: 'WEBP' },
      });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          outputBlob: expect.any(Blob),
          outputUrl: 'blob:output',
          inputSize: 1000,
          outputSize: 500,
          preset: 'webp',
        })
      );
    });

    it('同一 outputBlob 不重复触发', async () => {
      const onComplete = vi.fn();
      const { rerender } = renderHook(() =>
        useImageConvert({ onComplete })
      );
      const blob = new Blob(['x']);
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 100, height: 100, size: 1000, format: 'PNG' },
        outputBlob: blob,
        outputUrl: 'blob:output',
        outputInfo: { width: 100, height: 100, size: 500, format: 'WEBP' },
      });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('reset / clearError', () => {
    it('透传 reset', () => {
      const { result } = renderHook(() => useImageConvert());
      act(() => {
        result.current.reset();
      });
      expect(resetMock).toHaveBeenCalled();
    });

    it('透传 clearError', () => {
      const { result } = renderHook(() => useImageConvert());
      act(() => {
        result.current.clearError();
      });
      expect(clearErrorMock).toHaveBeenCalled();
    });
  });

  describe('outputFormat', () => {
    it('有 outputInfo 时返回 format', () => {
      setMockState({
        outputInfo: { width: 100, height: 100, size: 500, format: 'WEBP' },
      });
      const { result } = renderHook(() => useImageConvert());
      expect(result.current.outputFormat).toBe('WEBP');
    });

    it('无 outputInfo 时返回 null', () => {
      const { result } = renderHook(() => useImageConvert());
      expect(result.current.outputFormat).toBeNull();
    });
  });

  describe('run()', () => {
    it('手动触发 runWorkflow', async () => {
      const { result } = renderHook(() => useImageConvert());
      await act(async () => {
        await result.current.run();
      });
      expect(runWorkflowMock).toHaveBeenCalledTimes(1);
      const wf = runWorkflowMock.mock.calls[0]![0];
      expect(wf.nodes[0].capability).toBe('image.convert');
    });
  });

  describe('error / initError 透传', () => {
    it('透传 error', () => {
      setMockState({ error: 'workflow failed' });
      const { result } = renderHook(() => useImageConvert());
      expect(result.current.error).toBe('workflow failed');
    });

    it('透传 initError', () => {
      setMockState({ initError: 'runtime init failed' });
      const { result } = renderHook(() => useImageConvert());
      expect(result.current.initError).toBe('runtime init failed');
    });
  });
});
