/**
 * usePdfMerge — PDF 合并的纯逻辑 hook(Layer 0),无 UI。
 *
 * 多文件输入(N→1):用户选择多个 PDF,按顺序合并为一个。
 *
 * 三方接入示例:
 * ```tsx
 * const { inputUrls, outputBlobs, busy, handleFiles } = usePdfMerge();
 * ```
 */
import { useCallback, useEffect, useRef } from 'react';
import type { PluginLoadEntry } from '@lokvis/sdk';
import { usePdfTool } from '../internal/usePdfTool';
import { buildSingleStepPdfWorkflow } from '../internal/workflow-builder';
import type { PdfFileInfo } from '../internal/download';
import type { PdfActionResult } from './usePdfCompress';

/** usePdfMerge 选项 */
export interface UsePdfMergeOptions {
  /** 是否自动执行(默认 true) */
  autoRun?: boolean;
  /** 完成回调 */
  onComplete?: (result: PdfActionResult) => void;
  /** 预加载插件列表 */
  plugins?: PluginLoadEntry[];
}

/** usePdfMerge 返回值 */
export interface UsePdfMergeResult {
  ready: boolean;
  initError: string | null;
  inputUrls: string[];
  inputInfos: PdfFileInfo[];
  outputUrls: string[];
  outputInfos: PdfFileInfo[];
  outputBlobs: Blob[];
  busy: boolean;
  error: string | null;
  /** 已选文件数 */
  fileCount: number;
  handleFiles: (files: File[]) => Promise<void>;
  reset: () => void;
  clearError: () => void;
  run: () => Promise<void>;
}

export function usePdfMerge(options?: UsePdfMergeOptions): UsePdfMergeResult {
  const { autoRun = true, onComplete, plugins } = options ?? {};
  const tool = usePdfTool({ multiple: true, plugins });

  const lastRunInputKey = useRef<string | null>(null);
  const lastNotifiedKey = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const inputKey = tool.inputIds.join(',');

  const runMerge = useCallback(async (): Promise<void> => {
    const wf = buildSingleStepPdfWorkflow(
      'pdf.merge',
      {},
      'PdfMerge',
      'Merge multiple PDFs into one',
      true
    );
    await tool.runWorkflow(wf);
  }, [tool]);

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
        preset: 'merge',
      });
    }
  }, [tool.outputBlobs, tool.outputUrls, tool.inputInfos]);

  // autoRun:需要至少 2 个文件才触发
  useEffect(() => {
    if (inputKey && tool.inputIds.length >= 2 && tool.ready && autoRun && lastRunInputKey.current !== inputKey) {
      lastRunInputKey.current = inputKey;
      void runMerge();
    }
    if (!inputKey) {
      lastRunInputKey.current = null;
    }
  }, [inputKey, tool.inputIds.length, tool.ready, autoRun, runMerge]);

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
    fileCount: tool.inputIds.length,
    handleFiles,
    reset: tool.reset,
    clearError: tool.clearError,
    run: runMerge,
  };
}
