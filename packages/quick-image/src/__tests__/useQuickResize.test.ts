/**
 * useQuickResize hook(Layer 0)单测。
 *
 * 测试覆盖:
 *   - 初始状态(默认 / 自定义 initialPreset)
 *   - RESIZE_PRESETS 常量正确性
 *   - handleFiles 透传给 useImageTool
 *   - autoRun:inputId 变化触发 runWorkflow(用 image.resize capability)
 *   - setPreset 在已有输入时立即重跑
 *   - setPreset 在 busy 时不重跑
 *   - 'half' 预设根据 inputInfo 计算目标尺寸
 *   - 固定尺寸预设直接传 width/height
 *   - onComplete 去重触发
 *   - reset / clearError 透传
 *   - outputDimension 字符串拼接
 *   - run() 手动触发
 *   - error / initError 透传
 *
 * useImageTool 被整体 mock,通过 stateRef 动态控制状态。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { UseImageToolResult } from '../internal/useImageTool';
import { useQuickResize, RESIZE_PRESETS } from '../hooks/useQuickResize';

// ─── mock useImageTool ─────────────────────────────────────

const stateRef: { current: UseImageToolResult } = {
  current: {} as UseImageToolResult,
};

vi.mock('../internal/useImageTool', () => ({
  useImageTool: () => stateRef.current,
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
}

describe('useQuickResize', () => {
  beforeEach(() => {
    resetMocks();
    setMockState();
  });

  describe('初始状态', () => {
    it('默认 preset 为 ig-square', () => {
      const { result } = renderHook(() => useQuickResize());
      expect(result.current.preset).toBe('ig-square');
    });

    it('initialPreset 可自定义', () => {
      const { result } = renderHook(() =>
        useQuickResize({ initialPreset: 'tk-portrait' })
      );
      expect(result.current.preset).toBe('tk-portrait');
    });

    it('初始 outputDimension 为 null(无输出)', () => {
      const { result } = renderHook(() => useQuickResize());
      expect(result.current.outputDimension).toBeNull();
    });

    it('透传 ready / inputUrl / outputUrl 等基础状态', () => {
      setMockState({
        ready: true,
        inputUrl: 'blob:input',
        outputUrl: 'blob:output',
      });
      const { result } = renderHook(() => useQuickResize());
      expect(result.current.ready).toBe(true);
      expect(result.current.inputUrl).toBe('blob:input');
      expect(result.current.outputUrl).toBe('blob:output');
    });
  });

  describe('RESIZE_PRESETS 常量', () => {
    it('ig-square 为 1080×1080', () => {
      expect(RESIZE_PRESETS['ig-square'].width).toBe(1080);
      expect(RESIZE_PRESETS['ig-square'].height).toBe(1080);
      expect(RESIZE_PRESETS['ig-square'].scale).toBeUndefined();
    });

    it('yt-landscape 为 1280×720', () => {
      expect(RESIZE_PRESETS['yt-landscape'].width).toBe(1280);
      expect(RESIZE_PRESETS['yt-landscape'].height).toBe(720);
    });

    it('tk-portrait 为 1080×1920', () => {
      expect(RESIZE_PRESETS['tk-portrait'].width).toBe(1080);
      expect(RESIZE_PRESETS['tk-portrait'].height).toBe(1920);
    });

    it('half 为 scale=0.5,无固定尺寸', () => {
      expect(RESIZE_PRESETS['half'].scale).toBe(0.5);
      expect(RESIZE_PRESETS['half'].width).toBeUndefined();
      expect(RESIZE_PRESETS['half'].height).toBeUndefined();
    });
  });

  describe('handleFiles', () => {
    it('透传给 useImageTool.handleFiles', async () => {
      const { result } = renderHook(() => useQuickResize());
      const files = [new File(['x'], 'a.png', { type: 'image/png' })];
      await act(async () => {
        await result.current.handleFiles(files);
      });
      expect(handleFilesMock).toHaveBeenCalledWith(files);
    });
  });

  describe('autoRun', () => {
    it('inputId 变化时触发 runWorkflow,使用 image.resize capability', async () => {
      const { rerender } = renderHook(() => useQuickResize());
      setMockState({ inputId: 'input-1', ready: true });
      rerender();
      // 等待 useEffect 触发
      await act(async () => {
        await Promise.resolve();
      });
      expect(runWorkflowMock).toHaveBeenCalledTimes(1);
      const wf = runWorkflowMock.mock.calls[0]![0];
      expect(wf.nodes[0].capability).toBe('image.resize');
    });

    it('固定尺寸预设传入正确 width/height', async () => {
      const { rerender } = renderHook(() =>
        useQuickResize({ initialPreset: 'ig-square' })
      );
      setMockState({ inputId: 'input-1', ready: true });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      const params = runWorkflowMock.mock.calls[0]![0].nodes[0].params;
      expect(params.width).toBe(1080);
      expect(params.height).toBe(1080);
    });

    it('half 预设根据 inputInfo 计算目标尺寸', async () => {
      const { rerender } = renderHook(() =>
        useQuickResize({ initialPreset: 'half' })
      );
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 2000, height: 1000, size: 5000, format: 'PNG' },
      });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      const params = runWorkflowMock.mock.calls[0]![0].nodes[0].params;
      expect(params.width).toBe(1000);
      expect(params.height).toBe(500);
    });

    it('autoRun=false 时不自动触发', async () => {
      const { rerender } = renderHook(() =>
        useQuickResize({ autoRun: false })
      );
      setMockState({ inputId: 'input-1', ready: true });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      expect(runWorkflowMock).not.toHaveBeenCalled();
    });

    it('同一 inputId 不重复触发', async () => {
      const { rerender } = renderHook(() => useQuickResize());
      setMockState({ inputId: 'input-1', ready: true });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      // 触发 rerender(无 inputId 变化)
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
      const { result } = renderHook(() => useQuickResize());
      act(() => {
        result.current.setPreset('tk-portrait');
      });
      expect(result.current.preset).toBe('tk-portrait');
    });

    it('已有输入时立即重跑', async () => {
      const { result } = renderHook(() => useQuickResize());
      setMockState({ inputId: 'input-1', ready: true });
      await act(async () => {
        result.current.setPreset('yt-landscape');
      });
      expect(runWorkflowMock).toHaveBeenCalled();
      const params = runWorkflowMock.mock.calls[0]![0].nodes[0].params;
      expect(params.width).toBe(1280);
      expect(params.height).toBe(720);
    });

    it('busy 时不重跑(但仍更新 preset)', async () => {
      const { result, rerender } = renderHook(() => useQuickResize());
      // 先触发 autoRun(让 lastRunInputId 标记为 input-1)
      setMockState({ inputId: 'input-1', ready: true });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      expect(runWorkflowMock).toHaveBeenCalledTimes(1);
      // 然后切到 busy 状态,再切 preset - 不应触发新的 run
      setMockState({ inputId: 'input-1', ready: true, busy: true });
      rerender();
      act(() => {
        result.current.setPreset('yt-landscape');
      });
      expect(result.current.preset).toBe('yt-landscape');
      expect(runWorkflowMock).toHaveBeenCalledTimes(1); // 仍是 autoRun 那一次
    });
  });

  describe('onComplete', () => {
    it('outputBlob 出现时触发一次 onComplete', async () => {
      const onComplete = vi.fn();
      const { rerender } = renderHook(() =>
        useQuickResize({ onComplete })
      );
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 100, height: 100, size: 1000, format: 'PNG' },
        outputBlob: new Blob(['x']),
        outputUrl: 'blob:output',
        outputInfo: { width: 50, height: 50, size: 500, format: 'PNG' },
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
          preset: 'ig-square',
        })
      );
    });

    it('同一 outputBlob 不重复触发', async () => {
      const onComplete = vi.fn();
      const { rerender } = renderHook(() =>
        useQuickResize({ onComplete })
      );
      const blob = new Blob(['x']);
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 100, height: 100, size: 1000, format: 'PNG' },
        outputBlob: blob,
        outputUrl: 'blob:output',
        outputInfo: { width: 50, height: 50, size: 500, format: 'PNG' },
      });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      // 再次 rerender,outputBlob 不变
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('reset / clearError', () => {
    it('透传 reset', () => {
      const { result } = renderHook(() => useQuickResize());
      act(() => {
        result.current.reset();
      });
      expect(resetMock).toHaveBeenCalled();
    });

    it('透传 clearError', () => {
      const { result } = renderHook(() => useQuickResize());
      act(() => {
        result.current.clearError();
      });
      expect(clearErrorMock).toHaveBeenCalled();
    });
  });

  describe('outputDimension', () => {
    it('有 outputInfo 时返回 WxH 字符串', () => {
      setMockState({
        outputInfo: { width: 1280, height: 720, size: 1000, format: 'WEBP' },
      });
      const { result } = renderHook(() => useQuickResize());
      expect(result.current.outputDimension).toBe('1280×720');
    });

    it('无 outputInfo 时返回 null', () => {
      const { result } = renderHook(() => useQuickResize());
      expect(result.current.outputDimension).toBeNull();
    });
  });

  describe('run()', () => {
    it('手动触发 runWorkflow', async () => {
      const { result } = renderHook(() => useQuickResize());
      await act(async () => {
        await result.current.run();
      });
      expect(runWorkflowMock).toHaveBeenCalledTimes(1);
      const wf = runWorkflowMock.mock.calls[0]![0];
      expect(wf.nodes[0].capability).toBe('image.resize');
    });
  });

  describe('error / initError 透传', () => {
    it('透传 error', () => {
      setMockState({ error: 'workflow failed' });
      const { result } = renderHook(() => useQuickResize());
      expect(result.current.error).toBe('workflow failed');
    });

    it('透传 initError', () => {
      setMockState({ initError: 'runtime init failed' });
      const { result } = renderHook(() => useQuickResize());
      expect(result.current.initError).toBe('runtime init failed');
    });
  });
});
