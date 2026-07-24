/**
 * useImagePipeline hook(Layer 0)单测。
 *
 * 测试覆盖:
 *   - 初始状态(默认 / 自定义 initialPreset)
 *   - IMAGE_PIPELINE_PRESETS 常量(4 个预设 + 各 steps 数量)
 *   - buildPipelineWorkflow(用 WorkflowBuilder 构造,节点数与预设一致)
 *   - handleFiles 透传
 *   - autoRun:inputId 变化触发单次 runtime.run(用 mock runWorkflowRaw 模拟)
 *   - 中间结果捕获(从 result.stepOutputs 读取各步产物)
 *   - setPreset 在已有输入时立即重跑
 *   - setPreset 在 busy 时不重跑
 *   - onComplete 去重触发(Blob 引用判等)
 *   - reset / clearError
 *   - run() 手动触发
 *   - error 透传
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { UseImageToolResult } from '../internal/useImageTool';
import type { LokvisRuntime, WorkflowResult } from '@lokvis/sdk';
import { getImageInfo } from '../internal/download';
import {
  useImagePipeline,
  IMAGE_PIPELINE_PRESETS,
  buildPipelineWorkflow,
  type PipelinePreset,
} from '../hooks/useImagePipeline';

const getImageInfoMock = vi.mocked(getImageInfo);

// ─── mock useImageTool ─────────────────────────────────────

const stateRef: { current: UseImageToolResult } = {
  current: {} as UseImageToolResult,
};

vi.mock('../internal/useImageTool', () => ({
  useImageTool: () => stateRef.current,
}));

// ─── mock download(getImageInfo 在 jsdom 中无法解码 Blob,会挂起) ──
// 只 mock getImageInfo,保留 ImageInfo 类型(用 type-only import)
vi.mock('../internal/download', () => ({
  getImageInfo: vi.fn(async (blob: Blob) => ({
    width: 800,
    height: 600,
    size: blob.size,
    format: 'WEBP',
  })),
  downloadBlob: vi.fn(),
  formatBytes: vi.fn((n: number) => `${n} B`),
  imageInfoToMeta: vi.fn(() => ''),
  detectTransparency: vi.fn(async () => false),
}));

// ─── mock runtime ──────────────────────────────────────────

const importAssetMock = vi.fn();
const exportAssetMock = vi.fn();
const runtimeRunMock = vi.fn();
const eventBusOnMock = vi.fn(() => vi.fn()); // returns unsubscribe

function makeMockRuntime(): LokvisRuntime {
  // Partial<LokvisRuntime> 显式标注:mock 只实现 useImagePipeline 实际调用的
  // 6 个成员(run/importAsset/exportAsset/cancel/dispose/eventBus),
  // 其余 30+ 方法未涉及。Partial → LokvisRuntime 单次 as 断言合规
  // (AGENTS.md 禁止 as unknown as 双断言,单次 as 允许)。
  const mock: Partial<LokvisRuntime> = {
    run: runtimeRunMock as LokvisRuntime['run'],
    importAsset: importAssetMock as LokvisRuntime['importAsset'],
    exportAsset: exportAssetMock as LokvisRuntime['exportAsset'],
    cancel: vi.fn(),
    dispose: vi.fn(),
    eventBus: {
      on: eventBusOnMock,
      emit: vi.fn(),
      onAny: vi.fn(),
      clear: vi.fn(),
    },
  };
  return mock as LokvisRuntime;
}

const handleFilesMock = vi.fn();
const resetMock = vi.fn();
const clearErrorMock = vi.fn();
const runWorkflowMock = vi.fn();
const runWorkflowRawMock = vi.fn();

function setMockState(overrides: Partial<UseImageToolResult> = {}) {
  stateRef.current = {
    runtime: makeMockRuntime(),
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
  runtimeRunMock.mockReset();
  importAssetMock.mockReset();
  exportAssetMock.mockReset();
  handleFilesMock.mockReset();
  resetMock.mockReset();
  clearErrorMock.mockReset();
  runWorkflowMock.mockReset();
  runWorkflowRawMock.mockReset();
  eventBusOnMock.mockReset();
  eventBusOnMock.mockImplementation(() => vi.fn());
  getImageInfoMock.mockReset();
  // 重新设置默认 mock 实现(mockReset 会清除实现)
  getImageInfoMock.mockImplementation(async (blob: Blob) => ({
    width: 800,
    height: 600,
    size: blob.size,
    format: 'WEBP',
  }));
}

/**
 * 模拟单次 runWorkflowRaw 调用:返回 WorkflowResult,其中 stepOutputs 按
 * buildPipelineWorkflow(preset) 实际生成的 node.id 填充。exportAsset 每步
 * 返回相同 Blob(测试不关心实际图像内容,只关心步骤数量与索引)。
 */
function mockPipelineRun(preset: PipelinePreset) {
  const wf = buildPipelineWorkflow(preset);
  const stepOutputs: Record<string, string[]> = {};
  for (const node of wf.nodes) {
    stepOutputs[node.id] = [`${node.id}-output`];
  }
  const finalOutput = wf.nodes[wf.nodes.length - 1]!.id + '-output';
  const result: WorkflowResult = {
    workflowId: wf.id,
    outputs: [finalOutput],
    stepOutputs,
    duration: 100,
    status: 'completed',
  };
  runWorkflowRawMock.mockResolvedValueOnce(result);
  const blob = new Blob([`pipeline-output`], { type: 'image/webp' });
  for (let i = 0; i < wf.nodes.length; i++) {
    exportAssetMock.mockResolvedValueOnce(blob);
  }
  return wf;
}

describe('useImagePipeline', () => {
  beforeEach(() => {
    resetMocks();
    setMockState();
    // jsdom 不支持 URL.createObjectURL/revokeObjectURL,需手动 polyfill。
    // 用 Object.defineProperty 避免 as unknown as 双断言(AGENTS.md 禁止)。
    if (!URL.createObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', {
        value: vi.fn(() => 'blob:mock-url'),
        writable: true,
        configurable: true,
      });
    }
    if (!URL.revokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        value: vi.fn(),
        writable: true,
        configurable: true,
      });
    }
  });

  describe('初始状态', () => {
    it('默认 preset 为 ecommerce', () => {
      const { result } = renderHook(() => useImagePipeline());
      expect(result.current.preset).toBe('ecommerce');
    });

    it('initialPreset 可自定义', () => {
      const { result } = renderHook(() =>
        useImagePipeline({ initialPreset: 'social' })
      );
      expect(result.current.preset).toBe('social');
    });

    it('初始 steps 为空数组', () => {
      const { result } = renderHook(() => useImagePipeline());
      expect(result.current.steps).toEqual([]);
    });

    it('初始 currentStep=-1(未运行)', () => {
      const { result } = renderHook(() => useImagePipeline());
      expect(result.current.currentStep).toBe(-1);
    });

    it('初始 outputBlob=null', () => {
      const { result } = renderHook(() => useImagePipeline());
      expect(result.current.outputBlob).toBeNull();
    });

    it('workflow 是 WorkflowBuilder 构造的实例', () => {
      const { result } = renderHook(() => useImagePipeline());
      expect(result.current.workflow).toBeDefined();
      expect(result.current.workflow.nodes.length).toBeGreaterThan(0);
    });
  });

  describe('IMAGE_PIPELINE_PRESETS 常量', () => {
    it('包含 4 个预设', () => {
      expect(Object.keys(IMAGE_PIPELINE_PRESETS).sort()).toEqual([
        'blog',
        'ecommerce',
        'social',
        'thumbnail',
      ]);
    });

    it('ecommerce 有 3 步:resize → compress → watermark', () => {
      const steps = IMAGE_PIPELINE_PRESETS.ecommerce.steps;
      expect(steps).toHaveLength(3);
      expect(steps[0]!.capability).toBe('image.resize');
      expect(steps[1]!.capability).toBe('image.compress');
      expect(steps[2]!.capability).toBe('image.watermark');
    });

    it('social 有 2 步:resize → compress', () => {
      const steps = IMAGE_PIPELINE_PRESETS.social.steps;
      expect(steps).toHaveLength(2);
      expect(steps[0]!.capability).toBe('image.resize');
      expect(steps[1]!.capability).toBe('image.compress');
    });

    it('thumbnail 有 2 步:resize → compress', () => {
      const steps = IMAGE_PIPELINE_PRESETS.thumbnail.steps;
      expect(steps).toHaveLength(2);
    });

    it('blog 有 3 步:resize → compress → watermark', () => {
      const steps = IMAGE_PIPELINE_PRESETS.blog.steps;
      expect(steps).toHaveLength(3);
      expect(steps[2]!.capability).toBe('image.watermark');
    });
  });

  describe('buildPipelineWorkflow', () => {
    it('返回 Workflow 实例,nodes 数量与预设 steps 一致', () => {
      const wf = buildPipelineWorkflow('ecommerce');
      expect(wf.nodes).toHaveLength(3);
      expect(wf.edges).toHaveLength(2); // 3 节点 → 2 边
    });

    it('workflow inputs/outputs 类型为 image', () => {
      const wf = buildPipelineWorkflow('social');
      expect(wf.inputs.type).toBe('image');
      expect(wf.outputs.type).toBe('image');
    });

    it('workflow 节点按预设顺序排列', () => {
      const wf = buildPipelineWorkflow('ecommerce');
      expect(wf.nodes[0]!.capability).toBe('image.resize');
      expect(wf.nodes[1]!.capability).toBe('image.compress');
      expect(wf.nodes[2]!.capability).toBe('image.watermark');
    });

    it('workflow 节点 params 与预设一致', () => {
      const wf = buildPipelineWorkflow('social');
      expect(wf.nodes[0]!.params!.width).toBe(1080);
      expect(wf.nodes[1]!.params!.quality).toBe(92);
    });
  });

  describe('handleFiles', () => {
    it('透传给 useImageTool.handleFiles', async () => {
      const { result } = renderHook(() => useImagePipeline());
      const files = [new File(['x'], 'a.png', { type: 'image/png' })];
      await act(async () => {
        await result.current.handleFiles(files);
      });
      expect(handleFilesMock).toHaveBeenCalledWith(files);
    });
  });

  describe('autoRun', () => {
    it('inputId 变化时触发单次 runWorkflowRaw(ecommerce = 3 步)', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      mockPipelineRun('ecommerce');
      const { rerender } = renderHook(() => useImagePipeline());
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(runWorkflowRawMock).toHaveBeenCalledTimes(1);
      });
      // 每步调用一次 exportAsset(3 步)
      expect(exportAssetMock).toHaveBeenCalledTimes(3);
    });

    it('social 预设也是单次 run(2 步 export)', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      mockPipelineRun('social');
      const { rerender } = renderHook(() =>
        useImagePipeline({ initialPreset: 'social' })
      );
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(runWorkflowRawMock).toHaveBeenCalledTimes(1);
      });
      expect(exportAssetMock).toHaveBeenCalledTimes(2);
    });

    it('autoRun=false 时不自动触发', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      const { rerender } = renderHook(() =>
        useImagePipeline({ autoRun: false })
      );
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      expect(runWorkflowRawMock).not.toHaveBeenCalled();
    });

    it('每步完成后,steps 数组累积更新', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      mockPipelineRun('social');
      const { rerender, result } = renderHook(() =>
        useImagePipeline({ initialPreset: 'social' })
      );
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(result.current.steps).toHaveLength(2);
      });
      expect(result.current.steps[0]!.index).toBe(0);
      expect(result.current.steps[1]!.index).toBe(1);
      expect(result.current.steps[0]!.capability).toBe('image.resize');
      expect(result.current.steps[1]!.capability).toBe('image.compress');
    });

    it('完成后 currentStep=-1,busy=false', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      mockPipelineRun('social');
      const { rerender, result } = renderHook(() =>
        useImagePipeline({ initialPreset: 'social' })
      );
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(result.current.busy).toBe(false);
      });
      expect(result.current.currentStep).toBe(-1);
    });

    it('最终 outputBlob = 最后一步输出', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      mockPipelineRun('social');
      const { rerender, result } = renderHook(() =>
        useImagePipeline({ initialPreset: 'social' })
      );
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(result.current.outputBlob).not.toBeNull();
      });
      // outputBlob 应等于最后一步(steps[1])的 blob
      expect(result.current.outputBlob).toBe(result.current.steps[1]!.blob);
    });

    it('run 失败时设置 error,不输出 steps', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      // runWorkflowRaw 返回 failed 结果
      runWorkflowRawMock.mockResolvedValueOnce({
        workflowId: 'wf-x',
        outputs: [],
        duration: 10,
        status: 'failed',
        error: 'Step 1 failed',
      });
      const { rerender, result } = renderHook(() =>
        useImagePipeline({ initialPreset: 'social' })
      );
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(result.current.error).toContain('Step 1 failed');
      });
      expect(result.current.busy).toBe(false);
      expect(result.current.steps).toHaveLength(0);
    });

    it('run 抛异常时设置 error', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      runWorkflowRawMock.mockRejectedValueOnce(new Error('runtime exploded'));
      const { rerender, result } = renderHook(() =>
        useImagePipeline({ initialPreset: 'social' })
      );
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(result.current.error).toContain('runtime exploded');
      });
    });
  });

  describe('setPreset', () => {
    it('更新 preset 状态', () => {
      const { result } = renderHook(() => useImagePipeline());
      act(() => {
        result.current.setPreset('blog');
      });
      expect(result.current.preset).toBe('blog');
    });

    it('无输入时只更新 preset,不触发 run', () => {
      const { result } = renderHook(() => useImagePipeline());
      act(() => {
        result.current.setPreset('blog');
      });
      expect(runWorkflowRawMock).not.toHaveBeenCalled();
    });

    it('已有输入时立即重跑(用新 preset)', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      mockPipelineRun('blog');
      const { result } = renderHook(() => useImagePipeline());
      await act(async () => {
        result.current.setPreset('blog');
      });
      await waitFor(() => {
        expect(runWorkflowRawMock).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('onComplete', () => {
    it('pipeline 完成后触发 onComplete,含 steps 数组', async () => {
      const onComplete = vi.fn();
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      mockPipelineRun('social');
      const { rerender } = renderHook(() =>
        useImagePipeline({ initialPreset: 'social', onComplete })
      );
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledTimes(1);
      });
      const arg = onComplete.mock.calls[0]![0];
      expect(arg.preset).toBe('social');
      expect(arg.steps).toHaveLength(2);
      expect(arg.inputSize).toBe(1000);
      expect(arg.outputBlob).toBeInstanceOf(Blob);
    });

    it('同一 Blob 不重复触发 onComplete', async () => {
      const onComplete = vi.fn();
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      // 两次 run 返回同一 Blob(同一引用),onComplete 只触发一次
      const blob = new Blob([`same`], { type: 'image/webp' });
      const wf = buildPipelineWorkflow('social');
      const stepOutputs: Record<string, string[]> = {};
      for (const node of wf.nodes) stepOutputs[node.id] = [`${node.id}-out`];
      runWorkflowRawMock.mockResolvedValue({
        workflowId: wf.id,
        outputs: [wf.nodes[wf.nodes.length - 1]!.id + '-out'],
        stepOutputs,
        duration: 10,
        status: 'completed',
      });
      exportAssetMock.mockResolvedValue(blob);

      const { rerender, result } = renderHook(() =>
        useImagePipeline({ initialPreset: 'social', onComplete })
      );
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledTimes(1);
      });
      // 手动再跑一次(同一 Blob),onComplete 不应再次触发
      await act(async () => {
        await result.current.run();
      });
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('reset / clearError', () => {
    it('透传 reset 给 useImageTool', () => {
      const { result } = renderHook(() => useImagePipeline());
      act(() => {
        result.current.reset();
      });
      expect(resetMock).toHaveBeenCalled();
    });

    it('clearError 清除 pipeline 自身 error', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      runWorkflowRawMock.mockResolvedValueOnce({
        workflowId: 'wf-x',
        outputs: [],
        duration: 10,
        status: 'failed',
        error: 'oops',
      });
      const { rerender, result } = renderHook(() => useImagePipeline());
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(result.current.error).toContain('oops');
      });
      act(() => {
        result.current.clearError();
      });
      expect(result.current.error).toBeNull();
    });
  });

  describe('run()', () => {
    it('手动触发 run,执行单次 runWorkflowRaw', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      mockPipelineRun('ecommerce');
      const { result } = renderHook(() =>
        useImagePipeline({ autoRun: false })
      );
      await act(async () => {
        await result.current.run();
      });
      expect(runWorkflowRawMock).toHaveBeenCalledTimes(1);
      expect(exportAssetMock).toHaveBeenCalledTimes(3);
    });

    it('无 inputId 时 run() 不触发', async () => {
      const { result } = renderHook(() =>
        useImagePipeline({ autoRun: false })
      );
      await act(async () => {
        await result.current.run();
      });
      expect(runWorkflowRawMock).not.toHaveBeenCalled();
    });
  });

  describe('error / initError 透传', () => {
    it('透传 tool.error(无 pipeline error 时)', () => {
      setMockState({ error: 'tool error' });
      const { result } = renderHook(() => useImagePipeline());
      expect(result.current.error).toBe('tool error');
    });

    it('透传 initError', () => {
      setMockState({ initError: 'runtime init failed' });
      const { result } = renderHook(() => useImagePipeline());
      expect(result.current.initError).toBe('runtime init failed');
    });
  });
});
