/**
 * useImageConvert — 图片一键格式转换的纯逻辑 hook(Layer 0),无 UI。
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { wasmEncodersEnabled } from '@lokvis/plugin-image';
import { useImageTool } from '../internal/useImageTool';
import { useInputBlobImport } from '../internal/useInputBlobImport';
import { buildSingleStepImageWorkflow } from '../internal/workflow-builder';
import type { ImageInfo } from '../internal/download';
import { detectEncodeSupport } from '../internal/format-support';
import {
  type UseEmbedActionOptions,
  type EmbedActionResult,
} from './useImageCompress';

// 重新导出共享类型
export type { UseEmbedActionOptions, EmbedActionResult };

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

export const IMAGE_CONVERT_PRESETS: Record<ConvertPreset, ConvertPresetConfig> = {
  /** PNG 无损,适合透明图 */
  png: { format: 'png', label: 'PNG' },
  /** WebP 高质量压缩 */
  webp: { format: 'webp', quality: 90, label: 'WebP' },
  /** AVIF 最高压缩率 */
  avif: { format: 'avif', quality: 80, label: 'AVIF' },
  /** JPEG 有损,无透明 */
  jpeg: { format: 'jpeg', quality: 90, label: 'JPEG' },
};

/** useImageConvert 返回值 */
export interface UseImageConvertResult {
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
  /**
   * 浏览器对各预设格式的**有效编码支持**(原生 canvas 探测,AVIF 额外并入 wasm 兜底)。
   * null = 检测中。UI 应禁用不支持的预设——否则浏览器会静默回退 PNG
   * (如选 AVIF 却得到 PNG)。AVIF 在原生不支持但 wasm 兜底启用时仍记为支持
   * (encodeSmart 会走 WASM 编码器)。检测完成前视为可用(乐观),检测很快(1×1 编码)。
   */
  formatSupport: Record<ConvertPreset, boolean> | null;
  /**
   * 各预设是否**仅能经由慢速 WASM 编码器**完成(原生不支持但 wasm 兜底启用)。
   * null = 检测中。UI 据此在选中该预设时展示慢速提示(如 AVIF 软件编码耗时数秒)。
   * 与 formatSupport 互补:formatSupport 管"能否选",slowEncode 管"选了是否慢"。
   */
  slowEncode: Record<ConvertPreset, boolean> | null;

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
export function useImageConvert(
  options?: UseEmbedActionOptions<ConvertPreset>
): UseImageConvertResult {
  const { initialPreset = 'webp', autoRun = true, onComplete, inputBlob, plugins } = options ?? {};
  const tool = useImageTool(plugins);
  // inputBlob 注入:走与手动上传相同的路径(见 useInputBlobImport)
  useInputBlobImport(tool, inputBlob);
  const [preset, setPresetState] = useState<ConvertPreset>(initialPreset);

  // 浏览器原生编码支持(AVIF 等可能缺失,canvas 会静默回退 PNG)。
  // 挂载后探测一次,再并入 wasm 兜底得到"有效支持"供 UI 门控。
  const [nativeSupport, setNativeSupport] = useState<Record<ConvertPreset, boolean> | null>(null);
  useEffect(() => {
    let cancelled = false;
    const presets = Object.keys(IMAGE_CONVERT_PRESETS) as ConvertPreset[];
    void detectEncodeSupport(presets).then((support) => {
      if (!cancelled) {
        setNativeSupport(support as Record<ConvertPreset, boolean>);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // wasm 兜底开关(纯配置查询)。启用时 AVIF 在原生缺失下仍可编码(encodeSmart 走 WASM)。
  const wasmAvif = wasmEncodersEnabled();

  // 有效支持:原生探测结果,AVIF 额外并入 wasm 兜底。null 透传(检测中,UI 乐观放行)。
  const formatSupport = useMemo<Record<ConvertPreset, boolean> | null>(() => {
    if (!nativeSupport) return null;
    return { ...nativeSupport, avif: nativeSupport.avif || wasmAvif };
  }, [nativeSupport, wasmAvif]);

  // 慢速编码:仅当该格式原生不支持、但 wasm 兜底启用时为 true(供 UI 慢速提示)。
  const slowEncode = useMemo<Record<ConvertPreset, boolean> | null>(() => {
    if (!nativeSupport) return null;
    return {
      png: false,
      jpeg: false,
      webp: false,
      avif: !nativeSupport.avif && wasmAvif,
    };
  }, [nativeSupport, wasmAvif]);

  const lastRunInputId = useRef<string | null>(null);
  const lastNotifiedBlob = useRef<Blob | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  /** 实际执行格式转换(根据 preset 构造 workflow) */
  const runConvert = useCallback(
    async (nextPreset: ConvertPreset): Promise<void> => {
      const config = IMAGE_CONVERT_PRESETS[nextPreset];
      // PNG 不传 quality(engine 忽略,但保持参数集干净)
      const params: Record<string, unknown> = { format: config.format };
      if (config.quality !== undefined) {
        params.quality = config.quality;
      }
      const wf = buildSingleStepImageWorkflow(
        'image.convert',
        params,
        'ImageConvert',
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
      // 检测完成且浏览器不支持该格式时拒绝切换——否则 canvas 会静默回退 PNG
      // (如选 AVIF 却得到 PNG)。检测中(formatSupport=null)保持乐观允许。
      if (formatSupport && !formatSupport[next]) {
        return;
      }
      setPresetState(next);
      if (tool.inputId && !tool.busy) {
        lastRunInputId.current = tool.inputId;
        void runConvert(next);
      }
    },
    [formatSupport, tool.inputId, tool.busy, runConvert]
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
    formatSupport,
    slowEncode,
    handleFiles,
    setPreset,
    reset: tool.reset,
    clearError: tool.clearError,
    run: () => runConvert(preset),
  };
}
