/**
 * useImageCrop — 图片一键裁剪的纯逻辑 hook(Layer 0),无 UI。
 *
 * 行为:
 *   1. 复用 useImageTool(runtime + input/output 生命周期)
 *   2. 接收 initialPreset / autoRun / onComplete / inputBlob 选项
 *   3. autoRun=true 时,上传后自动裁剪(用 useRef 标记 lastRunInputId 防止重复触发)
 *   4. 切换 preset 时,若有输入则自动重跑
 *   5. 输出完成后触发 onComplete(可串联到下一个 hook,用于 pipeline)
 *
 * 4 个预设(见设计文档 §4.2.3):
 *   - square:  1:1 居中裁剪
 *   - 4:3:     4:3 居中裁剪
 *   - 16:9:    16:9 居中裁剪
 *   - free:    自由(默认裁剪为整图,即不裁剪)
 *
 * 裁剪区域由 preset + inputInfo 计算:保持目标宽高比,居中,最大化利用原图。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useImageTool } from '../internal/useImageTool';
import { useInputBlobImport } from '../internal/useInputBlobImport';
import { buildSingleStepImageWorkflow } from '../internal/workflow-builder';
import type { ImageInfo } from '../internal/download';
import {
  type UseEmbedActionOptions,
  type EmbedActionResult,
} from './useImageCompress';

// 重新导出共享类型,供 Layer 1/2 引用(避免跨文件直接依赖 useImageCompress)
export type { UseEmbedActionOptions, EmbedActionResult };

/** 裁剪预设。 */
export type CropPreset = 'square' | '4:3' | '16:9' | 'free';

/** 裁剪区域(x/y/width/height,单位 px,基于原图坐标系) */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 预设参数表:
 *   - aspectRatio:目标宽高比(width/height),null 表示自由(整图)
 */
export interface CropPresetConfig {
  /** 目标宽高比(width/height);null 表示自由 */
  aspectRatio: number | null;
  /** 简介(供 UI 展示) */
  label: string;
}

export const IMAGE_CROP_PRESETS: Record<CropPreset, CropPresetConfig> = {
  /** 1:1 正方形 */
  square: { aspectRatio: 1, label: '1:1 Square' },
  /** 4:3 */
  '4:3': { aspectRatio: 4 / 3, label: '4:3' },
  /** 16:9 */
  '16:9': { aspectRatio: 16 / 9, label: '16:9' },
  /** 自由裁剪(默认整图) */
  free: { aspectRatio: null, label: 'Free' },
};

/** useImageCrop 返回值 */
export interface UseImageCropResult {
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
  preset: CropPreset;
  /** 当前裁剪区域(基于 inputInfo 计算;无输入时为 null) */
  cropRect: CropRect | null;
  /** 输出尺寸(像素字符串,如 '800×600';无输出时为 null) */
  outputDimension: string | null;

  // ─── 操作 ───
  handleFiles: (files: File[]) => Promise<void>;
  setPreset: (preset: CropPreset) => void;
  reset: () => void;
  clearError: () => void;
  /** 手动触发执行(autoRun=false 时用) */
  run: () => Promise<void>;
}

/**
 * 根据 preset + 输入信息计算居中裁剪区域。
 * - 有 aspectRatio 时:保持目标比例,居中,最大化利用原图
 * - aspectRatio=null(free 预设):返回整图(即不裁剪)
 * - 无 inputInfo 时:返回 null
 */
export function computeCropRect(
  preset: CropPreset,
  inputInfo: ImageInfo | null
): CropRect | null {
  if (!inputInfo) return null;
  const { width: W, height: H } = inputInfo;
  const config = IMAGE_CROP_PRESETS[preset];
  if (config.aspectRatio === null) {
    return { x: 0, y: 0, width: W, height: H };
  }
  const R = config.aspectRatio;
  // inputAR = W/H;若 > R 说明原图偏宽,需裁掉左右;否则裁掉上下
  const inputAR = W / H;
  let cropW: number;
  let cropH: number;
  if (inputAR > R) {
    // 原图更宽:高度取满,宽度 = H * R
    cropH = H;
    cropW = H * R;
  } else {
    // 原图更高:宽度取满,高度 = W / R
    cropW = W;
    cropH = W / R;
  }
  // 居中
  const x = Math.max(0, Math.round((W - cropW) / 2));
  const y = Math.max(0, Math.round((H - cropH) / 2));
  return {
    x,
    y,
    width: Math.round(cropW),
    height: Math.round(cropH),
  };
}

/**
 * 图片一键裁剪 hook(纯逻辑,无 UI)。
 */
export function useImageCrop(
  options?: UseEmbedActionOptions<CropPreset>
): UseImageCropResult {
  const { initialPreset = 'square', autoRun = true, onComplete, inputBlob, plugins } = options ?? {};
  const tool = useImageTool(plugins);
  // inputBlob 注入:走与手动上传相同的路径(见 useInputBlobImport)
  useInputBlobImport(tool, inputBlob);
  const [preset, setPresetState] = useState<CropPreset>(initialPreset);

  const lastRunInputId = useRef<string | null>(null);
  const lastNotifiedBlob = useRef<Blob | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  /** 实际执行裁剪(根据 preset + inputInfo 构造 workflow) */
  const runCrop = useCallback(
    async (nextPreset: CropPreset): Promise<void> => {
      const rect = computeCropRect(nextPreset, tool.inputInfo);
      if (!rect) {
        // 没有 inputInfo 时无法计算裁剪区域,跳过(由调用方保证 autoRun 等 input 就绪)
        return;
      }
      const params: Record<string, unknown> = {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
      const wf = buildSingleStepImageWorkflow(
        'image.crop',
        params,
        'ImageCrop',
        'Quick crop image with preset aspect ratio'
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

  // autoRun:inputId 变化时触发一次裁剪
  useEffect(() => {
    if (tool.inputId && tool.ready && autoRun && lastRunInputId.current !== tool.inputId) {
      lastRunInputId.current = tool.inputId;
      void runCrop(preset);
    }
    if (!tool.inputId) {
      lastRunInputId.current = null;
    }
  }, [tool.inputId, tool.ready, autoRun, preset, runCrop]);

  // 切换预设:更新 state,并在已有输入时立即重跑
  const setPreset = useCallback(
    (next: CropPreset) => {
      setPresetState(next);
      if (tool.inputId && !tool.busy) {
        lastRunInputId.current = tool.inputId;
        void runCrop(next);
      }
    },
    [tool.inputId, tool.busy, runCrop]
  );

  const handleFiles = useCallback(
    async (files: File[]): Promise<void> => {
      await tool.handleFiles(files);
    },
    [tool]
  );

  const cropRect = computeCropRect(preset, tool.inputInfo);
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
    cropRect,
    outputDimension,
    handleFiles,
    setPreset,
    reset: tool.reset,
    clearError: tool.clearError,
    run: () => runCrop(preset),
  };
}
