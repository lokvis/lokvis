/**
 * useImageCompress — 图片一键压缩的纯逻辑 hook(Layer 0),无 UI。
 *
 * 行为:
 *   1. 复用 useImageTool(runtime + input/output 生命周期)
 *   2. 接收 initialPreset / autoRun / onComplete / inputBlob / targetSizeKB 选项
 *   3. autoRun=true 时,上传后自动压缩(用 useRef 标记 lastRunInputId 防止重复触发)
 *   4. 切换 preset 时,若有输入则自动重跑
 *   5. 输出完成后触发 onComplete(可串联到下一个 hook,用于 pipeline)
 *
 * 两种模式:
 *   - 预设模式(默认):按 preset 的 (quality, format) 单次压缩
 *   - 目标模式(targetSizeKB 设置后):preset 仅作初始质量,质量二分迭代逼近目标体积;
 *     q=5 仍超标时降维回退(最多 2 次);仍不达标则返回最小结果并 targetMet=false
 *
 * 三方接入示例:
 * ```tsx
 * const { inputUrl, outputUrl, ratio, busy, error, handleFiles, preset, setPreset } = useImageCompress();
 * // 目标模式:
 * const { targetMet, effectiveQuality, setTargetSizeKB } = useImageCompress({ targetSizeKB: 200 });
 * ```
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PluginLoadEntry } from '@lokvis/sdk';
import { useImageTool, type UseImageToolResult } from '../internal/useImageTool';
import {
  buildSingleStepImageWorkflow,
  buildResizeCompressWorkflow,
} from '../internal/workflow-builder';
import type { ImageInfo } from '../internal/download';

/** 压缩预设。每个预设对应一组 (quality, format) */
export type CompressPreset = 'balanced' | 'highQuality' | 'small';

/** 预设参数表(见设计文档 §4.2.3) */
export const IMAGE_COMPRESS_PRESETS: Record<CompressPreset, { quality: number; format: string }> = {
  /** 均衡:80 / WebP(默认) */
  balanced: { quality: 80, format: 'webp' },
  /** 高质量:92 / WebP */
  highQuality: { quality: 92, format: 'webp' },
  /** 小体积:65 / WebP */
  small: { quality: 65, format: 'webp' },
};

/** Quick Action hook 通用 props(所有 useQuick<Tool> 共享) */
export interface UseEmbedActionOptions<Preset extends string = string> {
  /** 初始预设,默认各 hook 自有默认值 */
  initialPreset?: Preset;
  /** 是否自动执行(默认 true;pipeline 中间节点可能需要手动触发) */
  autoRun?: boolean;
  /** 完成回调(可串联到下一个 hook / 外部状态) */
  onComplete?: (result: EmbedActionResult) => void;
  /** 注入输入(用于 pipeline 模式:上一个 hook 的输出作为本 hook 输入) */
  inputBlob?: Blob | null;
  /**
   * 预加载插件列表(W23)。透传给底层 useLokvisRuntime。
   * - undefined(默认):使用 [imageToolsPlugin()](向后兼容)
   * - []:显式不加载任何插件
   * - [imageToolsPlugin(), audioToolsPlugin(), ...]:三方组合多媒体插件
   */
  plugins?: PluginLoadEntry[];
}

/** useImageCompress 专属选项(在通用选项上扩展目标体积) */
export interface UseImageCompressOptions extends UseEmbedActionOptions<CompressPreset> {
  /** 目标输出大小(KB)。设置后进入 target 模式:preset 仅作初始质量,压缩改为质量二分迭代 */
  targetSizeKB?: number;
}

/** onComplete 回调的结果对象 */
export interface EmbedActionResult {
  outputBlob: Blob;
  outputUrl: string;
  inputSize: number;
  outputSize: number;
  preset: string;
  /** 实际生效质量(target 模式返回;预设模式为 undefined) */
  quality?: number;
  /** 目标体积 KB(target 模式返回) */
  targetSizeKB?: number;
  /** 是否达标(target 模式返回;false 表示已诚实降级到最小结果) */
  targetMet?: boolean;
}

// ─── target-size 迭代常量 ─────────────────────────────────────
/** target 模式固定输出格式(与现有 presets 一致) */
const TARGET_FORMAT = 'webp';
/** 质量二分下界 */
const TARGET_QUALITY_LO = 5;
/** 质量二分上界 */
const TARGET_QUALITY_HI = 95;
/** 质量二分最多轮数(log₂(90) ≈ 6.5,取 7) */
const TARGET_MAX_QUALITY_ROUNDS = 7;
/** 降维回退最多次数 */
const TARGET_MAX_RESIZE_ATTEMPTS = 2;

/** target-size 压缩迭代结果 */
interface TargetCompressOutcome {
  blob: Blob;
  /** 实际生效质量 */
  quality: number;
  /** 是否达标 */
  targetMet: boolean;
}

/**
 * 目标体积压缩迭代算法。
 *
 * Phase 1 质量二分:从 preset 质量出发,在 [5, 95] 内搜索满足目标的最高质量,
 *   最多 7 轮。探测轮用 tool.runWorkflowRaw()(不污染 output 状态)+
 *   runtime.exportAsset 取 blob 测大小。
 * Phase 2 降维回退:q=5 仍超标时,按 sqrt(target/size) 缩边(两步 resize→compress
 *   workflow),最多 2 次;仍不达标则返回最小结果并 targetMet=false(诚实降级)。
 *
 * 收敛后调用方经 tool.commitOutput(best blob) 写入 output 状态,避免重复编码。
 *
 * @param tool useImageTool 实例(提供 runWorkflowRaw / runtime / commitOutput)
 * @param targetBytes 目标体积(字节)
 * @param initialQuality 初始质量(preset quality)
 * @param inputInfo 输入图片信息(降维回退需要宽高;null 时跳过回退)
 */
async function runCompressToTarget(
  tool: UseImageToolResult,
  targetBytes: number,
  initialQuality: number,
  inputInfo: ImageInfo | null
): Promise<TargetCompressOutcome | null> {
  const runtime = tool.runtime;
  if (!runtime) return null;

  /** 探测指定质量下的输出 blob(单步 compress,不写 output 状态) */
  const probeQuality = async (quality: number): Promise<Blob | null> => {
    const wf = buildSingleStepImageWorkflow(
      'image.compress',
      { format: TARGET_FORMAT, quality },
      'ImageCompressProbe',
      'Probe compressed size at quality'
    );
    const result = await tool.runWorkflowRaw(wf);
    if (!result || result.status !== 'completed' || !result.outputs[0]) return null;
    return await runtime.exportAsset(result.outputs[0]);
  };

  /** 探测"精确尺寸 + 低质量"下的输出 blob(两步 resize→compress,降维回退用) */
  const probeResized = async (
    width: number,
    height: number,
    quality: number
  ): Promise<Blob | null> => {
    const wf = buildResizeCompressWorkflow(width, height, quality, TARGET_FORMAT);
    const result = await tool.runWorkflowRaw(wf);
    if (!result || result.status !== 'completed' || !result.outputs[0]) return null;
    return await runtime.exportAsset(result.outputs[0]);
  };

  // ── Phase 1:质量二分 ──
  let lo = TARGET_QUALITY_LO;
  let hi = TARGET_QUALITY_HI;
  let quality = Math.min(TARGET_QUALITY_HI, Math.max(TARGET_QUALITY_LO, Math.round(initialQuality)));
  let best: { blob: Blob; quality: number } | null = null;
  let smallest: { blob: Blob; quality: number } | null = null;

  for (let round = 0; round < TARGET_MAX_QUALITY_ROUNDS && lo <= hi; round++) {
    const blob = await probeQuality(quality);
    if (!blob) return null;
    if (!smallest || blob.size < smallest.blob.size) {
      smallest = { blob, quality };
    }
    if (blob.size <= targetBytes) {
      best = { blob, quality };
      lo = quality + 1; // 已达标,尝试更高质量
    } else {
      hi = quality - 1; // 超标,降低质量
    }
    quality = Math.floor((lo + hi) / 2);
  }

  if (best) {
    return { blob: best.blob, quality: best.quality, targetMet: true };
  }

  // ── Phase 2:降维回退(q=5 仍超标) ──
  if (!smallest) return null;
  let base = smallest;
  let curW = inputInfo?.width ?? 0;
  let curH = inputInfo?.height ?? 0;

  if (curW > 0 && curH > 0) {
    for (let attempt = 0; attempt < TARGET_MAX_RESIZE_ATTEMPTS; attempt++) {
      const scale = Math.sqrt(targetBytes / base.blob.size);
      if (!Number.isFinite(scale) || scale >= 1) break;
      curW = Math.max(1, Math.round(curW * scale));
      curH = Math.max(1, Math.round(curH * scale));
      const blob = await probeResized(curW, curH, TARGET_QUALITY_LO);
      if (!blob) return null;
      if (blob.size <= targetBytes) {
        return { blob, quality: TARGET_QUALITY_LO, targetMet: true };
      }
      base = { blob, quality: TARGET_QUALITY_LO };
    }
  }

  // 诚实降级:返回最小结果,targetMet=false
  return { blob: base.blob, quality: base.quality, targetMet: false };
}

/** useImageCompress 返回值 */
export interface UseImageCompressResult {
  // ─── 状态 ───
  /** runtime 是否初始化完成 */
  ready: boolean;
  /** runtime 初始化错误 */
  initError: string | null;
  /** 输入预览 URL */
  inputUrl: string | null;
  /** 输入图片信息 */
  inputInfo: ImageInfo | null;
  /** 输出预览 URL */
  outputUrl: string | null;
  /** 输出图片信息 */
  outputInfo: ImageInfo | null;
  /** 输出 Blob */
  outputBlob: Blob | null;
  /** 处理中 */
  busy: boolean;
  /** workflow 执行错误 */
  error: string | null;
  /** 当前预设 */
  preset: CompressPreset;
  /** 压缩率(-100 ~ 100,负值表示增大;null 表示无输出) */
  ratio: number | null;
  /** 目标输出大小 KB(null 表示预设模式) */
  targetSizeKB: number | null;
  /** 是否达标(null 表示预设模式或 target 模式尚未完成) */
  targetMet: boolean | null;
  /** 实际生效质量(null 表示预设模式或尚未完成) */
  effectiveQuality: number | null;

  // ─── 操作 ───
  handleFiles: (files: File[]) => Promise<void>;
  setPreset: (preset: CompressPreset) => void;
  /** 设置/清除目标体积 KB(null 切回预设模式),并立即重跑 */
  setTargetSizeKB: (kb: number | null) => void;
  reset: () => void;
  clearError: () => void;
  /** 手动触发执行(autoRun=false 时用) */
  run: () => Promise<void>;
}

/**
 * 图片一键压缩 hook(纯逻辑,无 UI)。
 */
export function useImageCompress(
  options?: UseImageCompressOptions
): UseImageCompressResult {
  const {
    initialPreset = 'balanced',
    autoRun = true,
    onComplete,
    plugins,
    targetSizeKB: initialTargetSizeKB,
  } = options ?? {};
  const tool = useImageTool(plugins);
  const [preset, setPresetState] = useState<CompressPreset>(initialPreset);
  const [targetSizeKB, setTargetSizeKBState] = useState<number | null>(
    initialTargetSizeKB ?? null
  );
  const [targetMet, setTargetMet] = useState<boolean | null>(null);
  const [effectiveQuality, setEffectiveQuality] = useState<number | null>(null);

  // 用 ref 标记"已对当前 inputId 触发过压缩",避免 effect 在 preset 变化时重复触发
  const lastRunInputId = useRef<string | null>(null);
  // 用 ref 跟踪上次 onComplete 通知对应的 outputBlob,避免重复触发回调
  const lastNotifiedBlob = useRef<Blob | null>(null);
  // 用 ref 持有最新 onComplete,避免 effect 依赖它重建
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  // 用 ref 持有最新 tool,使回调 deps 稳定(tool 对象每次 render 新建)
  const toolRef = useRef(tool);
  toolRef.current = tool;
  // 覆盖整个 runCompress 生命周期的并发锁(target 模式多轮 probe 间 busy 会瞬间为 false)
  const runningRef = useRef(false);

  /** 实际执行压缩:按 targetKB 分支为 target 模式 / 预设模式 */
  const runCompress = useCallback(
    async (nextPreset: CompressPreset, targetKB: number | null): Promise<void> => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        const t = toolRef.current;
        const config = IMAGE_COMPRESS_PRESETS[nextPreset];
        if (targetKB != null && targetKB > 0) {
          // target 模式:质量二分迭代(+ 降维回退)
          const outcome = await runCompressToTarget(
            t,
            targetKB * 1024,
            config.quality,
            t.inputInfo
          );
          if (outcome) {
            // 先写 effectiveQuality/targetMet 再 commit blob,保证 onComplete 读到正确值
            setEffectiveQuality(outcome.quality);
            setTargetMet(outcome.targetMet);
            await t.commitOutput(outcome.blob);
          }
        } else {
          // 预设模式:单次压缩
          setEffectiveQuality(null);
          setTargetMet(null);
          const wf = buildSingleStepImageWorkflow(
            'image.compress',
            { format: config.format, quality: config.quality },
            'ImageCompress',
            'Quick compress image with preset'
          );
          await t.runWorkflow(wf);
        }
      } finally {
        runningRef.current = false;
      }
    },
    []
  );

  // output 完成后触发 onComplete(只在 outputBlob 变化时通知一次)
  useEffect(() => {
    if (
      tool.outputBlob &&
      tool.outputBlob !== lastNotifiedBlob.current &&
      tool.inputInfo &&
      tool.outputInfo &&
      tool.outputUrl
    ) {
      lastNotifiedBlob.current = tool.outputBlob;
      onCompleteRef.current?.({
        outputBlob: tool.outputBlob,
        outputUrl: tool.outputUrl,
        inputSize: tool.inputInfo.size,
        outputSize: tool.outputInfo.size,
        preset,
        quality: effectiveQuality ?? undefined,
        targetSizeKB: targetSizeKB ?? undefined,
        targetMet: targetMet ?? undefined,
      });
    }
  }, [
    tool.outputBlob,
    tool.outputUrl,
    tool.inputInfo,
    tool.outputInfo,
    preset,
    effectiveQuality,
    targetSizeKB,
    targetMet,
  ]);

  // autoRun:inputId 变化时触发一次压缩(preset 变化不自动重跑,见 setPreset)
  useEffect(() => {
    if (
      tool.inputId &&
      tool.ready &&
      autoRun &&
      !runningRef.current &&
      lastRunInputId.current !== tool.inputId
    ) {
      lastRunInputId.current = tool.inputId;
      void runCompress(preset, targetSizeKB);
    }
    // inputId 被重置(reset)时清空标记
    if (!tool.inputId) {
      lastRunInputId.current = null;
    }
  }, [tool.inputId, tool.ready, autoRun, preset, targetSizeKB, runCompress]);

  // 切换预设:更新 state,并在已有输入时立即重跑
  const setPreset = useCallback(
    (next: CompressPreset) => {
      setPresetState(next);
      const t = toolRef.current;
      if (t.inputId && !runningRef.current) {
        lastRunInputId.current = t.inputId;
        void runCompress(next, targetSizeKB);
      }
    },
    [targetSizeKB, runCompress]
  );

  // 设置/清除目标体积:更新 state,并在已有输入时立即重跑
  const setTargetSizeKB = useCallback(
    (kb: number | null) => {
      setTargetSizeKBState(kb);
      const t = toolRef.current;
      if (t.inputId && !runningRef.current) {
        lastRunInputId.current = t.inputId;
        void runCompress(preset, kb);
      }
    },
    [preset, runCompress]
  );

  const handleFiles = useCallback(async (files: File[]): Promise<void> => {
    await toolRef.current.handleFiles(files);
  }, []);

  // 压缩率:输出比输入小时为正(节省),大时为负(增大)
  const ratio =
    tool.inputInfo && tool.outputInfo
      ? (1 - tool.outputInfo.size / tool.inputInfo.size) * 100
      : null;

  /** 手动触发(autoRun=false 时用) */
  const run = useCallback(() => runCompress(preset, targetSizeKB), [preset, targetSizeKB, runCompress]);

  return {
    ready: tool.ready,
    initError: tool.initError,
    inputUrl: tool.inputUrl,
    inputInfo: tool.inputInfo,
    outputUrl: tool.outputUrl,
    outputInfo: tool.outputInfo,
    outputBlob: tool.outputBlob,
    busy: tool.busy,
    error: tool.error,
    preset,
    ratio,
    targetSizeKB,
    targetMet,
    effectiveQuality,
    handleFiles,
    setPreset,
    setTargetSizeKB,
    reset: tool.reset,
    clearError: tool.clearError,
    run,
  };
}
