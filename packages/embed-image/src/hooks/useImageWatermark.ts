/**
 * useImageWatermark — 图片一键加水印的纯逻辑 hook(Layer 0),无 UI。
 *
 * 行为:
 *   1. 复用 useImageTool(runtime + input/output 生命周期)
 *   2. 接收 initialPreset / initialText / autoRun / onComplete / inputBlob 选项
 *   3. autoRun=true 时,上传后自动加水印(用 useRef 标记 lastRunInputId 防止重复触发)
 *   4. 切换 preset 或 text 时,若有输入则自动重跑
 *   5. 输出完成后触发 onComplete(可串联到下一个 hook,用于 pipeline)
 *
 * 3 个预设(见设计文档 §4.2.3):
 *   - small-br:       右下角小字(position=bottom-right, fontSize=16, opacity=0.7)
 *   - large-center:   居中大字(position=center, fontSize=64, opacity=0.5)
 *   - tile:           平铺水印(position=tile, fontSize=24, opacity=0.3)
 *
 * 默认水印文字: 'Lokvis'
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

// 重新导出共享类型
export type { UseEmbedActionOptions, EmbedActionResult };

/** 水印位置预设 */
export type WatermarkPreset = 'small-br' | 'large-center' | 'tile';

/** 预设参数表 */
export interface WatermarkPresetConfig {
  /** 水印位置 */
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'tile';
  /** 字号 px */
  fontSize: number;
  /** 不透明度 0-1 */
  opacity: number;
  /** 颜色 */
  color: string;
  /** 简介(供 UI 展示) */
  label: string;
}

export const IMAGE_WATERMARK_PRESETS: Record<WatermarkPreset, WatermarkPresetConfig> = {
  /** 右下角小字 */
  'small-br': {
    position: 'bottom-right',
    fontSize: 16,
    opacity: 0.7,
    color: '#ffffff',
    label: 'Bottom-right small',
  },
  /** 居中大字 */
  'large-center': {
    position: 'center',
    fontSize: 64,
    opacity: 0.5,
    color: '#ffffff',
    label: 'Center large',
  },
  /** 平铺水印 */
  tile: {
    position: 'tile',
    fontSize: 24,
    opacity: 0.3,
    color: '#ffffff',
    label: 'Tiled',
  },
};

/** 默认水印文字 */
export const DEFAULT_WATERMARK_TEXT = 'Lokvis';

/** useImageWatermark 选项(扩展 UseEmbedActionOptions) */
export interface UseImageWatermarkOptions extends UseEmbedActionOptions<WatermarkPreset> {
  /** 初始水印文字,默认 'Lokvis' */
  initialText?: string;
}

/** useImageWatermark 返回值 */
export interface UseImageWatermarkResult {
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
  /** 当前位置预设 */
  preset: WatermarkPreset;
  /** 当前水印文字 */
  text: string;

  // ─── 操作 ───
  handleFiles: (files: File[]) => Promise<void>;
  setPreset: (preset: WatermarkPreset) => void;
  /** 更新水印文字(若有输入则立即重跑) */
  setText: (text: string) => void;
  reset: () => void;
  clearError: () => void;
  /** 手动触发执行(autoRun=false 时用) */
  run: () => Promise<void>;
}

/**
 * 图片一键加水印 hook(纯逻辑,无 UI)。
 */
export function useImageWatermark(
  options?: UseImageWatermarkOptions
): UseImageWatermarkResult {
  const {
    initialPreset = 'small-br',
    initialText = DEFAULT_WATERMARK_TEXT,
    autoRun = true,
    onComplete,
    inputBlob,
    plugins,
  } = options ?? {};
  const tool = useImageTool(plugins);
  // inputBlob 注入:走与手动上传相同的路径(见 useInputBlobImport)
  useInputBlobImport(tool, inputBlob);
  const [preset, setPresetState] = useState<WatermarkPreset>(initialPreset);
  const [text, setTextState] = useState<string>(initialText);

  const lastRunInputId = useRef<string | null>(null);
  const lastNotifiedBlob = useRef<Blob | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  /** 实际执行加水印(根据 preset + text 构造 workflow) */
  const runWatermark = useCallback(
    async (nextPreset: WatermarkPreset, nextText: string): Promise<void> => {
      const config = IMAGE_WATERMARK_PRESETS[nextPreset];
      const params: Record<string, unknown> = {
        text: nextText,
        position: config.position,
        fontSize: config.fontSize,
        opacity: config.opacity,
        color: config.color,
      };
      const wf = buildSingleStepImageWorkflow(
        'image.watermark',
        params,
        'ImageWatermark',
        'Quick add watermark with preset'
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

  // autoRun:inputId 变化时触发一次加水印
  useEffect(() => {
    if (tool.inputId && tool.ready && autoRun && lastRunInputId.current !== tool.inputId) {
      lastRunInputId.current = tool.inputId;
      void runWatermark(preset, text);
    }
    if (!tool.inputId) {
      lastRunInputId.current = null;
    }
  }, [tool.inputId, tool.ready, autoRun, preset, text, runWatermark]);

  // 切换预设:更新 state,并在已有输入时立即重跑
  const setPreset = useCallback(
    (next: WatermarkPreset) => {
      setPresetState(next);
      if (tool.inputId && !tool.busy) {
        lastRunInputId.current = tool.inputId;
        void runWatermark(next, text);
      }
    },
    [tool.inputId, tool.busy, text, runWatermark]
  );

  // 更新文字:更新 state,并在已有输入时立即重跑
  const setText = useCallback(
    (next: string) => {
      setTextState(next);
      if (tool.inputId && !tool.busy) {
        lastRunInputId.current = tool.inputId;
        void runWatermark(preset, next);
      }
    },
    [tool.inputId, tool.busy, preset, runWatermark]
  );

  const handleFiles = useCallback(
    async (files: File[]): Promise<void> => {
      await tool.handleFiles(files);
    },
    [tool]
  );

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
    text,
    handleFiles,
    setPreset,
    setText,
    reset: tool.reset,
    clearError: tool.clearError,
    run: () => runWatermark(preset, text),
  };
}
