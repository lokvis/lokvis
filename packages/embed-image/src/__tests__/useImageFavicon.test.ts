/**
 * useImageFavicon hook(Layer 0)单测。
 *
 * 测试覆盖:
 *   - 初始状态(默认 / 自定义 initialPreset)
 *   - IMAGE_FAVICON_PRESETS 常量正确性
 *   - handleFiles 透传给 useImageTool
 *   - autoRun:inputId 变化触发 runWorkflowRaw(用 image.favicon capability + sizes)
 *   - 生成后合成 outputInfo(format='ICO', 宽高=最大尺寸)
 *   - setPreset 在已有输入时立即重跑
 *   - onComplete 去重触发
 *   - reset / clearError 透传
 *   - run() 手动触发
 *   - error / initError 透传
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { UseImageToolResult } from '../internal/useImageTool';
import { useImageFavicon, IMAGE_FAVICON_PRESETS } from '../hooks/useImageFavicon';

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
const exportAssetMock = vi.fn();

function setMockState(overrides: Partial<UseImageToolResult> = {}) {
  stateRef.current = {
    runtime: { exportAsset: exportAssetMock } as never,
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
    commitOutput: vi.fn(),
    ...overrides,
  };
}

function resetMocks() {
  runWorkflowMock.mockReset();
  runWorkflowRawMock.mockReset();
  handleFilesMock.mockReset();
  resetMock.mockReset();
  clearErrorMock.mockReset();
  exportAssetMock.mockReset();
  // 默认:runWorkflowRaw 成功,导出返回 ICO blob
  runWorkflowRawMock.mockResolvedValue({ status: 'completed', outputs: ['out-1'] });
  exportAssetMock.mockResolvedValue(
    new Blob([new Uint8Array([0, 0, 1, 0])], { type: 'image/x-icon' })
  );
}

describe('useImageFavicon', () => {
  beforeEach(() => {
    // jsdom 不提供 URL.createObjectURL / revokeObjectURL,favicon hook 自管 outputUrl 需要
    (URL as { createObjectURL: (b: Blob) => string }).createObjectURL = () => 'blob:favicon';
    (URL as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
    resetMocks();
    setMockState();
  });

  describe('初始状态', () => {
    it('默认 preset 为 full', () => {
      const { result } = renderHook(() => useImageFavicon());
      expect(result.current.preset).toBe('full');
    });

    it('initialPreset 可自定义', () => {
      const { result } = renderHook(() =>
        useImageFavicon({ initialPreset: 'standard' })
      );
      expect(result.current.preset).toBe('standard');
    });

    it('初始 outputInfo 为 null(无输出)', () => {
      const { result } = renderHook(() => useImageFavicon());
      expect(result.current.outputInfo).toBeNull();
    });

    it('透传 ready / inputUrl 等基础状态', () => {
      setMockState({ ready: true, inputUrl: 'blob:input' });
      const { result } = renderHook(() => useImageFavicon());
      expect(result.current.ready).toBe(true);
      expect(result.current.inputUrl).toBe('blob:input');
    });
  });

  describe('IMAGE_FAVICON_PRESETS 常量', () => {
    it('standard = [16,32,48]', () => {
      expect(IMAGE_FAVICON_PRESETS['standard'].sizes).toEqual([16, 32, 48]);
    });
    it('modern = [32,48,256]', () => {
      expect(IMAGE_FAVICON_PRESETS['modern'].sizes).toEqual([32, 48, 256]);
    });
    it('full = [16,32,48,256]', () => {
      expect(IMAGE_FAVICON_PRESETS['full'].sizes).toEqual([16, 32, 48, 256]);
    });
  });

  describe('handleFiles', () => {
    it('透传给 useImageTool.handleFiles', async () => {
      const { result } = renderHook(() => useImageFavicon());
      const files = [new File(['x'], 'a.png', { type: 'image/png' })];
      await act(async () => {
        await result.current.handleFiles(files);
      });
      expect(handleFilesMock).toHaveBeenCalledWith(files);
    });
  });

  describe('autoRun', () => {
    it('inputId 变化时触发 runWorkflowRaw,使用 image.favicon capability + sizes', async () => {
      const { rerender } = renderHook(() => useImageFavicon({ initialPreset: 'standard' }));
      setMockState({ inputId: 'input-1', ready: true });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      expect(runWorkflowRawMock).toHaveBeenCalledTimes(1);
      const wf = runWorkflowRawMock.mock.calls[0]![0];
      expect(wf.nodes[0].capability).toBe('image.favicon');
      expect(wf.nodes[0].params.sizes).toEqual([16, 32, 48]);
    });

    it('生成后合成 outputInfo(format=ICO, 宽高=最大尺寸)', async () => {
      const { result, rerender } = renderHook(() =>
        useImageFavicon({ initialPreset: 'full' })
      );
      setMockState({ inputId: 'input-1', ready: true });
      rerender();
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(result.current.outputBlob).toBeInstanceOf(Blob);
      expect(result.current.outputInfo).toEqual(
        expect.objectContaining({ width: 256, height: 256, format: 'ICO' })
      );
    });

    it('autoRun=false 时不自动触发', async () => {
      const { rerender } = renderHook(() => useImageFavicon({ autoRun: false }));
      setMockState({ inputId: 'input-1', ready: true });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      expect(runWorkflowRawMock).not.toHaveBeenCalled();
    });

    it('同一 inputId 不重复触发', async () => {
      const { rerender } = renderHook(() => useImageFavicon());
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
      expect(runWorkflowRawMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('setPreset', () => {
    it('更新 preset 状态', () => {
      const { result } = renderHook(() => useImageFavicon());
      act(() => {
        result.current.setPreset('modern');
      });
      expect(result.current.preset).toBe('modern');
    });

    it('已有输入时立即重跑', async () => {
      const { result } = renderHook(() => useImageFavicon());
      setMockState({ inputId: 'input-1', ready: true });
      await act(async () => {
        result.current.setPreset('standard');
      });
      expect(runWorkflowRawMock).toHaveBeenCalled();
      const params = runWorkflowRawMock.mock.calls[0]![0].nodes[0].params;
      expect(params.sizes).toEqual([16, 32, 48]);
    });
  });

  describe('onComplete', () => {
    it('outputBlob 出现时触发一次 onComplete', async () => {
      const onComplete = vi.fn();
      const { rerender } = renderHook(() =>
        useImageFavicon({ onComplete, initialPreset: 'full' })
      );
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 100, height: 100, size: 1000, format: 'PNG' },
      });
      rerender();
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          outputBlob: expect.any(Blob),
          inputSize: 1000,
          preset: 'full',
        })
      );
    });
  });

  describe('reset / clearError', () => {
    it('reset 透传给 useImageTool.reset', () => {
      const { result } = renderHook(() => useImageFavicon());
      act(() => {
        result.current.reset();
      });
      expect(resetMock).toHaveBeenCalled();
    });

    it('透传 clearError', () => {
      const { result } = renderHook(() => useImageFavicon());
      act(() => {
        result.current.clearError();
      });
      expect(clearErrorMock).toHaveBeenCalled();
    });
  });

  describe('run()', () => {
    it('手动触发 runWorkflowRaw', async () => {
      const { result } = renderHook(() => useImageFavicon());
      await act(async () => {
        await result.current.run();
      });
      expect(runWorkflowRawMock).toHaveBeenCalledTimes(1);
      const wf = runWorkflowRawMock.mock.calls[0]![0];
      expect(wf.nodes[0].capability).toBe('image.favicon');
    });
  });

  describe('error / initError 透传', () => {
    it('透传 error', () => {
      setMockState({ error: 'workflow failed' });
      const { result } = renderHook(() => useImageFavicon());
      expect(result.current.error).toBe('workflow failed');
    });

    it('透传 initError', () => {
      setMockState({ initError: 'runtime init failed' });
      const { result } = renderHook(() => useImageFavicon());
      expect(result.current.initError).toBe('runtime init failed');
    });
  });
});
