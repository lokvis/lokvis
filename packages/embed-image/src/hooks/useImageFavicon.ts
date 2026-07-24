/**
 * useImageFavicon — 图片一键生成多尺寸 ICO favicon 的纯逻辑 hook(Layer 0),无 UI。
 *
 * 与 useImageConvert 的结构差异:
 *   - 预设参数是 `{ sizes: number[] }`(而非 format + quality)
 *   - ICO 无法被浏览器 Image().decode() 解码,getImageInfo 会返回 null,
 *     故 output 元信息由本 hook **合成**(width/height = 最大尺寸,format='ICO')
 *   - 因此 output 状态由本 hook **自管理**(runWorkflowRaw + 本地 state),
 *     不走 useImageTool.runWorkflow(后者会调 getImageInfo 得到 null)
 *
 * 3 个预设:
 *   - standard: [16,32,48]     经典浏览器标签页
 *   - modern:   [32,48,256]    高分屏 & PWA
 *   - full:     [16,32,48,256] 最大兼容性
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useImageTool } from '../internal/useImageTool';
import { buildSingleStepImageWorkflow } from '../internal/workflow-builder';
import type { ImageInfo } from '../internal/download';
import {
  type UseEmbedActionOptions,
  type EmbedActionResult,
} from './useImageCompress';

// 重新导出共享类型
export type { UseEmbedActionOptions, EmbedActionResult };

/** Favicon 预设 = 一组 ICO 内嵌尺寸 */
export type FaviconPreset = 'standard' | 'modern' | 'full';

/** 预设配置:sizes + UI 标签 + 描述 */
export interface FaviconPresetConfig {
  /** ICO 包含的尺寸(正方形边长 px) */
  sizes: number[];
  /** UI 展示标签 */
  label: string;
  /** 简短描述 */
  description: string;
}

export const IMAGE_FAVICON_PRESETS: Record<FaviconPreset, FaviconPresetConfig> = {
  standard: { sizes: [16, 32, 48], label: 'Standard', description: '16/32/48px' },
  modern: { sizes: [32, 48, 256], label: 'Modern', description: '32/48/256px' },
  full: { sizes: [16, 32, 48, 256], label: 'Full', description: '16/32/48/256px' },
};

/** useImageFavicon 返回值 */
export interface UseImageFaviconResult {
  // ─── 状态 ───
  ready: boolean;
  initError: string | null;
  inputUrl: string | null;
  inputInfo: ImageInfo | null;
  outputUrl: string | null;
  /** 合成值(ICO 不可解码):width/height = 最大尺寸,format='ICO' */
  outputInfo: ImageInfo | null;
  outputBlob: Blob | null;
  busy: boolean;
  error: string | null;
  /** 当前预设 */
  preset: FaviconPreset;

  // ─── 操作 ───
  handleFiles: (files: File[]) => Promise<void>;
  setPreset: (preset: FaviconPreset) => void;
  reset: () => void;
  clearError: () => void;
  /** 手动触发执行(autoRun=false 时用) */
  run: () => Promise<void>;
}

/**
 * 图片一键生成 ICO favicon hook(纯逻辑,无 UI)。
 */
export function useImageFavicon(
  options?: UseEmbedActionOptions<FaviconPreset>
): UseImageFaviconResult {
  const { initialPreset = 'full', autoRun = true, onComplete, plugins } = options ?? {};
  const tool = useImageTool(plugins);
  const [preset, setPresetState] = useState<FaviconPreset>(initialPreset);

  // ICO 无法解码 → 自管理 output 状态
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  const lastRunInputId = useRef<string | null>(null);
  const lastNotifiedBlob = useRef<Blob | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // 合成 outputInfo:ICO 取最大尺寸作为标称宽高,format 固定 'ICO'
  const outputInfo: ImageInfo | null = useMemo(() => {
    if (!outputBlob) return null;
    const maxSize = Math.max(...IMAGE_FAVICON_PRESETS[preset].sizes);
    return { width: maxSize, height: maxSize, size: outputBlob.size, format: 'ICO' };
  }, [outputBlob, preset]);

  /** 实际执行 favicon 生成(根据 preset 构造 workflow) */
  const runFavicon = useCallback(
    async (nextPreset: FaviconPreset): Promise<void> => {
      const config = IMAGE_FAVICON_PRESETS[nextPreset];
      const wf = buildSingleStepImageWorkflow(
        'image.favicon',
        { sizes: config.sizes },
        'ImageFavicon',
        'Generate multi-size ICO favicon'
      );
      const result = await tool.runWorkflowRaw(wf);
      if (!result || result.status !== 'completed' || !result.outputs[0]) return;
      const blob = await tool.runtime!.exportAsset(result.outputs[0]);
      setOutputBlob(blob);
    },
    [tool]
  );

  // outputUrl 生命周期(同 useImageTool 模式)
  useEffect(() => {
    if (!outputBlob) {
      setOutputUrl(null);
      return;
    }
    const url = URL.createObjectURL(outputBlob);
    setOutputUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [outputBlob]);

  // output 完成后触发 onComplete
  useEffect(() => {
    if (
      outputBlob &&
      outputBlob !== lastNotifiedBlob.current &&
      tool.inputInfo &&
      outputInfo &&
      outputUrl
    ) {
      lastNotifiedBlob.current = outputBlob;
      onCompleteRef.current?.({
        outputBlob,
        outputUrl,
        inputSize: tool.inputInfo.size,
        outputSize: outputInfo.size,
        preset,
      });
    }
  }, [outputBlob, outputUrl, tool.inputInfo, outputInfo, preset]);

  // autoRun:inputId 变化时触发一次生成
  useEffect(() => {
    if (tool.inputId && tool.ready && autoRun && lastRunInputId.current !== tool.inputId) {
      lastRunInputId.current = tool.inputId;
      void runFavicon(preset);
    }
    if (!tool.inputId) {
      lastRunInputId.current = null;
    }
  }, [tool.inputId, tool.ready, autoRun, preset, runFavicon]);

  // 切换预设:更新 state,并在已有输入时立即重跑
  const setPreset = useCallback(
    (next: FaviconPreset) => {
      setPresetState(next);
      if (tool.inputId && !tool.busy) {
        lastRunInputId.current = tool.inputId;
        void runFavicon(next);
      }
    },
    [tool.inputId, tool.busy, runFavicon]
  );

  const handleFiles = useCallback(
    async (files: File[]): Promise<void> => {
      // 新输入 → 清空旧 output(ICO 自管理,不经 useImageTool.reset)
      setOutputBlob(null);
      await tool.handleFiles(files);
    },
    [tool]
  );

  const reset = useCallback(() => {
    setOutputBlob(null);
    tool.reset();
  }, [tool]);

  return {
    ready: tool.ready,
    initError: tool.initError,
    inputUrl: tool.inputUrl,
    inputInfo: tool.inputInfo,
    outputUrl,
    outputInfo,
    outputBlob,
    busy: tool.busy,
    error: tool.error,
    preset,
    handleFiles,
    setPreset,
    reset,
    clearError: tool.clearError,
    run: () => runFavicon(preset),
  };
}
