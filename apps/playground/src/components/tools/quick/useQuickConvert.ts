/**
 * useQuickConvert — 图片一键格式转换的纯逻辑 hook(Layer 0),无 UI。
 *
 * 行为:
 *   1. 复用 useImageTool(runtime + input/output 生命周期)
 *   2. 接收 initialPreset / autoRun / onComplete / inputBlob 选项
 *   3. autoRun=true 时,上传后自动转换(用 useRef 标记 lastRunInputId 防止重复触发)
 *   4. 切换 preset 时,若有输入则自动重跑
 *   5. 输出完成后触发 onComplete(可串联到下一个 hook,用于 pipeline)
 *
 * 4 个预设(见设计文档 §4.2.3):
 *   - png:   PNG(无损,适合透明图)
 *   - webp:  WebP(高质量压缩,默认 q=90)
 *   - avif:  AVIF(最高压缩率,默认 q=80)
 *   - jpeg:  JPEG(有损,无透明,默认 q=90)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useImageTool } from '@/components/toolkit/useImageTool';
import { buildSingleStepImageWorkflow } from '@/components/toolkit/workflow-builder';
import type { ImageInfo } from '@/components/toolkit/download';
import {
  type UseQuickActionOptions,
  type QuickActionResult,
} from './useQuickCompress';

// 重新导出共享类型
export type { UseQuickActionOptions, QuickActionResult };

/** 转换预设 = 目标格式 */
export type ConvertPreset = 'png' | 'webp' | 'avif' | 'jpeg';

/** 预设参数表:format + 默认 quality(若适用) */
export interface ConvertPresetConfig {
  format: ConvertPreset;
  /** 质量 0-100,仅对有损格式生效;PNG 忽略 */
  quality?: number;
  /** 简介(供 UI 展示) */
  label: string;
}

export const CONVERT_PRESETS: Record<ConvertPreset, ConvertPresetConfig> = {
  /** PNG 无损,适合透明图 */
  png: { format: 'png', label: 'PNG' },
  /** WebP 高质量压缩 */
  webp: { format: 'webp', quality: 90, label: 'WebP' },
  /** AVIF 最高压缩率 */
  avif: { format: 'avif', quality: 80, label: 'AVIF' },
  /** JPEG 有损,无透明 */
  jpeg: { format: 'jpeg', quality: 90, label: 'JPEG' },
};

/** useQuickConvert 返回值 */
export interface UseQuickConvertResult {
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
  /** 当前预设(=目标格式) */
  preset: ConvertPreset;
  /** 输出格式字符串(如 'WEBP';无输出时为 null) */
  outputFormat: string | null;

  // ─── 操作 ───
  handleFiles: (files: File[]) => Promise<void>;
  setPreset: (preset: ConvertPreset) => void;
  reset: () => void;
  clearError: () => void;
  /** 手动触发执行(autoRun=false 时用) */
  run: () => Promise<void>;
}

/**
 * 图片一键格式转换 hook(纯逻辑,无 UI)。
 */
export function useQuickConvert(
  options?: UseQuickActionOptions<ConvertPreset>
): UseQuickConvertResult {
  const { initialPreset = 'webp', autoRun = true, onComplete } = options ?? {};
  const tool = useImageTool();
  const [preset, setPresetState] = useState<ConvertPreset>(initialPreset);

  const lastRunInputId = useRef<string | null>(null);
  const lastNotifiedBlob = useRef<Blob | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  /** 实际执行格式转换(根据 preset 构造 workflow) */
  const runConvert = useCallback(
    async (nextPreset: ConvertPreset): Promise<void> => {
      const config = CONVERT_PRESETS[nextPreset];
      // PNG 不传 quality(engine 忽略,但保持参数集干净)
      const params: Record<string, unknown> = { format: config.format };
      if (config.quality !== undefined) {
        params.quality = config.quality;
      }
      const wf = buildSingleStepImageWorkflow(
        'image.convert',
        params,
        'QuickConvert',
        'Quick convert image format with preset'
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

  // autoRun:inputId 变化时触发一次转换
  useEffect(() => {
    if (tool.inputId && tool.ready && autoRun && lastRunInputId.current !== tool.inputId) {
      lastRunInputId.current = tool.inputId;
      void runConvert(preset);
    }
    if (!tool.inputId) {
      lastRunInputId.current = null;
    }
  }, [tool.inputId, tool.ready, autoRun, preset, runConvert]);

  // 切换预设:更新 state,并在已有输入时立即重跑
  const setPreset = useCallback(
    (next: ConvertPreset) => {
      setPresetState(next);
      if (tool.inputId && !tool.busy) {
        lastRunInputId.current = tool.inputId;
        void runConvert(next);
      }
    },
    [tool.inputId, tool.busy, runConvert]
  );

  const handleFiles = useCallback(
    async (files: File[]): Promise<void> => {
      await tool.handleFiles(files);
    },
    [tool]
  );

  const outputFormat = tool.outputInfo ? tool.outputInfo.format : null;

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
    outputFormat,
    handleFiles,
    setPreset,
    reset: tool.reset,
    clearError: tool.clearError,
    run: () => runConvert(preset),
  };
}
