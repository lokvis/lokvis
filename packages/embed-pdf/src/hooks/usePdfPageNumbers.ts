/**
 * usePdfPageNumbers — PDF 添加页码的纯逻辑 hook(Layer 0),无 UI。
 *
 * 三方接入示例:
 * ```tsx
 * const { outputBlobs, busy, handleFiles, position, setPosition } = usePdfPageNumbers();
 * ```
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PluginLoadEntry } from '@lokvis/sdk';
import { usePdfTool } from '../internal/usePdfTool';
import { buildSingleStepPdfWorkflow } from '../internal/workflow-builder';
import type { PdfFileInfo } from '../internal/download';
import type { PdfActionResult } from './usePdfCompress';

/** 页码位置 */
export type PdfPageNumberPosition =
  | 'bottom-center'
  | 'bottom-right'
  | 'top-center'
  | 'top-right';

/** 全部页码位置 */
export const PDF_PAGE_NUMBER_POSITIONS: readonly PdfPageNumberPosition[] = [
  'bottom-center',
  'bottom-right',
  'top-center',
  'top-right',
];

/** 默认页码格式模板({n}=当前页码,{total}=总页数) */
export const DEFAULT_PAGE_NUMBER_FORMAT = 'Page {n} of {total}';

/** usePdfPageNumbers 选项 */
export interface UsePdfPageNumbersOptions {
  initialPosition?: PdfPageNumberPosition;
  initialFormat?: string;
  initialStartFrom?: number;
  fontSize?: number;
  color?: string;
  autoRun?: boolean;
  onComplete?: (result: PdfActionResult) => void;
  plugins?: PluginLoadEntry[];
}

/** usePdfPageNumbers 返回值 */
export interface UsePdfPageNumbersResult {
  ready: boolean;
  initError: string | null;
  inputUrls: string[];
  inputInfos: PdfFileInfo[];
  outputUrls: string[];
  outputInfos: PdfFileInfo[];
  outputBlobs: Blob[];
  busy: boolean;
  error: string | null;
  /** 当前页码位置 */
  position: PdfPageNumberPosition;
  /** 设置页码位置(有输入时自动重跑) */
  setPosition: (position: PdfPageNumberPosition) => void;
  /** 当前格式模板 */
  format: string;
  /** 设置格式模板(有输入时自动重跑;空串不触发) */
  setFormat: (format: string) => void;
  /** 起始页码 */
  startFrom: number;
  /** 设置起始页码(有输入时自动重跑;<1 或非整数不触发) */
  setStartFrom: (startFrom: number) => void;
  handleFiles: (files: File[]) => Promise<void>;
  reset: () => void;
  clearError: () => void;
  run: () => Promise<void>;
}

export function usePdfPageNumbers(
  options?: UsePdfPageNumbersOptions
): UsePdfPageNumbersResult {
  const {
    initialPosition = 'bottom-center',
    initialFormat = DEFAULT_PAGE_NUMBER_FORMAT,
    initialStartFrom = 1,
    fontSize = 10,
    color = '#666666',
    autoRun = true,
    onComplete,
    plugins,
  } = options ?? {};
  const tool = usePdfTool({ plugins });
  const [position, setPositionState] = useState<PdfPageNumberPosition>(initialPosition);
  const [format, setFormatState] = useState(initialFormat);
  const [startFrom, setStartFromState] = useState(initialStartFrom);

  const lastRunInputKey = useRef<string | null>(null);
  const lastNotifiedKey = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const inputKey = tool.inputIds.join(',');

  const runPageNumbers = useCallback(
    async (
      nextPosition: PdfPageNumberPosition,
      nextFormat: string,
      nextStartFrom: number
    ): Promise<void> => {
      if (!nextFormat) return;
      if (!Number.isInteger(nextStartFrom) || nextStartFrom < 1) return;
      const wf = buildSingleStepPdfWorkflow(
        'pdf.add-page-numbers',
        {
          position: nextPosition,
          format: nextFormat,
          startFrom: nextStartFrom,
          fontSize,
          color,
        },
        'PdfAddPageNumbers',
        'Add page numbers to PDF'
      );
      await tool.runWorkflow(wf);
    },
    [tool, fontSize, color]
  );

  // onComplete
  useEffect(() => {
    // Object URL 每次 run 都不同,可靠区分重跑(blob 大小可能相同)
    const outputKey = tool.outputUrls.join(',');
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
        preset: position,
      });
    }
  }, [tool.outputBlobs, tool.outputUrls, tool.inputInfos, position]);

  // autoRun
  useEffect(() => {
    if (inputKey && tool.ready && autoRun && lastRunInputKey.current !== inputKey) {
      lastRunInputKey.current = inputKey;
      void runPageNumbers(position, format, startFrom);
    }
    if (!inputKey) {
      lastRunInputKey.current = null;
    }
  }, [inputKey, tool.ready, autoRun, position, format, startFrom, runPageNumbers]);

  const setPosition = useCallback(
    (next: PdfPageNumberPosition) => {
      setPositionState(next);
      if (inputKey && !tool.busy && format) {
        lastRunInputKey.current = inputKey;
        void runPageNumbers(next, format, startFrom);
      }
    },
    [inputKey, tool.busy, format, startFrom, runPageNumbers]
  );

  const setFormat = useCallback(
    (nextFormat: string) => {
      setFormatState(nextFormat);
      if (inputKey && !tool.busy && nextFormat) {
        lastRunInputKey.current = inputKey;
        void runPageNumbers(position, nextFormat, startFrom);
      }
    },
    [inputKey, tool.busy, position, startFrom, runPageNumbers]
  );

  const setStartFrom = useCallback(
    (nextStartFrom: number) => {
      setStartFromState(nextStartFrom);
      if (
        inputKey &&
        !tool.busy &&
        format &&
        Number.isInteger(nextStartFrom) &&
        nextStartFrom >= 1
      ) {
        lastRunInputKey.current = inputKey;
        void runPageNumbers(position, format, nextStartFrom);
      }
    },
    [inputKey, tool.busy, position, format, runPageNumbers]
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
    position,
    setPosition,
    format,
    setFormat,
    startFrom,
    setStartFrom,
    handleFiles,
    reset: tool.reset,
    clearError: tool.clearError,
    run: () => runPageNumbers(position, format, startFrom),
  };
}
