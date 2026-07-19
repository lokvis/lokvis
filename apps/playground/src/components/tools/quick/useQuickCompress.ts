/**
 * useQuickCompress — 图片一键压缩的纯逻辑 hook(Layer 0),无 UI。
 *
 * 行为:
 *   1. 复用 useImageTool(runtime + input/output 生命周期)
 *   2. 接收 initialPreset / autoRun / onComplete / inputBlob 选项
 *   3. autoRun=true 时,上传后自动压缩(用 useRef 标记 lastRunInputId 防止重复触发)
 *   4. 切换 preset 时,若有输入则自动重跑
 *   5. 输出完成后触发 onComplete(可串联到下一个 hook,用于 pipeline)
 *
 * 三方接入示例:
 * ```tsx
 * const { inputUrl, outputUrl, ratio, busy, error, handleFiles, preset, setPreset } = useQuickCompress();
 * ```
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useImageTool } from '@/components/toolkit/useImageTool';
import { buildSingleStepImageWorkflow } from '@/components/toolkit/workflow-builder';
import type { ImageInfo } from '@/components/toolkit/download';

/** 压缩预设。每个预设对应一组 (quality, format) */
export type CompressPreset = 'balanced' | 'highQuality' | 'small';

/** 预设参数表(见设计文档 §4.2.3) */
export const COMPRESS_PRESETS: Record<CompressPreset, { quality: number; format: string }> = {
  /** 均衡:80 / WebP(默认) */
  balanced: { quality: 80, format: 'webp' },
  /** 高质量:92 / WebP */
  highQuality: { quality: 92, format: 'webp' },
  /** 小体积:65 / WebP */
  small: { quality: 65, format: 'webp' },
};

/** Quick Action hook 通用 props(所有 useQuick<Tool> 共享) */
export interface UseQuickActionOptions<Preset extends string = string> {
  /** 初始预设,默认各 hook 自有默认值 */
  initialPreset?: Preset;
  /** 是否自动执行(默认 true;pipeline 中间节点可能需要手动触发) */
  autoRun?: boolean;
  /** 完成回调(可串联到下一个 hook / 外部状态) */
  onComplete?: (result: QuickActionResult) => void;
  /** 注入输入(用于 pipeline 模式:上一个 hook 的输出作为本 hook 输入) */
  inputBlob?: Blob | null;
}

/** onComplete 回调的结果对象 */
export interface QuickActionResult {
  outputBlob: Blob;
  outputUrl: string;
  inputSize: number;
  outputSize: number;
  preset: string;
}

/** useQuickCompress 返回值 */
export interface UseQuickCompressResult {
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

  // ─── 操作 ───
  handleFiles: (files: File[]) => Promise<void>;
  setPreset: (preset: CompressPreset) => void;
  reset: () => void;
  clearError: () => void;
  /** 手动触发执行(autoRun=false 时用) */
  run: () => Promise<void>;
}

/**
 * 图片一键压缩 hook(纯逻辑,无 UI)。
 */
export function useQuickCompress(
  options?: UseQuickActionOptions<CompressPreset>
): UseQuickCompressResult {
  const { initialPreset = 'balanced', autoRun = true, onComplete } = options ?? {};
  const tool = useImageTool();
  const [preset, setPresetState] = useState<CompressPreset>(initialPreset);

  // 用 ref 标记"已对当前 inputId 触发过压缩",避免 effect 在 preset 变化时重复触发
  const lastRunInputId = useRef<string | null>(null);
  // 用 ref 跟踪上次 onComplete 通知对应的 outputBlob,避免重复触发回调
  const lastNotifiedBlob = useRef<Blob | null>(null);
  // 用 ref 持有最新 onComplete,避免 effect 依赖它重建
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  /** 实际执行压缩(根据 preset 构造 workflow) */
  const runCompress = useCallback(
    async (nextPreset: CompressPreset): Promise<void> => {
      const config = COMPRESS_PRESETS[nextPreset];
      const wf = buildSingleStepImageWorkflow(
        'image.compress',
        { format: config.format, quality: config.quality },
        'QuickCompress',
        'Quick compress image with preset'
      );
      await tool.runWorkflow(wf);
    },
    [tool]
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
      });
    }
  }, [tool.outputBlob, tool.outputUrl, tool.inputInfo, tool.outputInfo, preset]);

  // autoRun:inputId 变化时触发一次压缩(preset 变化不自动重跑,见 setPreset)
  useEffect(() => {
    if (tool.inputId && tool.ready && autoRun && lastRunInputId.current !== tool.inputId) {
      lastRunInputId.current = tool.inputId;
      void runCompress(preset);
    }
    // inputId 被重置(reset)时清空标记
    if (!tool.inputId) {
      lastRunInputId.current = null;
    }
  }, [tool.inputId, tool.ready, autoRun, preset, runCompress]);

  // 切换预设:更新 state,并在已有输入时立即重跑
  const setPreset = useCallback(
    (next: CompressPreset) => {
      setPresetState(next);
      if (tool.inputId && !tool.busy) {
        lastRunInputId.current = tool.inputId;
        void runCompress(next);
      }
    },
    [tool.inputId, tool.busy, runCompress]
  );

  const handleFiles = useCallback(
    async (files: File[]): Promise<void> => {
      await tool.handleFiles(files);
    },
    [tool]
  );

  // 压缩率:输出比输入小时为正(节省),大时为负(增大)
  const ratio =
    tool.inputInfo && tool.outputInfo
      ? (1 - tool.outputInfo.size / tool.inputInfo.size) * 100
      : null;

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
    handleFiles,
    setPreset,
    reset: tool.reset,
    clearError: tool.clearError,
    run: () => runCompress(preset),
  };
}
