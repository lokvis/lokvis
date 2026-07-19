/**
 * useImagePipeline — 图片多步 pipeline 的纯逻辑 hook(Layer 0),无 UI。
 *
 * 行为:
 *   1. 复用 useImageTool(获取 runtime + 输入生命周期)
 *   2. 用 WorkflowBuilder 构造多节点 workflow(符合 AGENTS.md 架构约束)
 *   3. 逐步执行 workflow.nodes,捕获每步中间结果(可展开查看)
 *   4. autoRun=true 时,上传后自动跑完整 pipeline
 *   5. 切换 preset 时,若有输入则自动重跑
 *   6. 输出完成后触发 onComplete(可串联到下一个 hook)
 *
 * 4 个预设(见设计文档 §5.2):
 *   - ecommerce:  resize(1080) → compress(q80) → watermark(@brand)
 *   - social:     resize(IG 1:1) → compress(q92)
 *   - thumbnail:  resize(400) → compress(q65)
 *   - blog:       resize(1200) → compress(q80) → watermark(@blog)
 *
 * 与单步 QuickAction 区别:
 *   - 单步用 buildSingleStepImageWorkflow + tool.runWorkflow
 *   - Pipeline 用 WorkflowBuilder 构造 workflow,但逐节点执行(以捕获中间结果)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AssetId, Workflow } from '@lokvis/sdk';
import { WorkflowBuilder } from '@lokvis/workflow';
import { useImageTool } from '@/components/toolkit/useImageTool';
import { buildSingleStepImageWorkflow } from '@/components/toolkit/workflow-builder';
import { getImageInfo, type ImageInfo } from '@/components/toolkit/download';

/** 重新导出共享类型(供 Layer 1/2 引用) */
export type {
  UseQuickActionOptions,
  QuickActionResult,
} from './useQuickCompress';

/** Pipeline 预设 */
export type PipelinePreset = 'ecommerce' | 'social' | 'thumbnail' | 'blog';

/** 单步配置(节点 capability + params + UI label) */
export interface PipelineStepConfig {
  capability: string;
  params: Record<string, unknown>;
  label: string;
}

/** Pipeline 预设配置 */
export interface PipelinePresetConfig {
  /** 步骤列表(顺序执行) */
  steps: PipelineStepConfig[];
  /** 简介(供 UI 展示) */
  label: string;
  /** 描述 */
  description: string;
}

export const PIPELINE_PRESETS: Record<PipelinePreset, PipelinePresetConfig> = {
  /** 电商主图优化:resize(1080) → compress(q80) → watermark(@brand) */
  ecommerce: {
    label: 'E-commerce',
    description: 'Resize 1080 → Compress q80 → Watermark',
    steps: [
      {
        capability: 'image.resize',
        params: { width: 1080, height: 1080, fit: 'inside', maintainAspectRatio: true },
        label: 'Resize 1080',
      },
      {
        capability: 'image.compress',
        params: { format: 'webp', quality: 80 },
        label: 'Compress q80',
      },
      {
        capability: 'image.watermark',
        params: { text: '@brand', position: 'bottom-right', fontSize: 16, opacity: 0.7, color: '#ffffff' },
        label: 'Watermark @brand',
      },
    ],
  },
  /** 社交媒体分享:resize(IG 1:1) → compress(q92) */
  social: {
    label: 'Social',
    description: 'Resize IG 1:1 → Compress q92',
    steps: [
      {
        capability: 'image.resize',
        params: { width: 1080, height: 1080, maintainAspectRatio: true },
        label: 'Resize IG 1:1',
      },
      {
        capability: 'image.compress',
        params: { format: 'webp', quality: 92 },
        label: 'Compress q92',
      },
    ],
  },
  /** 网页缩略图:resize(400) → compress(q65) */
  thumbnail: {
    label: 'Thumbnail',
    description: 'Resize 400 → Compress q65',
    steps: [
      {
        capability: 'image.resize',
        params: { width: 400, height: 400, fit: 'inside', maintainAspectRatio: true },
        label: 'Resize 400',
      },
      {
        capability: 'image.compress',
        params: { format: 'webp', quality: 65 },
        label: 'Compress q65',
      },
    ],
  },
  /** 博客配图:resize(1200) → compress(q80) → watermark(@blog) */
  blog: {
    label: 'Blog',
    description: 'Resize 1200 → Compress q80 → Watermark',
    steps: [
      {
        capability: 'image.resize',
        params: { width: 1200, height: 1200, fit: 'inside', maintainAspectRatio: true },
        label: 'Resize 1200',
      },
      {
        capability: 'image.compress',
        params: { format: 'webp', quality: 80 },
        label: 'Compress q80',
      },
      {
        capability: 'image.watermark',
        params: { text: '@blog', position: 'bottom-right', fontSize: 14, opacity: 0.6, color: '#ffffff' },
        label: 'Watermark @blog',
      },
    ],
  },
};

/** 单步执行结果(中间或最终) */
export interface PipelineStepOutput {
  /** 步骤索引(0-based) */
  index: number;
  /** 节点 label */
  label: string;
  /** capability 名 */
  capability: string;
  /** 输出 Blob */
  blob: Blob;
  /** 输出预览 URL */
  url: string;
  /** 输出图片信息 */
  info: ImageInfo;
}

/** onComplete 回调参数 */
export interface PipelineResult {
  /** 最终输出 Blob(最后一步的输出) */
  outputBlob: Blob;
  /** 最终输出 URL */
  outputUrl: string;
  /** 输入大小(bytes) */
  inputSize: number;
  /** 输出大小(bytes) */
  outputSize: number;
  /** 当前预设 */
  preset: PipelinePreset;
  /** 所有步骤输出(含最终) */
  steps: PipelineStepOutput[];
}

/** useImagePipeline 选项 */
export interface UseImagePipelineOptions {
  /** 初始预设,默认 'ecommerce' */
  initialPreset?: PipelinePreset;
  /** 是否自动执行,默认 true */
  autoRun?: boolean;
  /** 完成回调 */
  onComplete?: (result: PipelineResult) => void;
}

/** useImagePipeline 返回值 */
export interface UseImagePipelineResult {
  // ─── 状态 ───
  ready: boolean;
  initError: string | null;
  inputUrl: string | null;
  inputInfo: ImageInfo | null;
  /** 所有步骤输出(中间 + 最终) */
  steps: PipelineStepOutput[];
  /** 当前执行中的步骤索引(-1 表示未运行) */
  currentStep: number;
  /** 最终输出(等价于 steps[steps.length - 1]) */
  outputBlob: Blob | null;
  outputUrl: string | null;
  outputInfo: ImageInfo | null;
  busy: boolean;
  error: string | null;
  /** 当前预设 */
  preset: PipelinePreset;
  /** WorkflowBuilder 构造的 workflow(供 UI 展示节点信息) */
  workflow: Workflow;

  // ─── 操作 ───
  handleFiles: (files: File[]) => Promise<void>;
  setPreset: (preset: PipelinePreset) => void;
  reset: () => void;
  clearError: () => void;
  /** 手动触发执行(autoRun=false 时用) */
  run: () => Promise<void>;
}

/** 用 WorkflowBuilder 构造 pipeline workflow(符合 AGENTS.md 架构约束) */
export function buildPipelineWorkflow(preset: PipelinePreset): Workflow {
  const config = PIPELINE_PRESETS[preset];
  const builder = new WorkflowBuilder({
    id: `image-pipeline-${preset}`,
    name: `${config.label} Pipeline`,
    description: config.description,
  });
  builder.setInput({ type: 'image', multiple: false });
  builder.setOutput({ type: 'image' });
  for (const step of config.steps) {
    builder.add(step.capability, step.params, step.label);
  }
  return builder.build();
}

/**
 * 图片多步 pipeline hook(纯逻辑,无 UI)。
 *
 * 实现说明:
 *   - 用 WorkflowBuilder 构造 workflow(满足架构约束 + 用于 UI 展示节点信息)
 *   - 但执行时逐节点单独 run(因为 runtime.run 只返回最终输出,
 *     为了捕获中间结果,我们逐节点执行 + 链式传递 AssetId)
 */
export function useImagePipeline(
  options?: UseImagePipelineOptions
): UseImagePipelineResult {
  const { initialPreset = 'ecommerce', autoRun = true, onComplete } = options ?? {};
  const tool = useImageTool();
  const [preset, setPresetState] = useState<PipelinePreset>(initialPreset);
  const [steps, setSteps] = useState<PipelineStepOutput[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastRunInputId = useRef<string | null>(null);
  const lastNotifiedSignature = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // 用 useMemo 缓存 workflow,避免每次渲染都重建
  const workflow = useMemo(() => buildPipelineWorkflow(preset), [preset]);

  /** 实际执行 pipeline:逐节点 run,捕获每步输出 */
  const runPipeline = useCallback(
    async (nextPreset: PipelinePreset): Promise<void> => {
      if (!tool.runtime || !tool.inputId) return;
      const wf = buildPipelineWorkflow(nextPreset);
      setBusy(true);
      setError(null);
      setSteps([]);
      setCurrentStep(0);

      const collected: PipelineStepOutput[] = [];
      let currentInputId: AssetId = tool.inputId;

      try {
        for (let i = 0; i < wf.nodes.length; i++) {
          const node = wf.nodes[i]!;
          const nodeLabel = node.label ?? node.capability ?? `Step ${i + 1}`;
          const nodeCapability = node.capability ?? '';
          setCurrentStep(i);
          // 用单节点 workflow 包装当前节点能力(runtime.run 接口要求 Workflow)
          const stepWf = buildSingleStepImageWorkflow(
            nodeCapability,
            node.params ?? {},
            `PipelineStep-${i + 1}`,
            nodeLabel
          );
          const result = await tool.runtime.run(stepWf, [currentInputId]);
          if (result.status !== 'completed' || !result.outputs[0]) {
            throw new Error(
              result.error ?? `Step ${i + 1} (${nodeLabel}) failed`
            );
          }
          currentInputId = result.outputs[0];
          const blob = await tool.runtime.exportAsset(currentInputId);
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
        setCurrentStep(-1);

        // 触发 onComplete(用 collected 签名去重)
        if (collected.length > 0 && tool.inputInfo) {
          const finalStep = collected[collected.length - 1]!;
          const signature = `${tool.inputId}:${nextPreset}:${finalStep.blob.size}`;
          if (signature !== lastNotifiedSignature.current) {
            lastNotifiedSignature.current = signature;
            onCompleteRef.current?.({
              outputBlob: finalStep.blob,
              outputUrl: finalStep.url,
              inputSize: tool.inputInfo.size,
              outputSize: finalStep.info.size,
              preset: nextPreset,
              steps: collected,
            });
          }
        }
      } catch (err) {
        setCurrentStep(-1);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [tool.runtime, tool.inputId, tool.inputInfo]
  );

  // autoRun:inputId 变化时触发一次 pipeline
  useEffect(() => {
    if (tool.inputId && tool.ready && autoRun && lastRunInputId.current !== tool.inputId) {
      lastRunInputId.current = tool.inputId;
      void runPipeline(preset);
    }
    if (!tool.inputId) {
      lastRunInputId.current = null;
    }
  }, [tool.inputId, tool.ready, autoRun, preset, runPipeline]);

  // 切换预设:更新 state,并在已有输入时立即重跑
  const setPreset = useCallback(
    (next: PipelinePreset) => {
      setPresetState(next);
      if (tool.inputId && !busy) {
        lastRunInputId.current = tool.inputId;
        void runPipeline(next);
      }
    },
    [tool.inputId, busy, runPipeline]
  );

  const handleFiles = useCallback(
    async (files: File[]): Promise<void> => {
      // 换图时清理旧 steps 的 URL
      for (const s of steps) {
        URL.revokeObjectURL(s.url);
      }
      setSteps([]);
      setCurrentStep(-1);
      setError(null);
      await tool.handleFiles(files);
    },
    [tool, steps]
  );

  const reset = useCallback(() => {
    for (const s of steps) {
      URL.revokeObjectURL(s.url);
    }
    setSteps([]);
    setCurrentStep(-1);
    setError(null);
    tool.reset();
  }, [steps, tool]);

  const clearError = useCallback(() => setError(null), []);

  // 派生:最终输出 = 最后一步输出;无 steps 时回退到 tool 的输出
  // (pipeline 未运行时,tool.outputBlob 也为 null;回退主要用于测试原语渲染)
  const finalStep = steps.length > 0 ? steps[steps.length - 1] : null;

  return {
    ready: tool.ready,
    initError: tool.initError,
    inputUrl: tool.inputUrl,
    inputInfo: tool.inputInfo,
    steps,
    currentStep,
    outputBlob: finalStep?.blob ?? tool.outputBlob,
    outputUrl: finalStep?.url ?? tool.outputUrl,
    outputInfo: finalStep?.info ?? tool.outputInfo,
    busy,
    error: error ?? tool.error,
    preset,
    workflow,
    handleFiles,
    setPreset,
    reset,
    clearError,
    run: () => runPipeline(preset),
  };
}
