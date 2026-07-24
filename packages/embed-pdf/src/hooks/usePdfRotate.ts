/**
 * usePdfRotate — PDF 旋转的纯逻辑 hook(Layer 0),无 UI。
 *
 * 三方接入示例:
 * ```tsx
 * const { outputBlobs, busy, handleFiles, preset, setPreset } = usePdfRotate();
 * ```
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PluginLoadEntry } from '@lokvis/sdk';
import { usePdfTool } from '../internal/usePdfTool';
import { buildSingleStepPdfWorkflow } from '../internal/workflow-builder';
import type { PdfFileInfo } from '../internal/download';
import type { PdfActionResult } from './usePdfCompress';

/** 旋转预设 */
export type PdfRotatePreset = '90' | '180' | '270';

/** 预设参数表 */
export const PDF_ROTATE_PRESETS: Record<PdfRotatePreset, { angle: 90 | 180 | 270 }> = {
  '90': { angle: 90 },
  '180': { angle: 180 },
  '270': { angle: 270 },
};

/** usePdfRotate 选项 */
export interface UsePdfRotateOptions {
  initialPreset?: PdfRotatePreset;
  autoRun?: boolean;
  onComplete?: (result: PdfActionResult) => void;
  plugins?: PluginLoadEntry[];
}

/** usePdfRotate 返回值 */
export interface UsePdfRotateResult {
  ready: boolean;
  initError: string | null;
  inputUrls: string[];
  inputInfos: PdfFileInfo[];
  outputUrls: string[];
  outputInfos: PdfFileInfo[];
  outputBlobs: Blob[];
  busy: boolean;
  error: string | null;
  preset: PdfRotatePreset;
  handleFiles: (files: File[]) => Promise<void>;
  setPreset: (preset: PdfRotatePreset) => void;
  reset: () => void;
  clearError: () => void;
  run: () => Promise<void>;
}

export function usePdfRotate(options?: UsePdfRotateOptions): UsePdfRotateResult {
  const { initialPreset = '90', autoRun = true, onComplete, plugins } = options ?? {};
  const tool = usePdfTool({ plugins });
  const [preset, setPresetState] = useState<PdfRotatePreset>(initialPreset);

  const lastRunInputKey = useRef<string | null>(null);
  const lastNotifiedKey = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const inputKey = tool.inputIds.join(',');

  const runRotate = useCallback(
    async (nextPreset: PdfRotatePreset): Promise<void> => {
      const config = PDF_ROTATE_PRESETS[nextPreset];
      const wf = buildSingleStepPdfWorkflow(
        'pdf.rotate',
        { angle: config.angle },
        'PdfRotate',
        'Rotate PDF pages'
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
      void runRotate(preset);
    }
    if (!inputKey) {
      lastRunInputKey.current = null;
    }
  }, [inputKey, tool.ready, autoRun, preset, runRotate]);

  const setPreset = useCallback(
    (next: PdfRotatePreset) => {
      setPresetState(next);
      if (inputKey && !tool.busy) {
        lastRunInputKey.current = inputKey;
        void runRotate(next);
      }
    },
    [inputKey, tool.busy, runRotate]
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
    handleFiles,
    setPreset,
    reset: tool.reset,
    clearError: tool.clearError,
    run: () => runRotate(preset),
  };
}
