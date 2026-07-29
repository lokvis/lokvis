/**
 * useImageWorkflow — 任意线性图片工作流的纯逻辑 hook(Layer 0),无 UI。
 *
 * 是 useImagePipeline 的泛化:调用方传入任意步骤数组(ImageWorkflowStepConfig[]),
 * 而非 4 个内置预设。供 cloud 模版页内嵌试用区及三方站点使用。
 *
 * 行为:
 *   1. 复用 useImageTool(获取 runtime + 输入生命周期)
 *   2. 用 WorkflowBuilder 构造多节点 workflow(符合 AGENTS.md 架构约束);
 *      构造失败(如超过 MAX_WORKFLOW_STEPS)写入 error,不在渲染期抛出
 *   3. 单次 tool.runWorkflowRaw 执行整个 workflow,从 result.stepOutputs
 *      读取各步中间产物
 *   4. autoRun=true 时,输入或步骤/targets 定义变化自动重跑
 *   5. 通过 eventBus 订阅 node:started 事件更新 currentStep
 *   6. 输出完成后触发 onComplete(Blob 引用判等去重)
 *
 * 多 target 模式(targets 非空):
 *   - 每个 target 构造一个独立线性 workflow(id 为 `${id}--${target.name}`),
 *     target.overrides 按 capability 浅合并到匹配步骤的 params
 *   - 顺序执行各变体,复用同一输入;每个变体完成即追加 targetOutputs(渐进显示)
 *   - steps 只反映当前执行中变体的中间产物;currentTarget 标记执行进度
 *   - reset/换图中途取消:已完成变体保留在本轮内存中但 URL 全部释放
 *   - onComplete 整批完成后触发一次,outputSize 为各变体之和
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PluginLoadEntry, Workflow } from '@lokvis/sdk';
import { WorkflowBuilder } from '@lokvis/workflow';
import { useImageTool } from '../internal/useImageTool';
import { getImageInfo, type ImageInfo } from '../internal/download';

/** 单个工作流步骤定义(与线性 transform 节点 1:1) */
export interface ImageWorkflowStepConfig {
  /** 能力名,如 'image.resize' */
  capability: string;
  /** 能力参数 */
  params?: Record<string, unknown>;
  /** 展示标签(可本地化),缺省用 capability */
  label?: string;
}

/** 单个输出变体定义(多 target 模式) */
export interface ImageWorkflowTargetConfig {
  /** 变体名(下载文件名 + workflow id 后缀),如 'instagram' */
  name: string;
  /** 参数覆盖:capability → params,浅合并到所有匹配该 capability 的步骤 */
  overrides?: Record<string, Record<string, unknown>>;
}

/** 单个变体的执行结果 */
export interface ImageWorkflowTargetOutput {
  /** 变体名 */
  name: string;
  /** 变体最终输出 Blob */
  blob: Blob;
  /** 变体预览 URL(hook 管理生命周期,独立于 steps 的 URL) */
  url: string;
  /** 变体图片信息 */
  info: ImageInfo;
}

/** 单步执行结果(中间或最终) */
export interface ImageWorkflowStepOutput {
  /** 步骤索引(0-based) */
  index: number;
  /** 节点 label */
  label: string;
  /** capability 名 */
  capability: string;
  /** 输出 Blob */
  blob: Blob;
  /** 输出预览 URL(hook 管理生命周期) */
  url: string;
  /** 输出图片信息 */
  info: ImageInfo;
}

/** onComplete 回调参数 */
export interface ImageWorkflowRunResult {
  /** 最终输出 Blob(单 target:最后一步;多 target:最后一个变体) */
  outputBlob: Blob;
  /** 最终输出 URL */
  outputUrl: string;
  /** 输入大小(bytes) */
  inputSize: number;
  /** 输出大小(bytes;多 target 模式为各变体之和) */
  outputSize: number;
  /** workflow id */
  workflowId: string;
  /** 所有步骤输出(多 target 模式为最后一个变体的步骤) */
  steps: ImageWorkflowStepOutput[];
  /** 多 target 模式填充:全部变体输出 */
  targets?: ImageWorkflowTargetOutput[];
}

/** useImageWorkflow 选项 */
export interface UseImageWorkflowOptions {
  /** workflow 唯一标识(事件过滤 + autoRun 键) */
  id: string;
  /** workflow 名称,缺省用 id */
  name?: string;
  /** workflow 描述 */
  description?: string;
  /** 步骤列表(顺序执行) */
  steps: ImageWorkflowStepConfig[];
  /** 多变体模式:非空时对每个 target 依次执行一遍步骤(含 overrides) */
  targets?: ImageWorkflowTargetConfig[];
  /** 是否自动执行,默认 true */
  autoRun?: boolean;
  /** 完成回调 */
  onComplete?: (result: ImageWorkflowRunResult) => void;
  /** 预加载插件列表,透传给底层 useImageTool */
  plugins?: PluginLoadEntry[];
}

/** useImageWorkflow 返回值 */
export interface UseImageWorkflowResult {
  // ─── 状态 ───
  ready: boolean;
  initError: string | null;
  inputUrl: string | null;
  inputInfo: ImageInfo | null;
  /** 所有步骤输出(中间 + 最终;多 target 模式为当前执行中变体的步骤) */
  steps: ImageWorkflowStepOutput[];
  /** 当前执行中的步骤索引(-1 表示未运行) */
  currentStep: number;
  /** 已完成的变体输出(单 target 模式恒为 []) */
  targetOutputs: ImageWorkflowTargetOutput[];
  /** 当前执行中的变体索引(-1 表示空闲;单 target 模式恒为 -1) */
  currentTarget: number;
  /** 最终输出(等价于 steps[steps.length - 1]) */
  outputBlob: Blob | null;
  outputUrl: string | null;
  outputInfo: ImageInfo | null;
  busy: boolean;
  error: string | null;
  /** WorkflowBuilder 构造的 workflow(构造失败时为 null;多 target 模式为基础 workflow) */
  workflow: Workflow | null;

  // ─── 操作 ───
  handleFiles: (files: File[]) => Promise<void>;
  reset: () => void;
  clearError: () => void;
  /** 手动触发执行(autoRun=false 时用) */
  run: () => Promise<void>;
}

/**
 * 用 WorkflowBuilder 构造任意线性图片 workflow(符合 AGENTS.md 架构约束)。
 *
 * overrides 按 capability 浅合并到匹配步骤的 params(多 target 变体用)。
 * 非法输入(如步骤数 > MAX_WORKFLOW_STEPS=5)抛出,由 hook 捕获。
 */
export function buildImageWorkflow(
  id: string,
  steps: ImageWorkflowStepConfig[],
  name?: string,
  description?: string,
  overrides?: Record<string, Record<string, unknown>>
): Workflow {
  const builder = new WorkflowBuilder({ id, name: name ?? id, description });
  builder.setInput({ type: 'image', multiple: false });
  builder.setOutput({ type: 'image' });
  for (const step of steps) {
    const override = overrides?.[step.capability];
    const params = override
      ? { ...step.params, ...override }
      : (step.params ?? {});
    builder.add(step.capability, params, step.label);
  }
  return builder.build();
}

/** 构造好的变体 workflow(名字 + workflow 对) */
interface TargetWorkflow {
  name: string;
  workflow: Workflow;
}

/**
 * 任意线性图片工作流 hook(纯逻辑,无 UI)。
 *
 * 实现说明(照 useImagePipeline 模式):
 *   - 构造容错:steps/targets 来自外部数据,构造在 useMemo 内 try/catch,
 *     失败写 buildError,不在渲染期抛出
 *   - 单次 runtime.run 执行一个 workflow;从 result.stepOutputs 读取各步中间产物
 *   - 通过 eventBus 订阅 node:started 事件更新 currentStep(按 workflowId 过滤)
 *   - onComplete 去重用 Blob 引用判等(与其它 hook 一致)
 *   - 多 target:顺序执行变体 workflow;target 输出持有独立 object URL,
 *     与 steps 的 URL 生命周期解耦(steps 在变体间会被重置)
 */
export function useImageWorkflow(
  options: UseImageWorkflowOptions
): UseImageWorkflowResult {
  const {
    id,
    name,
    description,
    steps: stepConfigs,
    targets,
    autoRun = true,
    onComplete,
    plugins,
  } = options;
  const tool = useImageTool(plugins);
  const [steps, setSteps] = useState<ImageWorkflowStepOutput[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [targetOutputs, setTargetOutputs] = useState<ImageWorkflowTargetOutput[]>([]);
  const [currentTarget, setCurrentTarget] = useState<number>(-1);
  const [busy, setBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  // 输入或步骤/targets 定义变化都重跑:键 = inputId + workflow 定义序列化
  const stepsKey = JSON.stringify(stepConfigs);
  const targetsKey = JSON.stringify(targets ?? null);
  const lastRunKey = useRef<string | null>(null);
  // Blob 引用判等,避免不同输出同尺寸误判
  const lastNotifiedBlob = useRef<Blob | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  // 防重入:run() 被并发调用时直接跳过(state busy 在闭包中可能过期,用 ref)
  const busyRef = useRef(false);
  // 取消标记:reset/换图置 true,变体循环每轮开头检查并提前退出
  const cancelledRef = useRef(false);
  // 当前 steps 的 ref 镜像,供 revokeSteps 在不依赖 state 的情况下清理 URL
  const stepsRef = useRef<ImageWorkflowStepOutput[]>([]);
  stepsRef.current = steps;
  // 当前 targetOutputs 的 ref 镜像,供 revokeTargets 清理 URL
  const targetOutputsRef = useRef<ImageWorkflowTargetOutput[]>([]);
  targetOutputsRef.current = targetOutputs;

  /** 释放当前所有 step 的 object URL(重跑 / 换图 / 重置时调用) */
  const revokeSteps = useCallback(() => {
    for (const s of stepsRef.current) {
      URL.revokeObjectURL(s.url);
    }
  }, []);

  /** 释放当前所有 target 输出的 object URL */
  const revokeTargets = useCallback(() => {
    for (const t of targetOutputsRef.current) {
      URL.revokeObjectURL(t.url);
    }
  }, []);

  // 构造容错:steps/targets 来自外部数据,不在渲染期抛出。
  // 多 target 模式同时构造基础 workflow(展示用)与各变体 workflow(执行用)。
  const { workflow, targetWorkflows, buildError } = useMemo(() => {
    try {
      const configs = JSON.parse(stepsKey) as ImageWorkflowStepConfig[];
      const targetConfigs = JSON.parse(targetsKey) as
        | ImageWorkflowTargetConfig[]
        | null;
      const base = buildImageWorkflow(id, configs, name, description);
      const variants: TargetWorkflow[] = (targetConfigs ?? []).map((t) => ({
        name: t.name,
        workflow: buildImageWorkflow(
          `${id}--${t.name}`,
          configs,
          name ? `${name} (${t.name})` : `${id} (${t.name})`,
          description,
          t.overrides
        ),
      }));
      return {
        workflow: base,
        targetWorkflows: variants,
        buildError: null as string | null,
      };
    } catch (err) {
      return {
        workflow: null,
        targetWorkflows: [] as TargetWorkflow[],
        buildError: err instanceof Error ? err.message : String(err),
      };
    }
  }, [id, name, description, stepsKey, targetsKey]);

  /**
   * 执行单个 workflow:单次 runtime.run + 从 stepOutputs 读取中间产物。
   * 渐进更新 steps state;返回全部步骤输出。
   */
  const runOne = useCallback(
    async (wf: Workflow): Promise<ImageWorkflowStepOutput[]> => {
      if (!tool.runtime) throw new Error('runtime not ready');
      setCurrentStep(0);

      // node:id → 步骤索引 映射,把 eventBus 的 nodeId 翻译为 currentStep
      const nodeIdToIndex = new Map<string, number>();
      wf.nodes.forEach((n, i) => nodeIdToIndex.set(n.id, i));

      // 订阅 node:started 事件更新 currentStep(按 workflowId 过滤);
      // 本次执行结束后取消订阅,避免泄漏。
      const unsubscribe = tool.runtime.eventBus.on('node:started', (event) => {
        if (event.workflowId !== wf.id) return;
        const idx = nodeIdToIndex.get(event.nodeId);
        if (idx !== undefined) setCurrentStep(idx);
      });

      try {
        const result = await tool.runWorkflowRaw(wf);
        if (!result || result.status !== 'completed') {
          throw new Error(result?.error ?? 'Workflow failed');
        }
        const stepOutputs = result.stepOutputs;
        if (!stepOutputs) {
          throw new Error(
            'runtime did not expose stepOutputs; workflow requires single-target output'
          );
        }

        const collected: ImageWorkflowStepOutput[] = [];
        for (let i = 0; i < wf.nodes.length; i++) {
          const node = wf.nodes[i]!;
          const nodeLabel = node.label ?? node.capability ?? `Step ${i + 1}`;
          const nodeCapability = node.capability ?? '';
          const outputIds = stepOutputs[node.id];
          if (!outputIds || !outputIds[0]) {
            throw new Error(`Step ${i + 1} (${nodeLabel}) produced no output`);
          }
          const blob = await tool.runtime.exportAsset(outputIds[0]);
          const info = (await getImageInfo(blob)) ?? {
            width: 0,
            height: 0,
            size: blob.size,
            format: 'UNKNOWN',
          };
          const url = URL.createObjectURL(blob);
          collected.push({
            index: i,
            label: nodeLabel,
            capability: nodeCapability,
            blob,
            url,
            info,
          });
          setSteps([...collected]);
        }
        return collected;
      } finally {
        unsubscribe();
      }
    },
    [tool.runtime, tool.runWorkflowRaw]
  );

  /** 实际执行:单 target 跑基础 workflow;多 target 顺序跑各变体 */
  const runWorkflow = useCallback(async (): Promise<void> => {
    if (!workflow || !tool.runtime || !tool.inputId) return;
    if (busyRef.current) return;
    busyRef.current = true;
    cancelledRef.current = false;
    setBusy(true);
    setRunError(null);
    revokeSteps();
    revokeTargets();
    setSteps([]);
    setTargetOutputs([]);

    const multi = targetWorkflows.length > 0;

    try {
      if (!multi) {
        const collected = await runOne(workflow);
        setCurrentStep(-1);

        // 触发 onComplete(用 finalStep.blob 引用判等去重)
        if (collected.length > 0 && tool.inputInfo) {
          const finalStep = collected[collected.length - 1]!;
          if (finalStep.blob !== lastNotifiedBlob.current) {
            lastNotifiedBlob.current = finalStep.blob;
            onCompleteRef.current?.({
              outputBlob: finalStep.blob,
              outputUrl: finalStep.url,
              inputSize: tool.inputInfo.size,
              outputSize: finalStep.info.size,
              workflowId: workflow.id,
              steps: collected,
            });
          }
        }
      } else {
        const collectedTargets: ImageWorkflowTargetOutput[] = [];
        let lastCollected: ImageWorkflowStepOutput[] = [];
        for (let ti = 0; ti < targetWorkflows.length; ti++) {
          if (cancelledRef.current) break;
          const variant = targetWorkflows[ti]!;
          setCurrentTarget(ti);
          // 变体切换:上一变体的 steps URL 已随 target 独立 URL 解耦,可安全释放
          if (ti > 0) {
            for (const s of lastCollected) URL.revokeObjectURL(s.url);
            setSteps([]);
          }
          const collected = await runOne(variant.workflow);
          lastCollected = collected;
          const finalStep = collected[collected.length - 1]!;
          // target 输出持有独立 URL,与 steps 生命周期解耦
          collectedTargets.push({
            name: variant.name,
            blob: finalStep.blob,
            url: URL.createObjectURL(finalStep.blob),
            info: finalStep.info,
          });
          setTargetOutputs([...collectedTargets]);
        }
        setCurrentStep(-1);
        setCurrentTarget(-1);

        // 中途取消:释放已生成的 target URL,不触发 onComplete
        if (cancelledRef.current) {
          for (const t of collectedTargets) URL.revokeObjectURL(t.url);
          setTargetOutputs([]);
        } else if (collectedTargets.length > 0 && tool.inputInfo) {
          const last = collectedTargets[collectedTargets.length - 1]!;
          if (last.blob !== lastNotifiedBlob.current) {
            lastNotifiedBlob.current = last.blob;
            onCompleteRef.current?.({
              outputBlob: last.blob,
              outputUrl: last.url,
              inputSize: tool.inputInfo.size,
              outputSize: collectedTargets.reduce((s, t) => s + t.info.size, 0),
              workflowId: id,
              steps: lastCollected,
              targets: collectedTargets,
            });
          }
        }
      }
    } catch (err) {
      setCurrentStep(-1);
      setCurrentTarget(-1);
      setRunError(err instanceof Error ? err.message : String(err));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [
    workflow,
    targetWorkflows,
    id,
    tool.runtime,
    tool.inputId,
    tool.inputInfo,
    runOne,
    revokeSteps,
    revokeTargets,
  ]);

  // autoRun:输入或步骤/targets 定义变化触发;busy 期间跳过(结束后本 effect 因 busy 变化补跑)
  const runKey = tool.inputId
    ? `${tool.inputId}::${JSON.stringify({ id, stepsKey, targetsKey })}`
    : null;
  useEffect(() => {
    if (
      runKey &&
      workflow &&
      tool.ready &&
      autoRun &&
      !busy &&
      lastRunKey.current !== runKey
    ) {
      lastRunKey.current = runKey;
      void runWorkflow();
    }
    if (!runKey) {
      lastRunKey.current = null;
    }
  }, [runKey, workflow, tool.ready, autoRun, busy, runWorkflow]);

  const handleFiles = useCallback(
    async (files: File[]): Promise<void> => {
      // 换图时取消执行中的批次并清理旧 URL
      cancelledRef.current = true;
      revokeSteps();
      revokeTargets();
      setSteps([]);
      setTargetOutputs([]);
      setCurrentStep(-1);
      setCurrentTarget(-1);
      setRunError(null);
      lastNotifiedBlob.current = null;
      await tool.handleFiles(files);
    },
    [tool, revokeSteps, revokeTargets]
  );

  const reset = useCallback(() => {
    cancelledRef.current = true;
    revokeSteps();
    revokeTargets();
    setSteps([]);
    setTargetOutputs([]);
    setCurrentStep(-1);
    setCurrentTarget(-1);
    setRunError(null);
    lastNotifiedBlob.current = null;
    tool.reset();
  }, [tool, revokeSteps, revokeTargets]);

  const clearError = useCallback(() => setRunError(null), []);

  // 派生:最终输出。多 target 模式 = 最后一个已完成变体;
  // 单 target 模式 = 最后一步输出;无 steps 时回退到 tool 的输出
  const lastTarget =
    targetOutputs.length > 0 ? targetOutputs[targetOutputs.length - 1] : null;
  const finalStep = steps.length > 0 ? steps[steps.length - 1] : null;

  return {
    ready: tool.ready,
    initError: tool.initError,
    inputUrl: tool.inputUrl,
    inputInfo: tool.inputInfo,
    steps,
    currentStep,
    targetOutputs,
    currentTarget,
    outputBlob: lastTarget?.blob ?? finalStep?.blob ?? tool.outputBlob,
    outputUrl: lastTarget?.url ?? finalStep?.url ?? tool.outputUrl,
    outputInfo: lastTarget?.info ?? finalStep?.info ?? tool.outputInfo,
    busy: busy || tool.busy,
    error: buildError ?? runError ?? tool.error,
    workflow,
    handleFiles,
    reset,
    clearError,
    run: runWorkflow,
  };
}
