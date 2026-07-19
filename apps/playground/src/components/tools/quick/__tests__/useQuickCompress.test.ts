/**
 * useQuickCompress hook 单测(Layer 0)。
 *
 * 测试覆盖:
 *   - 初始状态(ready / preset / ratio)
 *   - handleFiles / reset / clearError 透传
 *   - autoRun 触发 runWorkflow
 *   - setPreset 切换 + 重跑
 *   - onComplete 在 outputBlob 变化时触发(且不重复)
 *   - ratio 计算(节省 / 增大)
 *   - run() 手动触发(autoRun=false)
 *
 * useImageTool 被整体 mock,只验证 useQuickCompress 自身逻辑。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { UseImageToolResult } from '@/components/toolkit/useImageTool';

// ─── mock useImageTool:用 ref 持有当前 mock 状态 ──────────

const stateRef: { current: UseImageToolResult } = {
  current: {} as UseImageToolResult,
};

vi.mock('@/components/toolkit/useImageTool', () => ({
  useImageTool: () => stateRef.current,
}));

// buildSingleStepImageWorkflow 用真实实现(验证 capability/params 正确)
import { useQuickCompress, COMPRESS_PRESETS } from '../useQuickCompress';

// ─── 工具函数 ───────────────────────────────────────────────

const runWorkflowMock = vi.fn();
const runWorkflowRawMock = vi.fn();
const handleFilesMock = vi.fn();
const resetMock = vi.fn();
const clearErrorMock = vi.fn();

function makeInfo(size: number) {
  return { width: 800, height: 600, size, format: 'WEBP' };
}

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

// ─── 测试 ───────────────────────────────────────────────────

describe('useQuickCompress', () => {
  beforeEach(() => {
    resetMocks();
    setMockState();
  });

  it('初始状态:ready=true / preset=balanced / ratio=null', () => {
    const { result } = renderHook(() => useQuickCompress());
    expect(result.current.ready).toBe(true);
    expect(result.current.preset).toBe('balanced');
    expect(result.current.ratio).toBeNull();
    expect(result.current.outputBlob).toBeNull();
  });

  it('initialPreset 可自定义', () => {
    const { result } = renderHook(() =>
      useQuickCompress({ initialPreset: 'highQuality' })
    );
    expect(result.current.preset).toBe('highQuality');
  });

  it('COMPRESS_PRESETS 包含 3 个预设,所有格式都是 webp', () => {
    expect(Object.keys(COMPRESS_PRESETS).sort()).toEqual(['balanced', 'highQuality', 'small']);
    expect(COMPRESS_PRESETS.balanced.quality).toBe(80);
    expect(COMPRESS_PRESETS.highQuality.quality).toBe(92);
    expect(COMPRESS_PRESETS.small.quality).toBe(65);
    Object.values(COMPRESS_PRESETS).forEach((v) => expect(v.format).toBe('webp'));
  });

  it('handleFiles 透传给底层 tool.handleFiles', async () => {
    const { result } = renderHook(() => useQuickCompress());
    const files = [new File(['x'], 'a.png', { type: 'image/png' })];
    await act(async () => {
      await result.current.handleFiles(files);
    });
    expect(handleFilesMock).toHaveBeenCalledWith(files);
  });

  it('autoRun=true 时,inputId 出现触发 runWorkflow(quality=80)', async () => {
    setMockState({ inputId: null });
    const { rerender } = renderHook(() => useQuickCompress());
    expect(runWorkflowMock).not.toHaveBeenCalled();

    // 模拟上传完成:inputId 出现
    setMockState({ inputId: 'asset-1' });
    rerender();
    await act(async () => { await Promise.resolve(); });

    expect(runWorkflowMock).toHaveBeenCalledTimes(1);
    const wf = runWorkflowMock.mock.calls[0]![0];
    expect(wf.nodes[0].capability).toBe('image.compress');
    expect(wf.nodes[0].params).toEqual({ format: 'webp', quality: 80 });
  });

  it('setPreset 切换后,若有输入则立即重跑(quality=92)', async () => {
    setMockState({ inputId: 'asset-1' });
    const { result } = renderHook(() => useQuickCompress());
    // 等 autoRun 触发一次
    await act(async () => { await Promise.resolve(); });
    expect(runWorkflowMock).toHaveBeenCalledTimes(1);

    // 切换到 highQuality
    act(() => {
      result.current.setPreset('highQuality');
    });
    await act(async () => { await Promise.resolve(); });

    expect(runWorkflowMock).toHaveBeenCalledTimes(2);
    const wf = runWorkflowMock.mock.calls[1]![0];
    expect(wf.nodes[0].params).toEqual({ format: 'webp', quality: 92 });
  });

  it('setPreset 切换后,无输入则不触发 runCompress,只更新 preset', () => {
    setMockState({ inputId: null });
    const { result } = renderHook(() => useQuickCompress());
    expect(stateRef.current.inputId).toBeNull();
    act(() => {
      result.current.setPreset('small');
    });
    expect(runWorkflowMock).not.toHaveBeenCalled();
    expect(result.current.preset).toBe('small');
  });

  it('onComplete 在 outputBlob 变化时触发(且不重复)', async () => {
    const onComplete = vi.fn();
    setMockState({
      inputInfo: makeInfo(1024),
      outputBlob: null,
      outputUrl: null,
      outputInfo: null,
    });
    const { rerender } = renderHook(() => useQuickCompress({ onComplete }));

    // 第一次:output 完成
    setMockState({
      inputInfo: makeInfo(1024),
      outputBlob: new Blob(['x'], { type: 'image/webp' }),
      outputUrl: 'blob:output-1',
      outputInfo: makeInfo(400),
    });
    rerender();
    await act(async () => { await Promise.resolve(); });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      outputSize: 400,
      inputSize: 1024,
      preset: 'balanced',
    }));

    // 重渲染但不改变 outputBlob → 不应再次触发
    rerender();
    await act(async () => { await Promise.resolve(); });
    expect(onComplete).toHaveBeenCalledTimes(1);

    // outputBlob 再次变化 → 触发第二次
    setMockState({
      inputInfo: makeInfo(1024),
      outputBlob: new Blob(['y'], { type: 'image/webp' }),
      outputUrl: 'blob:output-2',
      outputInfo: makeInfo(350),
    });
    rerender();
    await act(async () => { await Promise.resolve(); });
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it('reset 透传给底层 tool.reset', () => {
    const { result } = renderHook(() => useQuickCompress());
    act(() => {
      result.current.reset();
    });
    expect(resetMock).toHaveBeenCalledTimes(1);
  });

  it('clearError 透传给底层 tool.clearError', () => {
    const { result } = renderHook(() => useQuickCompress());
    act(() => {
      result.current.clearError();
    });
    expect(clearErrorMock).toHaveBeenCalledTimes(1);
  });

  it('ratio 计算:output 比输入小 → 正值(节省)', () => {
    setMockState({
      inputInfo: makeInfo(1000),
      outputInfo: makeInfo(300),
    });
    const { result } = renderHook(() => useQuickCompress());
    expect(result.current.ratio).toBeCloseTo(70, 1);
  });

  it('ratio 计算:output 比输入大 → 负值(增大)', () => {
    setMockState({
      inputInfo: makeInfo(300),
      outputInfo: makeInfo(1000),
    });
    const { result } = renderHook(() => useQuickCompress());
    expect(result.current.ratio).toBeLessThan(0);
    // (1 - 1000/300) * 100 = -233.33
    expect(result.current.ratio).toBeCloseTo(-233.33, 1);
  });

  it('run() 手动触发执行(autoRun=false 时仍可调用)', async () => {
    setMockState({ inputId: 'asset-1' });
    const { result } = renderHook(() => useQuickCompress({ autoRun: false }));
    await act(async () => { await Promise.resolve(); });
    // autoRun=false 时,即便 inputId 存在也不自动跑
    expect(runWorkflowMock).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.run();
    });
    expect(runWorkflowMock).toHaveBeenCalledTimes(1);
  });

  it('error 透传底层 tool.error', () => {
    setMockState({ error: 'compress failed' });
    const { result } = renderHook(() => useQuickCompress());
    expect(result.current.error).toBe('compress failed');
  });

  it('initError 透传底层 tool.initError', () => {
    setMockState({ initError: 'runtime init failed' });
    const { result } = renderHook(() => useQuickCompress());
    expect(result.current.initError).toBe('runtime init failed');
  });
});
