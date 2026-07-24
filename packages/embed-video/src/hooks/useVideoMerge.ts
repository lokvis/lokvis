/**
 * useVideoMerge — 视频拼接 hook(Layer 0,多文件输入 N→1)。
 */
import { useCallback, useEffect, useRef } from 'react';
import type { PluginLoadEntry } from '@lokvis/sdk';
import { useVideoTool } from '../internal/useVideoTool';
import { buildSingleStepVideoWorkflow } from '../internal/workflow-builder';
import type { VideoFileInfo } from '../internal/download';
import type { VideoActionResult } from './useVideoCompress';

export interface UseVideoMergeOptions {
  autoRun?: boolean;
  onComplete?: (result: VideoActionResult) => void;
  plugins?: PluginLoadEntry[];
}

export interface UseVideoMergeResult {
  ready: boolean;
  initError: string | null;
  inputUrls: string[];
  inputInfos: VideoFileInfo[];
  outputUrls: string[];
  outputInfos: VideoFileInfo[];
  outputBlobs: Blob[];
  busy: boolean;
  error: string | null;
  fileCount: number;
  handleFiles: (files: File[]) => Promise<void>;
  reset: () => void;
  clearError: () => void;
  run: () => Promise<void>;
}

export function useVideoMerge(options?: UseVideoMergeOptions): UseVideoMergeResult {
  const { autoRun = true, onComplete, plugins } = options ?? {};
  const tool = useVideoTool({ multiple: true, plugins });

  const lastRunInputKey = useRef<string | null>(null);
  const lastNotifiedKey = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const inputKey = tool.inputIds.join(',');

  const runMerge = useCallback(async (): Promise<void> => {
    const wf = buildSingleStepVideoWorkflow(
      'video.merge', {}, 'VideoMerge', 'Merge multiple videos into one', true
    );
    await tool.runWorkflow(wf);
  }, [tool]);

  useEffect(() => {
    const outputKey = tool.outputBlobs.map((b) => b.size).join(',');
    if (tool.outputBlobs.length > 0 && outputKey !== lastNotifiedKey.current && tool.inputInfos.length > 0) {
      lastNotifiedKey.current = outputKey;
      onCompleteRef.current?.({
        outputBlobs: tool.outputBlobs, outputUrls: tool.outputUrls,
        inputSize: tool.inputInfos.reduce((s, i) => s + i.size, 0),
        outputSize: tool.outputBlobs.reduce((s, b) => s + b.size, 0), preset: 'merge',
      });
    }
  }, [tool.outputBlobs, tool.outputUrls, tool.inputInfos]);

  useEffect(() => {
    if (inputKey && tool.inputIds.length >= 2 && tool.ready && autoRun && lastRunInputKey.current !== inputKey) {
      lastRunInputKey.current = inputKey;
      void runMerge();
    }
    if (!inputKey) lastRunInputKey.current = null;
  }, [inputKey, tool.inputIds.length, tool.ready, autoRun, runMerge]);

  const handleFiles = useCallback(async (files: File[]) => { await tool.handleFiles(files); }, [tool]);

  return {
    ready: tool.ready, initError: tool.initError,
    inputUrls: tool.inputUrls, inputInfos: tool.inputInfos,
    outputUrls: tool.outputUrls, outputInfos: tool.outputInfos, outputBlobs: tool.outputBlobs,
    busy: tool.busy, error: tool.error, fileCount: tool.inputIds.length,
    handleFiles, reset: tool.reset, clearError: tool.clearError, run: runMerge,
  };
}
