/**
 * usePdfSplit — PDF 拆分的纯逻辑 hook(Layer 0),无 UI。
 *
 * 单文件输入,多输出(1→N):按页数或范围拆分为多个 PDF。
 *
 * 三方接入示例:
 * ```tsx
 * const { outputBlobs, outputUrls, busy, handleFiles, preset, setPreset } = usePdfSplit();
 * ```
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PluginLoadEntry } from '@lokvis/sdk';
import { usePdfTool } from '../internal/usePdfTool';
import { buildSingleStepPdfWorkflow } from '../internal/workflow-builder';
import type { PdfFileInfo } from '../internal/download';
import type { PdfActionResult } from './usePdfCompress';

/** 拆分预设 */
export type PdfSplitPreset = 'every-page' | '2-pages' | '5-pages' | 'custom';

/** 预设参数表(custom 为占位,实际值来自 pagesPerFile state) */
export const PDF_SPLIT_PRESETS: Record<PdfSplitPreset, { pagesPerFile: number }> = {
  'every-page': { pagesPerFile: 1 },
  '2-pages': { pagesPerFile: 2 },
  '5-pages': { pagesPerFile: 5 },
  custom: { pagesPerFile: 0 },
};

/** usePdfSplit 选项 */
export interface UsePdfSplitOptions {
  initialPreset?: PdfSplitPreset;
  /** 初始自定义页数(传入时初始预设为 custom) */
  initialPagesPerFile?: number;
  autoRun?: boolean;
  onComplete?: (result: PdfActionResult) => void;
  plugins?: PluginLoadEntry[];
}

/** usePdfSplit 返回值 */
export interface UsePdfSplitResult {
  ready: boolean;
  initError: string | null;
  inputUrls: string[];
  inputInfos: PdfFileInfo[];
  outputUrls: string[];
  outputInfos: PdfFileInfo[];
  outputBlobs: Blob[];
  busy: boolean;
  error: string | null;
  preset: PdfSplitPreset;
  /** 输出文件数 */
  outputCount: number;
  /** 当前每份页数(custom 预设时生效) */
  pagesPerFile: number;
  /** 设置每份页数(自动切换到 custom 预设并重跑;<1 或非整数不触发 run) */
  setPagesPerFile: (n: number) => void;
  handleFiles: (files: File[]) => Promise<void>;
  setPreset: (preset: PdfSplitPreset) => void;
  reset: () => void;
  clearError: () => void;
  run: () => Promise<void>;
}

export function usePdfSplit(options?: UsePdfSplitOptions): UsePdfSplitResult {
  const {
    initialPreset,
    initialPagesPerFile,
    autoRun = true,
    onComplete,
    plugins,
  } = options ?? {};
  // initialPagesPerFile 传入时初始预设为 custom
  const resolvedInitialPreset: PdfSplitPreset =
    initialPreset ?? (initialPagesPerFile != null ? 'custom' : 'every-page');
  const tool = usePdfTool({ plugins });
  const [preset, setPresetState] = useState<PdfSplitPreset>(resolvedInitialPreset);
  const [pagesPerFile, setPagesPerFileState] = useState<number>(
    initialPagesPerFile ??
      (resolvedInitialPreset === 'custom'
        ? 1
        : PDF_SPLIT_PRESETS[resolvedInitialPreset].pagesPerFile)
  );

  const lastRunInputKey = useRef<string | null>(null);
  const lastNotifiedKey = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const inputKey = tool.inputIds.join(',');

  const runSplit = useCallback(
    async (nextPreset: PdfSplitPreset, nextPagesPerFile: number): Promise<void> => {
      const effective =
        nextPreset === 'custom'
          ? nextPagesPerFile
          : PDF_SPLIT_PRESETS[nextPreset].pagesPerFile;
      if (!Number.isInteger(effective) || effective < 1) return;
      const wf = buildSingleStepPdfWorkflow(
        'pdf.split',
        { pagesPerFile: effective },
        'PdfSplit',
        'Split PDF into multiple files'
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
      void runSplit(preset, pagesPerFile);
    }
    if (!inputKey) {
      lastRunInputKey.current = null;
    }
  }, [inputKey, tool.ready, autoRun, preset, pagesPerFile, runSplit]);

  const setPreset = useCallback(
    (next: PdfSplitPreset) => {
      setPresetState(next);
      if (next !== 'custom') {
        setPagesPerFileState(PDF_SPLIT_PRESETS[next].pagesPerFile);
      }
      if (inputKey && !tool.busy) {
        lastRunInputKey.current = inputKey;
        void runSplit(next, pagesPerFile);
      }
    },
    [inputKey, tool.busy, pagesPerFile, runSplit]
  );

  const setPagesPerFile = useCallback(
    (n: number) => {
      setPagesPerFileState(n);
      setPresetState('custom');
      if (inputKey && !tool.busy && Number.isInteger(n) && n >= 1) {
        lastRunInputKey.current = inputKey;
        void runSplit('custom', n);
      }
    },
    [inputKey, tool.busy, runSplit]
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
    outputCount: tool.outputBlobs.length,
    pagesPerFile,
    setPagesPerFile,
    handleFiles,
    setPreset,
    reset: tool.reset,
    clearError: tool.clearError,
    run: () => runSplit(preset, pagesPerFile),
  };
}
