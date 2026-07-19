/**
 * useQuickCrop hook(Layer 0)单测。
 *
 * 测试覆盖:
 *   - 初始状态(默认 / 自定义 initialPreset)
 *   - CROP_PRESETS 常量正确性(aspectRatio / label)
 *   - computeCropRect 函数(各预设 + 居中 + 自由 = 整图)
 *   - handleFiles 透传
 *   - autoRun:inputId 变化触发 runWorkflow(用 image.crop capability)
 *   - 各预设传正确 x/y/width/height
 *   - setPreset 在已有输入时立即重跑
 *   - setPreset 在 busy 时不重跑
 *   - onComplete 去重触发
 *   - reset / clearError 透传
 *   - run() 手动触发
 *   - cropRect / outputDimension 计算
 *   - error / initError 透传
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { UseImageToolResult } from '@/components/toolkit/useImageTool';
import {
  useQuickCrop,
  CROP_PRESETS,
  computeCropRect,
} from '../useQuickCrop';

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

describe('useQuickCrop', () => {
  beforeEach(() => {
    resetMocks();
    setMockState();
  });

  describe('初始状态', () => {
    it('默认 preset 为 square', () => {
      const { result } = renderHook(() => useQuickCrop());
      expect(result.current.preset).toBe('square');
    });

    it('initialPreset 可自定义', () => {
      const { result } = renderHook(() =>
        useQuickCrop({ initialPreset: '16:9' })
      );
      expect(result.current.preset).toBe('16:9');
    });

    it('透传 ready / inputUrl / outputUrl', () => {
      setMockState({
        ready: true,
        inputUrl: 'blob:input',
        outputUrl: 'blob:output',
      });
      const { result } = renderHook(() => useQuickCrop());
      expect(result.current.ready).toBe(true);
      expect(result.current.inputUrl).toBe('blob:input');
      expect(result.current.outputUrl).toBe('blob:output');
    });

    it('无输入时 cropRect=null', () => {
      const { result } = renderHook(() => useQuickCrop());
      expect(result.current.cropRect).toBeNull();
    });

    it('无输出时 outputDimension=null', () => {
      const { result } = renderHook(() => useQuickCrop());
      expect(result.current.outputDimension).toBeNull();
    });
  });

  describe('CROP_PRESETS 常量', () => {
    it('square aspectRatio=1', () => {
      expect(CROP_PRESETS.square.aspectRatio).toBe(1);
    });

    it('4:3 aspectRatio=4/3', () => {
      expect(CROP_PRESETS['4:3'].aspectRatio).toBeCloseTo(4 / 3, 5);
    });

    it('16:9 aspectRatio=16/9', () => {
      expect(CROP_PRESETS['16:9'].aspectRatio).toBeCloseTo(16 / 9, 5);
    });

    it('free aspectRatio=null', () => {
      expect(CROP_PRESETS.free.aspectRatio).toBeNull();
    });
  });

  describe('computeCropRect', () => {
    it('无 inputInfo 时返回 null', () => {
      expect(computeCropRect('square', null)).toBeNull();
    });

    it('square 预设:800×600 输入 → 居中 600×600', () => {
      const rect = computeCropRect('square', {
        width: 800,
        height: 600,
        size: 1000,
        format: 'PNG',
      });
      expect(rect).not.toBeNull();
      expect(rect!.width).toBe(600);
      expect(rect!.height).toBe(600);
      expect(rect!.x).toBe(100); // (800 - 600) / 2
      expect(rect!.y).toBe(0);
    });

    it('square 预设:600×800 输入(纵向)→ 居中 600×600', () => {
      const rect = computeCropRect('square', {
        width: 600,
        height: 800,
        size: 1000,
        format: 'PNG',
      });
      expect(rect).not.toBeNull();
      expect(rect!.width).toBe(600);
      expect(rect!.height).toBe(600);
      expect(rect!.x).toBe(0);
      expect(rect!.y).toBe(100); // (800 - 600) / 2
    });

    it('4:3 预设:800×800 输入(正方形)→ 居中 800×600', () => {
      const rect = computeCropRect('4:3', {
        width: 800,
        height: 800,
        size: 1000,
        format: 'PNG',
      });
      expect(rect).not.toBeNull();
      // inputAR=1, R=4/3 ≈ 1.333;inputAR < R → 高度需裁
      // cropW = 800, cropH = 800 / (4/3) = 600
      expect(rect!.width).toBe(800);
      expect(rect!.height).toBe(600);
      expect(rect!.x).toBe(0);
      expect(rect!.y).toBe(100);
    });

    it('16:9 预设:1600×900 输入(已 16:9)→ 整图(无裁剪)', () => {
      const rect = computeCropRect('16:9', {
        width: 1600,
        height: 900,
        size: 1000,
        format: 'PNG',
      });
      expect(rect).not.toBeNull();
      expect(rect!.width).toBe(1600);
      expect(rect!.height).toBe(900);
      expect(rect!.x).toBe(0);
      expect(rect!.y).toBe(0);
    });

    it('free 预设:返回整图(无裁剪)', () => {
      const rect = computeCropRect('free', {
        width: 800,
        height: 600,
        size: 1000,
        format: 'PNG',
      });
      expect(rect).toEqual({ x: 0, y: 0, width: 800, height: 600 });
    });
  });

  describe('handleFiles', () => {
    it('透传给 useImageTool.handleFiles', async () => {
      const { result } = renderHook(() => useQuickCrop());
      const files = [new File(['x'], 'a.png', { type: 'image/png' })];
      await act(async () => {
        await result.current.handleFiles(files);
      });
      expect(handleFilesMock).toHaveBeenCalledWith(files);
    });
  });

  describe('autoRun', () => {
    it('inputId 变化时触发 runWorkflow,使用 image.crop capability', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      const { rerender } = renderHook(() => useQuickCrop());
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      expect(runWorkflowMock).toHaveBeenCalledTimes(1);
      const wf = runWorkflowMock.mock.calls[0][0];
      expect(wf.nodes[0].capability).toBe('image.crop');
    });

    it('默认 square 预设传居中 1:1 裁剪参数', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      const { rerender } = renderHook(() => useQuickCrop());
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      const params = runWorkflowMock.mock.calls[0][0].nodes[0].params;
      expect(params.x).toBe(100);
      expect(params.y).toBe(0);
      expect(params.width).toBe(600);
      expect(params.height).toBe(600);
    });

    it('16:9 预设传 16:9 居中裁剪参数', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 800, size: 1000, format: 'PNG' },
      });
      const { rerender } = renderHook(() =>
        useQuickCrop({ initialPreset: '16:9' })
      );
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      const params = runWorkflowMock.mock.calls[0][0].nodes[0].params;
      // inputAR=1, R=16/9≈1.778;inputAR < R → 高度需裁
      // cropW = 800, cropH = 800 / (16/9) = 450
      expect(params.width).toBe(800);
      expect(params.height).toBe(450);
      expect(params.x).toBe(0);
      expect(params.y).toBe(175); // (800 - 450) / 2
    });

    it('free 预设传整图(无裁剪)', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      const { rerender } = renderHook(() =>
        useQuickCrop({ initialPreset: 'free' })
      );
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      const params = runWorkflowMock.mock.calls[0][0].nodes[0].params;
      expect(params.x).toBe(0);
      expect(params.y).toBe(0);
      expect(params.width).toBe(800);
      expect(params.height).toBe(600);
    });

    it('autoRun=false 时不自动触发', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      const { rerender } = renderHook(() =>
        useQuickCrop({ autoRun: false })
      );
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      expect(runWorkflowMock).not.toHaveBeenCalled();
    });

    it('同一 inputId 不重复触发', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      const { rerender } = renderHook(() => useQuickCrop());
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      expect(runWorkflowMock).toHaveBeenCalledTimes(1);
    });

    it('无 inputInfo 时不触发(保护性跳过)', async () => {
      setMockState({ inputId: 'input-1', ready: true, inputInfo: null });
      const { rerender } = renderHook(() => useQuickCrop());
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      expect(runWorkflowMock).not.toHaveBeenCalled();
    });
  });

  describe('setPreset', () => {
    it('更新 preset 状态', () => {
      const { result } = renderHook(() => useQuickCrop());
      act(() => {
        result.current.setPreset('16:9');
      });
      expect(result.current.preset).toBe('16:9');
    });

    it('已有输入时立即重跑', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      const { result } = renderHook(() => useQuickCrop());
      await act(async () => {
        result.current.setPreset('4:3');
      });
      expect(runWorkflowMock).toHaveBeenCalled();
      // 至少一次触发(可能是 autoRun + setPreset)
      const lastCall = runWorkflowMock.mock.calls[runWorkflowMock.mock.calls.length - 1][0];
      // 4:3 预设:inputAR=800/600=1.333, R=4/3=1.333;相等 → 整图
      expect(lastCall.nodes[0].params.width).toBe(800);
      expect(lastCall.nodes[0].params.height).toBe(600);
    });

    it('busy 时不重跑(但仍更新 preset)', async () => {
      const { result, rerender } = renderHook(() => useQuickCrop());
      // 先触发 autoRun
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      expect(runWorkflowMock).toHaveBeenCalledTimes(1);
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
        busy: true,
      });
      rerender();
      act(() => {
        result.current.setPreset('16:9');
      });
      expect(result.current.preset).toBe('16:9');
      expect(runWorkflowMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('onComplete', () => {
    it('outputBlob 出现时触发一次 onComplete', async () => {
      const onComplete = vi.fn();
      const { rerender } = renderHook(() => useQuickCrop({ onComplete }));
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
        outputBlob: new Blob(['x']),
        outputUrl: 'blob:output',
        outputInfo: { width: 600, height: 600, size: 800, format: 'PNG' },
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
          outputSize: 800,
          preset: 'square',
        })
      );
    });

    it('同一 outputBlob 不重复触发', async () => {
      const onComplete = vi.fn();
      const { rerender } = renderHook(() => useQuickCrop({ onComplete }));
      const blob = new Blob(['x']);
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
        outputBlob: blob,
        outputUrl: 'blob:output',
        outputInfo: { width: 600, height: 600, size: 800, format: 'PNG' },
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
      const { result } = renderHook(() => useQuickCrop());
      act(() => {
        result.current.reset();
      });
      expect(resetMock).toHaveBeenCalled();
    });

    it('透传 clearError', () => {
      const { result } = renderHook(() => useQuickCrop());
      act(() => {
        result.current.clearError();
      });
      expect(clearErrorMock).toHaveBeenCalled();
    });
  });

  describe('run()', () => {
    it('手动触发 runWorkflow,使用 image.crop capability', async () => {
      setMockState({
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      const { result } = renderHook(() => useQuickCrop());
      await act(async () => {
        await result.current.run();
      });
      expect(runWorkflowMock).toHaveBeenCalledTimes(1);
      const wf = runWorkflowMock.mock.calls[0][0];
      expect(wf.nodes[0].capability).toBe('image.crop');
    });

    it('run() 使用当前 preset 计算 cropRect', async () => {
      setMockState({
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      const { result } = renderHook(() =>
        useQuickCrop({ initialPreset: '16:9' })
      );
      await act(async () => {
        await result.current.run();
      });
      const params = runWorkflowMock.mock.calls[0][0].nodes[0].params;
      // inputAR=800/600=1.333, R=16/9=1.778;inputAR < R → 高度裁
      // cropW=800, cropH=800/(16/9)=450
      expect(params.width).toBe(800);
      expect(params.height).toBe(450);
    });

    it('无 inputInfo 时 run() 不触发(保护性跳过)', async () => {
      const { result } = renderHook(() => useQuickCrop());
      await act(async () => {
        await result.current.run();
      });
      expect(runWorkflowMock).not.toHaveBeenCalled();
    });
  });

  describe('cropRect / outputDimension 计算', () => {
    it('cropRect 反映当前 preset + inputInfo', () => {
      setMockState({
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      const { result } = renderHook(() => useQuickCrop());
      expect(result.current.cropRect).toEqual({
        x: 100,
        y: 0,
        width: 600,
        height: 600,
      });
    });

    it('outputDimension 反映输出尺寸', () => {
      setMockState({
        outputInfo: { width: 600, height: 600, size: 800, format: 'PNG' },
      });
      const { result } = renderHook(() => useQuickCrop());
      expect(result.current.outputDimension).toBe('600×600');
    });
  });

  describe('error / initError 透传', () => {
    it('透传 error', () => {
      setMockState({ error: 'workflow failed' });
      const { result } = renderHook(() => useQuickCrop());
      expect(result.current.error).toBe('workflow failed');
    });

    it('透传 initError', () => {
      setMockState({ initError: 'runtime init failed' });
      const { result } = renderHook(() => useQuickCrop());
      expect(result.current.initError).toBe('runtime init failed');
    });
  });
});
