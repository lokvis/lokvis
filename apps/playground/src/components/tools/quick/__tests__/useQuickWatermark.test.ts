/**
 * useQuickWatermark hook(Layer 0)单测。
 *
 * 测试覆盖:
 *   - 初始状态(默认 / 自定义 initialPreset / 自定义 initialText)
 *   - WATERMARK_PRESETS 常量正确性
 *   - DEFAULT_WATERMARK_TEXT
 *   - handleFiles 透传
 *   - autoRun:inputId 变化触发 runWorkflow(用 image.watermark capability)
 *   - 各预设传正确 position / fontSize / opacity
 *   - 文字作为 text 参数传入
 *   - setPreset 在已有输入时立即重跑
 *   - setText 在已有输入时立即重跑
 *   - setPreset / setText 在 busy 时不重跑
 *   - onComplete 去重触发
 *   - reset / clearError 透传
 *   - run() 手动触发
 *   - error / initError 透传
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { UseImageToolResult } from '@/components/toolkit/useImageTool';
import {
  useQuickWatermark,
  WATERMARK_PRESETS,
  DEFAULT_WATERMARK_TEXT,
} from '../useQuickWatermark';

// ─── mock useImageTool ─────────────────────────────────────

const stateRef: { current: UseImageToolResult } = {
  current: {} as UseImageToolResult,
};

vi.mock('@/components/toolkit/useImageTool', () => ({
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

describe('useQuickWatermark', () => {
  beforeEach(() => {
    resetMocks();
    setMockState();
  });

  describe('初始状态', () => {
    it('默认 preset 为 small-br', () => {
      const { result } = renderHook(() => useQuickWatermark());
      expect(result.current.preset).toBe('small-br');
    });

    it('默认 text 为 DEFAULT_WATERMARK_TEXT', () => {
      const { result } = renderHook(() => useQuickWatermark());
      expect(result.current.text).toBe(DEFAULT_WATERMARK_TEXT);
      expect(DEFAULT_WATERMARK_TEXT).toBe('Lokvis');
    });

    it('initialPreset 可自定义', () => {
      const { result } = renderHook(() =>
        useQuickWatermark({ initialPreset: 'tile' })
      );
      expect(result.current.preset).toBe('tile');
    });

    it('initialText 可自定义', () => {
      const { result } = renderHook(() =>
        useQuickWatermark({ initialText: 'Hello' })
      );
      expect(result.current.text).toBe('Hello');
    });

    it('透传 ready / inputUrl / outputUrl', () => {
      setMockState({
        ready: true,
        inputUrl: 'blob:input',
        outputUrl: 'blob:output',
      });
      const { result } = renderHook(() => useQuickWatermark());
      expect(result.current.ready).toBe(true);
      expect(result.current.inputUrl).toBe('blob:input');
      expect(result.current.outputUrl).toBe('blob:output');
    });
  });

  describe('WATERMARK_PRESETS 常量', () => {
    it('small-br 为 bottom-right + fontSize=16 + opacity=0.7', () => {
      expect(WATERMARK_PRESETS['small-br'].position).toBe('bottom-right');
      expect(WATERMARK_PRESETS['small-br'].fontSize).toBe(16);
      expect(WATERMARK_PRESETS['small-br'].opacity).toBe(0.7);
    });

    it('large-center 为 center + fontSize=64 + opacity=0.5', () => {
      expect(WATERMARK_PRESETS['large-center'].position).toBe('center');
      expect(WATERMARK_PRESETS['large-center'].fontSize).toBe(64);
      expect(WATERMARK_PRESETS['large-center'].opacity).toBe(0.5);
    });

    it('tile 为 tile + fontSize=24 + opacity=0.3', () => {
      expect(WATERMARK_PRESETS['tile'].position).toBe('tile');
      expect(WATERMARK_PRESETS['tile'].fontSize).toBe(24);
      expect(WATERMARK_PRESETS['tile'].opacity).toBe(0.3);
    });
  });

  describe('handleFiles', () => {
    it('透传给 useImageTool.handleFiles', async () => {
      const { result } = renderHook(() => useQuickWatermark());
      const files = [new File(['x'], 'a.png', { type: 'image/png' })];
      await act(async () => {
        await result.current.handleFiles(files);
      });
      expect(handleFilesMock).toHaveBeenCalledWith(files);
    });
  });

  describe('autoRun', () => {
    it('inputId 变化时触发 runWorkflow,使用 image.watermark capability', async () => {
      const { rerender } = renderHook(() => useQuickWatermark());
      setMockState({ inputId: 'input-1', ready: true });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      expect(runWorkflowMock).toHaveBeenCalledTimes(1);
      const wf = runWorkflowMock.mock.calls[0][0];
      expect(wf.nodes[0].capability).toBe('image.watermark');
    });

    it('默认 small-br 预设传正确参数', async () => {
      const { rerender } = renderHook(() => useQuickWatermark());
      setMockState({ inputId: 'input-1', ready: true });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      const params = runWorkflowMock.mock.calls[0][0].nodes[0].params;
      expect(params.position).toBe('bottom-right');
      expect(params.fontSize).toBe(16);
      expect(params.opacity).toBe(0.7);
      expect(params.color).toBe('#ffffff');
      expect(params.text).toBe(DEFAULT_WATERMARK_TEXT);
    });

    it('tile 预设传 position=tile', async () => {
      const { rerender } = renderHook(() =>
        useQuickWatermark({ initialPreset: 'tile' })
      );
      setMockState({ inputId: 'input-1', ready: true });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      const params = runWorkflowMock.mock.calls[0][0].nodes[0].params;
      expect(params.position).toBe('tile');
    });

    it('自定义 initialText 作为 text 参数传入', async () => {
      const { rerender } = renderHook(() =>
        useQuickWatermark({ initialText: 'Custom' })
      );
      setMockState({ inputId: 'input-1', ready: true });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      const params = runWorkflowMock.mock.calls[0][0].nodes[0].params;
      expect(params.text).toBe('Custom');
    });

    it('autoRun=false 时不自动触发', async () => {
      const { rerender } = renderHook(() =>
        useQuickWatermark({ autoRun: false })
      );
      setMockState({ inputId: 'input-1', ready: true });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      expect(runWorkflowMock).not.toHaveBeenCalled();
    });

    it('同一 inputId 不重复触发', async () => {
      const { rerender } = renderHook(() => useQuickWatermark());
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
      const { result } = renderHook(() => useQuickWatermark());
      act(() => {
        result.current.setPreset('tile');
      });
      expect(result.current.preset).toBe('tile');
    });

    it('已有输入时立即重跑', async () => {
      const { result } = renderHook(() => useQuickWatermark());
      setMockState({ inputId: 'input-1', ready: true });
      await act(async () => {
        result.current.setPreset('large-center');
      });
      expect(runWorkflowMock).toHaveBeenCalled();
      const params = runWorkflowMock.mock.calls[0][0].nodes[0].params;
      expect(params.position).toBe('center');
      expect(params.fontSize).toBe(64);
    });

    it('busy 时不重跑(但仍更新 preset)', async () => {
      const { result, rerender } = renderHook(() => useQuickWatermark());
      // 先触发 autoRun
      setMockState({ inputId: 'input-1', ready: true });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      expect(runWorkflowMock).toHaveBeenCalledTimes(1);
      setMockState({ inputId: 'input-1', ready: true, busy: true });
      rerender();
      act(() => {
        result.current.setPreset('tile');
      });
      expect(result.current.preset).toBe('tile');
      expect(runWorkflowMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('setText', () => {
    it('更新 text 状态', () => {
      const { result } = renderHook(() => useQuickWatermark());
      act(() => {
        result.current.setText('new text');
      });
      expect(result.current.text).toBe('new text');
    });

    it('已有输入时立即重跑,使用新 text', async () => {
      const { result } = renderHook(() => useQuickWatermark());
      setMockState({ inputId: 'input-1', ready: true });
      await act(async () => {
        result.current.setText('Updated');
      });
      expect(runWorkflowMock).toHaveBeenCalled();
      const params = runWorkflowMock.mock.calls[0][0].nodes[0].params;
      expect(params.text).toBe('Updated');
    });

    it('busy 时不重跑(但仍更新 text)', async () => {
      const { result, rerender } = renderHook(() => useQuickWatermark());
      setMockState({ inputId: 'input-1', ready: true });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      setMockState({ inputId: 'input-1', ready: true, busy: true });
      rerender();
      act(() => {
        result.current.setText('Updated');
      });
      expect(result.current.text).toBe('Updated');
      expect(runWorkflowMock).toHaveBeenCalledTimes(1); // 仅 autoRun 那次
    });
  });

  describe('onComplete', () => {
    it('outputBlob 出现时触发一次 onComplete', async () => {
      const onComplete = vi.fn();
      const { rerender } = renderHook(() =>
        useQuickWatermark({ onComplete })
      );
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 100, height: 100, size: 1000, format: 'PNG' },
        outputBlob: new Blob(['x']),
        outputUrl: 'blob:output',
        outputInfo: { width: 100, height: 100, size: 1100, format: 'PNG' },
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
          outputSize: 1100,
          preset: 'small-br',
        })
      );
    });

    it('同一 outputBlob 不重复触发', async () => {
      const onComplete = vi.fn();
      const { rerender } = renderHook(() =>
        useQuickWatermark({ onComplete })
      );
      const blob = new Blob(['x']);
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 100, height: 100, size: 1000, format: 'PNG' },
        outputBlob: blob,
        outputUrl: 'blob:output',
        outputInfo: { width: 100, height: 100, size: 1100, format: 'PNG' },
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
      const { result } = renderHook(() => useQuickWatermark());
      act(() => {
        result.current.reset();
      });
      expect(resetMock).toHaveBeenCalled();
    });

    it('透传 clearError', () => {
      const { result } = renderHook(() => useQuickWatermark());
      act(() => {
        result.current.clearError();
      });
      expect(clearErrorMock).toHaveBeenCalled();
    });
  });

  describe('run()', () => {
    it('手动触发 runWorkflow,使用 image.watermark capability', async () => {
      const { result } = renderHook(() => useQuickWatermark());
      await act(async () => {
        await result.current.run();
      });
      expect(runWorkflowMock).toHaveBeenCalledTimes(1);
      const wf = runWorkflowMock.mock.calls[0][0];
      expect(wf.nodes[0].capability).toBe('image.watermark');
    });

    it('run() 使用当前 text + preset', async () => {
      const { result } = renderHook(() =>
        useQuickWatermark({ initialPreset: 'tile', initialText: 'MyMark' })
      );
      await act(async () => {
        await result.current.run();
      });
      const params = runWorkflowMock.mock.calls[0][0].nodes[0].params;
      expect(params.position).toBe('tile');
      expect(params.text).toBe('MyMark');
    });
  });

  describe('error / initError 透传', () => {
    it('透传 error', () => {
      setMockState({ error: 'workflow failed' });
      const { result } = renderHook(() => useQuickWatermark());
      expect(result.current.error).toBe('workflow failed');
    });

    it('透传 initError', () => {
      setMockState({ initError: 'runtime init failed' });
      const { result } = renderHook(() => useQuickWatermark());
      expect(result.current.initError).toBe('runtime init failed');
    });
  });
});
