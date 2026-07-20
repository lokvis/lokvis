/**
 * useQuickResize — 图片一键缩放的纯逻辑 hook(Layer 0),无 UI。
 *
 * 行为:
 *   1. 复用 useImageTool(runtime + input/output 生命周期)
 *   2. 接收 initialPreset / autoRun / onComplete / inputBlob 选项
 *   3. autoRun=true 时,上传后自动缩放(用 useRef 标记 lastRunInputId 防止重复触发)
 *   4. 切换 preset 时,若有输入则自动重跑
 *   5. 输出完成后触发 onComplete(可串联到下一个 hook,用于 pipeline)
 *
 * 4 个预设(见设计文档 §4.2.3):
 *   - ig-square:     IG 1:1   1080×1080
 *   - yt-landscape:  YouTube 16:9  1280×720
 *   - tk-portrait:   TikTok 9:16   1080×1920
 *   - half:          原图 50%(按 inputInfo 计算)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useImageTool } from '../internal/useImageTool';
import { buildSingleStepImageWorkflow } from '../internal/workflow-builder';
import type { ImageInfo } from '../internal/download';
import {
  type UseQuickActionOptions,
  type QuickActionResult,
} from './useQuickCompress';

// 重新导出共享类型,供 Layer 1/2 引用(避免跨文件直接依赖 useQuickCompress)
export type { UseQuickActionOptions, QuickActionResult };

/** 缩放预设。 */
export type ResizePreset = 'ig-square' | 'yt-landscape' | 'tk-portrait' | 'half';

/**
 * 预设参数表:
 *   - 固定尺寸预设:width / height(单位 px)
 *   - 比例缩放预设:scale(0~1,基于原图尺寸)
 */
export interface ResizePresetConfig {
  /** 目标宽度(px)。与 scale 互斥 */
  width?: number;
  /** 目标高度(px)。与 scale 互斥 */
  height?: number;
  /** 缩放系数(0~1),基于原图尺寸。与 width/height 互斥 */
  scale?: number;
  /** 简介(供 UI 展示) */
  label: string;
}

export const RESIZE_PRESETS: Record<ResizePreset, ResizePresetConfig> = {
  /** IG 1:1 1080×1080 */
  'ig-square': { width: 1080, height: 1080, label: 'Instagram 1:1' },
  /** YouTube 16:9 1280×720 */
  'yt-landscape': { width: 1280, height: 720, label: 'YouTube 16:9' },
  /** TikTok 9:16 1080×1920 */
  'tk-portrait': { width: 1080, height: 1920, label: 'TikTok 9:16' },
  /** 原图 50% */
  half: { scale: 0.5, label: '50% of original' },
};

/** useQuickResize 返回值 */
export interface UseQuickResizeResult {
  // ─── 状态 ───
  ready: boolean;
  initError: string | null;
  inputUrl: string | null;
  inputInfo: ImageInfo | null;
  outputUrl: string | null;
  outputInfo: ImageInfo | null;
  outputBlob: Blob | null;
  busy: boolean;
  error: string | null;
  /** 当前预设 */
  preset: ResizePreset;
  /** 输出尺寸(像素字符串,如 '1280×720';无输出时为 null) */
  outputDimension: string | null;

  // ─── 操作 ───
  handleFiles: (files: File[]) => Promise<void>;
  setPreset: (preset: ResizePreset) => void;
  reset: () => void;
  clearError: () => void;
  /** 手动触发执行(autoRun=false 时用) */
  run: () => Promise<void>;
}

/**
 * 根据 preset + 输入信息构造 resize 参数。
 * 'half' 预设需要 inputInfo 计算目标尺寸。
 */
function buildResizeParams(
  preset: ResizePreset,
  inputInfo: ImageInfo | null
): { width?: number; height?: number; maintainAspectRatio?: boolean } {
  const config = RESIZE_PRESETS[preset];
  if (config.scale !== undefined) {
    if (!inputInfo) {
      // 没有 inputInfo 时,scale 预设无法计算,回退到不缩放
      return {};
    }
    return {
      width: Math.max(1, Math.round(inputInfo.width * config.scale)),
      height: Math.max(1, Math.round(inputInfo.height * config.scale)),
      maintainAspectRatio: true,
    };
  }
  return {
    width: config.width,
    height: config.height,
    maintainAspectRatio: true,
  };
}

/**
 * 图片一键缩放 hook(纯逻辑,无 UI)。
 */
export function useQuickResize(
  options?: UseQuickActionOptions<ResizePreset>
): UseQuickResizeResult {
  const { initialPreset = 'ig-square', autoRun = true, onComplete, plugins } = options ?? {};
  const tool = useImageTool(plugins);
  const [preset, setPresetState] = useState<ResizePreset>(initialPreset);

  const lastRunInputId = useRef<string | null>(null);
  const lastNotifiedBlob = useRef<Blob | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  /** 实际执行缩放(根据 preset 构造 workflow) */
  const runResize = useCallback(
    async (nextPreset: ResizePreset): Promise<void> => {
      const params = buildResizeParams(nextPreset, tool.inputInfo);
      const wf = buildSingleStepImageWorkflow(
        'image.resize',
        params,
        'QuickResize',
        'Quick resize image with preset'
      );
      await tool.runWorkflow(wf);
    },
    [tool]
  );

  // output 完成后触发 onComplete
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

  // autoRun:inputId 变化时触发一次缩放
  useEffect(() => {
    if (tool.inputId && tool.ready && autoRun && lastRunInputId.current !== tool.inputId) {
      lastRunInputId.current = tool.inputId;
      void runResize(preset);
    }
    if (!tool.inputId) {
      lastRunInputId.current = null;
    }
  }, [tool.inputId, tool.ready, autoRun, preset, runResize]);

  // 切换预设:更新 state,并在已有输入时立即重跑
  const setPreset = useCallback(
    (next: ResizePreset) => {
      setPresetState(next);
      if (tool.inputId && !tool.busy) {
        lastRunInputId.current = tool.inputId;
        void runResize(next);
      }
    },
    [tool.inputId, tool.busy, runResize]
  );

  const handleFiles = useCallback(
    async (files: File[]): Promise<void> => {
      await tool.handleFiles(files);
    },
    [tool]
  );

  const outputDimension = tool.outputInfo
    ? `${tool.outputInfo.width}×${tool.outputInfo.height}`
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
    outputDimension,
    handleFiles,
    setPreset,
    reset: tool.reset,
    clearError: tool.clearError,
    run: () => runResize(preset),
  };
}
