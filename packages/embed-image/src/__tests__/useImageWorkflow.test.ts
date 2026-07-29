/**
 * useImageWorkflow hook(Layer 0)单测。
 *
 * 测试覆盖:
 *   - buildImageWorkflow(nodes/edges 数量、inputs/outputs 类型、节点顺序与
 *     params、label 透传)
 *   - 初始状态(steps=[]、currentStep=-1、outputBlob=null、workflow 非 null)
 *   - 构造容错(6 步超限 → error 含超限信息、workflow=null、不抛出)
 *   - handleFiles 透传 + 清理旧状态
 *   - autoRun:inputId 变化触发单次 runWorkflowRaw;autoRun=false 不触发;
 *     steps 定义变化自动重跑;steps 累积、完成后 currentStep=-1/busy=false、
 *     outputBlob=最后一步
 *   - 失败路径(status='failed' / 抛异常 / stepOutputs 缺失)
 *   - onComplete 载荷 + 同一 Blob 去重
 *   - reset/clearError 透传;run() 手动触发
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { UseImageToolResult } from '../internal/useImageTool';
import type { LokvisRuntime, Workflow, WorkflowResult } from '@lokvis/sdk';
import { getImageInfo } from '../internal/download';
import {
  useImageWorkflow,
  buildImageWorkflow,
  type ImageWorkflowStepConfig,
} from '../hooks/useImageWorkflow';

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
  // Partial<LokvisRuntime> 显式标注:mock 只实现 useImageWorkflow 实际调用的
  // 成员(run/importAsset/exportAsset/cancel/dispose/eventBus)。
  // Partial → LokvisRuntime 单次 as 断言合规(AGENTS.md 禁止 as unknown as)。
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
    commitOutput: vi.fn(),
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
  getImageInfoMock.mockImplementation(async (blob: Blob) => ({
    width: 800,
    height: 600,
    size: blob.size,
    format: 'WEBP',
  }));
}

// ─── 公用步骤定义 ──────────────────────────────────────────

const TWO_STEPS: ImageWorkflowStepConfig[] = [
  {
    capability: 'image.resize',
    params: { width: 1080, height: 1080 },
    label: 'Resize 1080',
  },
  { capability: 'image.compress', params: { format: 'webp', quality: 80 } },
];

const THREE_STEPS: ImageWorkflowStepConfig[] = [
  ...TWO_STEPS,
  {
    capability: 'image.watermark',
    params: { text: '@brand' },
    label: 'Watermark',
  },
];

/**
 * 模拟单次 runWorkflowRaw 调用:返回 WorkflowResult,其中 stepOutputs 按
 * buildImageWorkflow 实际生成的 node.id 填充。exportAsset 每步返回相同 Blob。
 */
function mockWorkflowRun(id: string, steps: ImageWorkflowStepConfig[]): Workflow {
  const wf = buildImageWorkflow(id, steps);
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
  const blob = new Blob(['workflow-output'], { type: 'image/webp' });
  for (let i = 0; i < wf.nodes.length; i++) {
    exportAssetMock.mockResolvedValueOnce(blob);
  }
  return wf;
}

describe('useImageWorkflow', () => {
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

  describe('buildImageWorkflow', () => {
    it('nodes/edges 数量与 steps 一致', () => {
      const wf = buildImageWorkflow('wf-test', THREE_STEPS);
      expect(wf.nodes).toHaveLength(3);
      expect(wf.edges).toHaveLength(2); // 3 节点 → 2 边
    });

    it('inputs/outputs 类型为 image', () => {
      const wf = buildImageWorkflow('wf-test', TWO_STEPS);
      expect(wf.inputs.type).toBe('image');
      expect(wf.outputs.type).toBe('image');
    });

    it('节点按传入顺序排列,params 透传', () => {
      const wf = buildImageWorkflow('wf-test', THREE_STEPS);
      expect(wf.nodes[0]!.capability).toBe('image.resize');
      expect(wf.nodes[1]!.capability).toBe('image.compress');
      expect(wf.nodes[2]!.capability).toBe('image.watermark');
      expect(wf.nodes[0]!.params!.width).toBe(1080);
      expect(wf.nodes[1]!.params!.quality).toBe(80);
    });

    it('label 透传,缺省时节点 label 为空(渲染时回退 capability)', () => {
      const wf = buildImageWorkflow('wf-test', TWO_STEPS);
      expect(wf.nodes[0]!.label).toBe('Resize 1080');
      expect(wf.nodes[1]!.label).toBeUndefined();
    });

    it('name 缺省用 id', () => {
      const wf = buildImageWorkflow('wf-test', TWO_STEPS);
      expect(wf.name).toBe('wf-test');
      const named = buildImageWorkflow('wf-test', TWO_STEPS, 'My Flow', 'desc');
      expect(named.name).toBe('My Flow');
    });
  });

  describe('初始状态', () => {
    it('初始 steps 为空数组、currentStep=-1、outputBlob=null', () => {
      const { result } = renderHook(() =>
        useImageWorkflow({ id: 'wf-a', steps: TWO_STEPS })
      );
      expect(result.current.steps).toEqual([]);
      expect(result.current.currentStep).toBe(-1);
      expect(result.current.outputBlob).toBeNull();
    });

    it('workflow 非 null,nodes 数量与 steps 一致', () => {
      const { result } = renderHook(() =>
        useImageWorkflow({ id: 'wf-a', steps: TWO_STEPS })
      );
      expect(result.current.workflow).not.toBeNull();
      expect(result.current.workflow!.nodes).toHaveLength(2);
    });
  });

  describe('构造容错', () => {
    it('6 步超限 → error 含超限信息、workflow=null、不抛出', () => {
      const sixSteps: ImageWorkflowStepConfig[] = Array.from(
        { length: 6 },
        (_, i) => ({ capability: 'image.compress', params: { quality: 50 + i } })
      );
      const { result } = renderHook(() =>
        useImageWorkflow({ id: 'wf-over', steps: sixSteps })
      );
      expect(result.current.workflow).toBeNull();
      expect(result.current.error).toContain('max steps');
    });

    it('超限时 autoRun 不触发', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      const sixSteps: ImageWorkflowStepConfig[] = Array.from(
        { length: 6 },
        () => ({ capability: 'image.compress' })
      );
      const { rerender } = renderHook(() =>
        useImageWorkflow({ id: 'wf-over', steps: sixSteps })
      );
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      expect(runWorkflowRawMock).not.toHaveBeenCalled();
    });
  });

  describe('handleFiles', () => {
    it('透传给 useImageTool.handleFiles', async () => {
      const { result } = renderHook(() =>
        useImageWorkflow({ id: 'wf-a', steps: TWO_STEPS, autoRun: false })
      );
      const files = [new File(['x'], 'a.png', { type: 'image/png' })];
      await act(async () => {
        await result.current.handleFiles(files);
      });
      expect(handleFilesMock).toHaveBeenCalledWith(files);
    });
  });

  describe('autoRun', () => {
    it('inputId 变化时触发单次 runWorkflowRaw(3 步 = 3 次 exportAsset)', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      mockWorkflowRun('wf-a', THREE_STEPS);
      const { rerender } = renderHook(() =>
        useImageWorkflow({ id: 'wf-a', steps: THREE_STEPS })
      );
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(runWorkflowRawMock).toHaveBeenCalledTimes(1);
      });
      expect(exportAssetMock).toHaveBeenCalledTimes(3);
    });

    it('autoRun=false 时不自动触发', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      const { rerender } = renderHook(() =>
        useImageWorkflow({ id: 'wf-a', steps: TWO_STEPS, autoRun: false })
      );
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      expect(runWorkflowRawMock).not.toHaveBeenCalled();
    });

    it('steps 定义变化(rerender 传新 steps)自动重跑', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      mockWorkflowRun('wf-a', TWO_STEPS);
      const { rerender } = renderHook(
        ({ steps }: { steps: ImageWorkflowStepConfig[] }) =>
          useImageWorkflow({ id: 'wf-a', steps }),
        { initialProps: { steps: TWO_STEPS } }
      );
      rerender({ steps: TWO_STEPS });
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(runWorkflowRawMock).toHaveBeenCalledTimes(1);
      });
      // 改变步骤定义 → 自动重跑
      mockWorkflowRun('wf-a', THREE_STEPS);
      rerender({ steps: THREE_STEPS });
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(runWorkflowRawMock).toHaveBeenCalledTimes(2);
      });
    });

    it('重跑时 revoke 上一轮 steps 的 object URL(不泄漏)', async () => {
      const revokeSpy = vi.fn();
      Object.defineProperty(URL, 'revokeObjectURL', {
        value: revokeSpy,
        writable: true,
        configurable: true,
      });
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      mockWorkflowRun('wf-a', TWO_STEPS);
      const { rerender, result } = renderHook(
        ({ steps }: { steps: ImageWorkflowStepConfig[] }) =>
          useImageWorkflow({ id: 'wf-a', steps }),
        { initialProps: { steps: TWO_STEPS } }
      );
      rerender({ steps: TWO_STEPS });
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(result.current.steps).toHaveLength(2);
      });
      expect(revokeSpy).not.toHaveBeenCalled();
      // 步骤定义变化重跑:上一轮 2 个 step 的 URL 应被 revoke
      mockWorkflowRun('wf-a', THREE_STEPS);
      rerender({ steps: THREE_STEPS });
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(result.current.steps).toHaveLength(3);
      });
      expect(revokeSpy).toHaveBeenCalledTimes(2);
    });

    it('每步完成后,steps 数组累积更新', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      mockWorkflowRun('wf-a', TWO_STEPS);
      const { rerender, result } = renderHook(() =>
        useImageWorkflow({ id: 'wf-a', steps: TWO_STEPS })
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
      expect(result.current.steps[0]!.label).toBe('Resize 1080');
      // label 缺省时回退 capability
      expect(result.current.steps[1]!.label).toBe('image.compress');
    });

    it('完成后 currentStep=-1,busy=false,outputBlob=最后一步', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      mockWorkflowRun('wf-a', TWO_STEPS);
      const { rerender, result } = renderHook(() =>
        useImageWorkflow({ id: 'wf-a', steps: TWO_STEPS })
      );
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(result.current.busy).toBe(false);
        expect(result.current.steps).toHaveLength(2);
      });
      expect(result.current.currentStep).toBe(-1);
      expect(result.current.outputBlob).toBe(result.current.steps[1]!.blob);
    });
  });

  describe('失败路径', () => {
    it("status='failed' 时设置 error,不输出 steps", async () => {
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
        error: 'Step 1 failed',
      });
      const { rerender, result } = renderHook(() =>
        useImageWorkflow({ id: 'wf-a', steps: TWO_STEPS })
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
        useImageWorkflow({ id: 'wf-a', steps: TWO_STEPS })
      );
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(result.current.error).toContain('runtime exploded');
      });
    });

    it('stepOutputs 缺失时设置 error', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      runWorkflowRawMock.mockResolvedValueOnce({
        workflowId: 'wf-a',
        outputs: ['final'],
        duration: 10,
        status: 'completed',
      });
      const { rerender, result } = renderHook(() =>
        useImageWorkflow({ id: 'wf-a', steps: TWO_STEPS })
      );
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(result.current.error).toContain('single-target');
      });
    });
  });

  describe('onComplete', () => {
    it('完成后触发 onComplete,载荷含 workflowId/steps/inputSize/outputBlob', async () => {
      const onComplete = vi.fn();
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      mockWorkflowRun('wf-a', TWO_STEPS);
      const { rerender } = renderHook(() =>
        useImageWorkflow({ id: 'wf-a', steps: TWO_STEPS, onComplete })
      );
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledTimes(1);
      });
      const arg = onComplete.mock.calls[0]![0];
      expect(arg.workflowId).toBe('wf-a');
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
      const blob = new Blob(['same'], { type: 'image/webp' });
      const wf = buildImageWorkflow('wf-a', TWO_STEPS);
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
        useImageWorkflow({ id: 'wf-a', steps: TWO_STEPS, onComplete })
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

  describe('reset / clearError / run()', () => {
    it('透传 reset 给 useImageTool', () => {
      const { result } = renderHook(() =>
        useImageWorkflow({ id: 'wf-a', steps: TWO_STEPS })
      );
      act(() => {
        result.current.reset();
      });
      expect(resetMock).toHaveBeenCalled();
    });

    it('clearError 清除自身 run error', async () => {
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
      const { rerender, result } = renderHook(() =>
        useImageWorkflow({ id: 'wf-a', steps: TWO_STEPS })
      );
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

    it('run() 手动触发单次 runWorkflowRaw', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      mockWorkflowRun('wf-a', THREE_STEPS);
      const { result } = renderHook(() =>
        useImageWorkflow({ id: 'wf-a', steps: THREE_STEPS, autoRun: false })
      );
      await act(async () => {
        await result.current.run();
      });
      expect(runWorkflowRawMock).toHaveBeenCalledTimes(1);
      expect(exportAssetMock).toHaveBeenCalledTimes(3);
    });

    it('run() 执行中再次调用不重入(防并发)', async () => {
      setMockState({
        inputId: 'input-1',
        ready: true,
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      const wf = buildImageWorkflow('wf-a', TWO_STEPS);
      const stepOutputs: Record<string, string[]> = {};
      for (const node of wf.nodes) stepOutputs[node.id] = [`${node.id}-out`];
      let resolveRun: ((v: WorkflowResult) => void) | undefined;
      runWorkflowRawMock.mockImplementation(
        () =>
          new Promise<WorkflowResult>((res) => {
            resolveRun = res;
          })
      );
      exportAssetMock.mockResolvedValue(new Blob(['x'], { type: 'image/webp' }));
      const { result } = renderHook(() =>
        useImageWorkflow({ id: 'wf-a', steps: TWO_STEPS, autoRun: false })
      );
      let first: Promise<void> = Promise.resolve();
      act(() => {
        first = result.current.run();
        // 第一次 run 挂起期间的第二次调用应被 busyRef 挡住
        void result.current.run();
      });
      expect(runWorkflowRawMock).toHaveBeenCalledTimes(1);
      await act(async () => {
        resolveRun!({
          workflowId: wf.id,
          outputs: [wf.nodes[wf.nodes.length - 1]!.id + '-out'],
          stepOutputs,
          duration: 1,
          status: 'completed',
        });
        await first;
      });
      expect(runWorkflowRawMock).toHaveBeenCalledTimes(1);
      expect(result.current.busy).toBe(false);
    });

    it('无 inputId 时 run() 不触发', async () => {
      const { result } = renderHook(() =>
        useImageWorkflow({ id: 'wf-a', steps: TWO_STEPS, autoRun: false })
      );
      await act(async () => {
        await result.current.run();
      });
      expect(runWorkflowRawMock).not.toHaveBeenCalled();
    });
  });

  describe('error / initError 透传', () => {
    it('透传 tool.error(无自身 error 时)', () => {
      setMockState({ error: 'tool error' });
      const { result } = renderHook(() =>
        useImageWorkflow({ id: 'wf-a', steps: TWO_STEPS })
      );
      expect(result.current.error).toBe('tool error');
    });

    it('透传 initError', () => {
      setMockState({ initError: 'runtime init failed' });
      const { result } = renderHook(() =>
        useImageWorkflow({ id: 'wf-a', steps: TWO_STEPS })
      );
      expect(result.current.initError).toBe('runtime init failed');
    });
  });
});
