/**
 * usePdfCompress — PDF 一键压缩的纯逻辑 hook(Layer 0),无 UI。
 *
 * 行为:
 *   1. 复用 usePdfTool(runtime + input/output 生命周期)
 *   2. 接收 initialPreset / autoRun / onComplete 选项
 *   3. autoRun=true 时,上传后自动压缩
 *   4. 切换 preset 时,若有输入则自动重跑
 *
 * 三方接入示例:
 * ```tsx
 * const { inputUrls, outputBlobs, ratio, busy, handleFiles, preset, setPreset } = usePdfCompress();
 * ```
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PluginLoadEntry } from '@lokvis/sdk';
import { usePdfTool } from '../internal/usePdfTool';
import { buildSingleStepPdfWorkflow } from '../internal/workflow-builder';
import type { PdfFileInfo } from '../internal/download';

/** 压缩预设。每个预设对应一个压缩级别(0-9) */
export type PdfCompressPreset = 'balanced' | 'high' | 'maximum';

/** 预设参数表 */
export const PDF_COMPRESS_PRESETS: Record<PdfCompressPreset, { level: number }> = {
  /** 均衡:level 6(默认) */
  balanced: { level: 6 },
  /** 高压缩:level 8 */
  high: { level: 8 },
  /** 极限压缩:level 9 */
  maximum: { level: 9 },
};

/** Embed PDF hook 通用 props(所有 usePdf<Tool> 共享) */
export interface UsePdfActionOptions<Preset extends string = string> {
  /** 初始预设 */
  initialPreset?: Preset;
  /** 是否自动执行(默认 true) */
  autoRun?: boolean;
  /** 完成回调 */
  onComplete?: (result: PdfActionResult) => void;
  /** 预加载插件列表 */
  plugins?: PluginLoadEntry[];
}

/** onComplete 回调的结果对象 */
export interface PdfActionResult {
  outputBlobs: Blob[];
  outputUrls: string[];
  inputSize: number;
  outputSize: number;
  preset: string;
}

/** usePdfCompress 返回值 */
export interface UsePdfCompressResult {
  ready: boolean;
  initError: string | null;
  inputUrls: string[];
  inputInfos: PdfFileInfo[];
  outputUrls: string[];
  outputInfos: PdfFileInfo[];
  outputBlobs: Blob[];
  busy: boolean;
  error: string | null;
  preset: PdfCompressPreset;
  /** 压缩率(正值=节省百分比;null=无输出) */
  ratio: number | null;
  handleFiles: (files: File[]) => Promise<void>;
  setPreset: (preset: PdfCompressPreset) => void;
  reset: () => void;
  clearError: () => void;
  run: () => Promise<void>;
}

export function usePdfCompress(
  options?: UsePdfActionOptions<PdfCompressPreset>
): UsePdfCompressResult {
  const { initialPreset = 'balanced', autoRun = true, onComplete, plugins } = options ?? {};
  const tool = usePdfTool({ plugins });
  const [preset, setPresetState] = useState<PdfCompressPreset>(initialPreset);

  const lastRunInputKey = useRef<string | null>(null);
  const lastNotifiedKey = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const inputKey = tool.inputIds.join(',');

  const runCompress = useCallback(
    async (nextPreset: PdfCompressPreset): Promise<void> => {
      const config = PDF_COMPRESS_PRESETS[nextPreset];
      const wf = buildSingleStepPdfWorkflow(
        'pdf.compress',
        { level: config.level },
        'PdfCompress',
        'Compress PDF with preset'
      );
      await tool.runWorkflow(wf);
    },
    [tool]
  );

  // onComplete
  useEffect(() => {
    const outputKey = tool.outputBlobs.map((b) => b.size).join(',');
    if (
      tool.outputBlobs.length > 0 &&
      outputKey !== lastNotifiedKey.current &&
      tool.inputInfos.length > 0
    ) {
      lastNotifiedKey.current = outputKey;
      const inputSize = tool.inputInfos.reduce((s, i) => s + i.size, 0);
      const outputSize = tool.outputBlobs.reduce((s, b) => s + b.size, 0);
      onCompleteRef.current?.({
        outputBlobs: tool.outputBlobs,
        outputUrls: tool.outputUrls,
        inputSize,
        outputSize,
        preset,
      });
    }
  }, [tool.outputBlobs, tool.outputUrls, tool.inputInfos, preset]);

  // autoRun
  useEffect(() => {
    if (inputKey && tool.ready && autoRun && lastRunInputKey.current !== inputKey) {
      lastRunInputKey.current = inputKey;
      void runCompress(preset);
    }
    if (!inputKey) {
      lastRunInputKey.current = null;
    }
  }, [inputKey, tool.ready, autoRun, preset, runCompress]);

  const setPreset = useCallback(
    (next: PdfCompressPreset) => {
      setPresetState(next);
      if (inputKey && !tool.busy) {
        lastRunInputKey.current = inputKey;
        void runCompress(next);
      }
    },
    [inputKey, tool.busy, runCompress]
  );

  const handleFiles = useCallback(
    async (files: File[]): Promise<void> => {
      await tool.handleFiles(files);
    },
    [tool]
  );

  const inputSize = tool.inputInfos.reduce((s, i) => s + i.size, 0);
  const outputSize = tool.outputBlobs.reduce((s, b) => s + b.size, 0);
  const ratio = inputSize > 0 && tool.outputBlobs.length > 0
    ? (1 - outputSize / inputSize) * 100
    : null;

  return {
    ready: tool.ready,
    initError: tool.initError,
    inputUrls: tool.inputUrls,
    inputInfos: tool.inputInfos,
    outputUrls: tool.outputUrls,
    outputInfos: tool.outputInfos,
    outputBlobs: tool.outputBlobs,
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
