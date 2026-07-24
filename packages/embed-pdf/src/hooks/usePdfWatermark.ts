/**
 * usePdfWatermark — PDF 加水印的纯逻辑 hook(Layer 0),无 UI。
 *
 * 三方接入示例:
 * ```tsx
 * const { outputBlobs, busy, handleFiles, text, setText } = usePdfWatermark();
 * ```
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PluginLoadEntry } from '@lokvis/sdk';
import { usePdfTool } from '../internal/usePdfTool';
import { buildSingleStepPdfWorkflow } from '../internal/workflow-builder';
import type { PdfFileInfo } from '../internal/download';
import type { PdfActionResult } from './usePdfCompress';

/** 水印预设 */
export type PdfWatermarkPreset = 'confidential' | 'draft' | 'custom';

/** 预设参数表 */
export const PDF_WATERMARK_PRESETS: Record<PdfWatermarkPreset, { text: string; opacity: number; fontSize: number }> = {
  confidential: { text: 'CONFIDENTIAL', opacity: 0.3, fontSize: 48 },
  draft: { text: 'DRAFT', opacity: 0.4, fontSize: 56 },
  custom: { text: '', opacity: 0.3, fontSize: 48 },
};

/** 默认水印文本 */
export const DEFAULT_WATERMARK_TEXT = 'CONFIDENTIAL';

/** usePdfWatermark 选项 */
export interface UsePdfWatermarkOptions {
  initialPreset?: PdfWatermarkPreset;
  autoRun?: boolean;
  onComplete?: (result: PdfActionResult) => void;
  plugins?: PluginLoadEntry[];
}

/** usePdfWatermark 返回值 */
export interface UsePdfWatermarkResult {
  ready: boolean;
  initError: string | null;
  inputUrls: string[];
  inputInfos: PdfFileInfo[];
  outputUrls: string[];
  outputInfos: PdfFileInfo[];
  outputBlobs: Blob[];
  busy: boolean;
  error: string | null;
  preset: PdfWatermarkPreset;
  /** 当前水印文本 */
  text: string;
  /** 设置水印文本(自动切换到 custom 预设并重跑) */
  setText: (text: string) => void;
  handleFiles: (files: File[]) => Promise<void>;
  setPreset: (preset: PdfWatermarkPreset) => void;
  reset: () => void;
  clearError: () => void;
  run: () => Promise<void>;
}

export function usePdfWatermark(options?: UsePdfWatermarkOptions): UsePdfWatermarkResult {
  const { initialPreset = 'confidential', autoRun = true, onComplete, plugins } = options ?? {};
  const tool = usePdfTool({ plugins });
  const [preset, setPresetState] = useState<PdfWatermarkPreset>(initialPreset);
  const [text, setTextState] = useState(PDF_WATERMARK_PRESETS[initialPreset].text || DEFAULT_WATERMARK_TEXT);

  const lastRunInputKey = useRef<string | null>(null);
  const lastNotifiedKey = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const inputKey = tool.inputIds.join(',');

  const runWatermark = useCallback(
    async (nextPreset: PdfWatermarkPreset, nextText: string): Promise<void> => {
      const config = PDF_WATERMARK_PRESETS[nextPreset];
      const watermarkText = nextPreset === 'custom' ? nextText : config.text;
      if (!watermarkText) return;
      const wf = buildSingleStepPdfWorkflow(
        'pdf.watermark',
        { text: watermarkText, opacity: config.opacity, fontSize: config.fontSize },
        'PdfWatermark',
        'Add watermark to PDF'
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
      void runWatermark(preset, text);
    }
    if (!inputKey) {
      lastRunInputKey.current = null;
    }
  }, [inputKey, tool.ready, autoRun, preset, text, runWatermark]);

  const setPreset = useCallback(
    (next: PdfWatermarkPreset) => {
      setPresetState(next);
      const nextText = next === 'custom' ? text : PDF_WATERMARK_PRESETS[next].text;
      setTextState(nextText);
      if (inputKey && !tool.busy && nextText) {
        lastRunInputKey.current = inputKey;
        void runWatermark(next, nextText);
      }
    },
    [inputKey, tool.busy, text, runWatermark]
  );

  const setText = useCallback(
    (nextText: string) => {
      setTextState(nextText);
      setPresetState('custom');
      if (inputKey && !tool.busy && nextText) {
        lastRunInputKey.current = inputKey;
        void runWatermark('custom', nextText);
      }
    },
    [inputKey, tool.busy, runWatermark]
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
    inputUrls: tool.inputUrls,
    inputInfos: tool.inputInfos,
    outputUrls: tool.outputUrls,
    outputInfos: tool.outputInfos,
    outputBlobs: tool.outputBlobs,
    busy: tool.busy,
    error: tool.error,
    preset,
    text,
    setText,
    handleFiles,
    setPreset,
    reset: tool.reset,
    clearError: tool.clearError,
    run: () => runWatermark(preset, text),
  };
}
