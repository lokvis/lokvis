/**
 * useVideoTrim — 视频裁剪时间段 hook(Layer 0)。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PluginLoadEntry } from '@lokvis/sdk';
import { useVideoTool } from '../internal/useVideoTool';
import { buildSingleStepVideoWorkflow } from '../internal/workflow-builder';
import type { VideoFileInfo } from '../internal/download';
import type { VideoActionResult } from './useVideoCompress';

export interface UseVideoTrimOptions {
  autoRun?: boolean;
  onComplete?: (result: VideoActionResult) => void;
  plugins?: PluginLoadEntry[];
}

export interface UseVideoTrimResult {
  ready: boolean;
  initError: string | null;
  inputUrls: string[];
  inputInfos: VideoFileInfo[];
  outputUrls: string[];
  outputInfos: VideoFileInfo[];
  outputBlobs: Blob[];
  busy: boolean;
  error: string | null;
  /** 裁剪起点(秒) */
  startTime: number;
  /** 裁剪终点(秒) */
  endTime: number;
  setStartTime: (t: number) => void;
  setEndTime: (t: number) => void;
  handleFiles: (files: File[]) => Promise<void>;
  reset: () => void;
  clearError: () => void;
  run: () => Promise<void>;
}

export function useVideoTrim(options?: UseVideoTrimOptions): UseVideoTrimResult {
  const { autoRun = false, onComplete, plugins } = options ?? {};
  const tool = useVideoTool({ plugins });
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);

  const lastRunInputKey = useRef<string | null>(null);
  const lastNotifiedKey = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const inputKey = tool.inputIds.join(',');

  const runTrim = useCallback(async (): Promise<void> => {
    const wf = buildSingleStepVideoWorkflow(
      'video.trim', { start: startTime, end: endTime }, 'VideoTrim', 'Trim video segment'
    );
    await tool.runWorkflow(wf);
  }, [tool, startTime, endTime]);

  useEffect(() => {
    const outputKey = tool.outputBlobs.map((b) => b.size).join(',');
    if (tool.outputBlobs.length > 0 && outputKey !== lastNotifiedKey.current && tool.inputInfos.length > 0) {
      lastNotifiedKey.current = outputKey;
      onCompleteRef.current?.({
        outputBlobs: tool.outputBlobs, outputUrls: tool.outputUrls,
        inputSize: tool.inputInfos.reduce((s, i) => s + i.size, 0),
        outputSize: tool.outputBlobs.reduce((s, b) => s + b.size, 0), preset: 'trim',
      });
    }
  }, [tool.outputBlobs, tool.outputUrls, tool.inputInfos]);

  // trim 默认 autoRun=false(需要用户设定时间范围后手动触发)
  useEffect(() => {
    if (inputKey && tool.ready && autoRun && endTime > startTime && lastRunInputKey.current !== inputKey) {
      lastRunInputKey.current = inputKey;
      void runTrim();
    }
    if (!inputKey) lastRunInputKey.current = null;
  }, [inputKey, tool.ready, autoRun, startTime, endTime, runTrim]);

  const handleFiles = useCallback(async (files: File[]) => { await tool.handleFiles(files); }, [tool]);

  return {
    ready: tool.ready, initError: tool.initError,
    inputUrls: tool.inputUrls, inputInfos: tool.inputInfos,
    outputUrls: tool.outputUrls, outputInfos: tool.outputInfos, outputBlobs: tool.outputBlobs,
    busy: tool.busy, error: tool.error,
    startTime, endTime, setStartTime, setEndTime,
    handleFiles, reset: tool.reset, clearError: tool.clearError,
    run: runTrim,
  };
}
