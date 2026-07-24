/**
 * useVideoScreenshot — 视频截图 hook(Layer 0)。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useVideoTool } from '../internal/useVideoTool';
import { buildSingleStepVideoWorkflow } from '../internal/workflow-builder';
import type { VideoFileInfo } from '../internal/download';
import type { UseVideoActionOptions } from './useVideoCompress';

export type VideoScreenshotPreset = 'first' | 'middle' | 'custom';

export const VIDEO_SCREENSHOT_PRESETS: Record<VideoScreenshotPreset, { position: string }> = {
  first: { position: '0' },
  middle: { position: '50%' },
  custom: { position: '0' },
};

export interface UseVideoScreenshotResult {
  ready: boolean;
  initError: string | null;
  inputUrls: string[];
  inputInfos: VideoFileInfo[];
  outputUrls: string[];
  outputInfos: VideoFileInfo[];
  outputBlobs: Blob[];
  busy: boolean;
  error: string | null;
  preset: VideoScreenshotPreset;
  /** 自定义截图时间(秒,preset=custom 时使用) */
  time: number;
  setTime: (t: number) => void;
  handleFiles: (files: File[]) => Promise<void>;
  setPreset: (preset: VideoScreenshotPreset) => void;
  reset: () => void;
  clearError: () => void;
  run: () => Promise<void>;
}

export function useVideoScreenshot(
  options?: UseVideoActionOptions<VideoScreenshotPreset>
): UseVideoScreenshotResult {
  const { initialPreset = 'first', autoRun = true, onComplete, plugins } = options ?? {};
  const tool = useVideoTool({ plugins });
  const [preset, setPresetState] = useState<VideoScreenshotPreset>(initialPreset);
  const [time, setTimeState] = useState(0);

  const lastRunInputKey = useRef<string | null>(null);
  const lastNotifiedKey = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const inputKey = tool.inputIds.join(',');

  const runScreenshot = useCallback(
    async (nextPreset: VideoScreenshotPreset, nextTime: number): Promise<void> => {
      const config = VIDEO_SCREENSHOT_PRESETS[nextPreset];
      const position = nextPreset === 'custom' ? String(nextTime) : config.position;
      const wf = buildSingleStepVideoWorkflow(
        'video.screenshot', { position }, 'VideoScreenshot', 'Capture video frame'
      );
      await tool.runWorkflow(wf);
    },
    [tool]
  );

  useEffect(() => {
    const outputKey = tool.outputBlobs.map((b) => b.size).join(',');
    if (tool.outputBlobs.length > 0 && outputKey !== lastNotifiedKey.current && tool.inputInfos.length > 0) {
      lastNotifiedKey.current = outputKey;
      onCompleteRef.current?.({
        outputBlobs: tool.outputBlobs, outputUrls: tool.outputUrls,
        inputSize: tool.inputInfos.reduce((s, i) => s + i.size, 0),
        outputSize: tool.outputBlobs.reduce((s, b) => s + b.size, 0), preset,
      });
    }
  }, [tool.outputBlobs, tool.outputUrls, tool.inputInfos, preset]);

  useEffect(() => {
    if (inputKey && tool.ready && autoRun && lastRunInputKey.current !== inputKey) {
      lastRunInputKey.current = inputKey;
      void runScreenshot(preset, time);
    }
    if (!inputKey) lastRunInputKey.current = null;
  }, [inputKey, tool.ready, autoRun, preset, time, runScreenshot]);

  const setPreset = useCallback((next: VideoScreenshotPreset) => {
    setPresetState(next);
    if (inputKey && !tool.busy) { lastRunInputKey.current = inputKey; void runScreenshot(next, time); }
  }, [inputKey, tool.busy, time, runScreenshot]);

  const setTime = useCallback((t: number) => {
    setTimeState(t);
    setPresetState('custom');
    if (inputKey && !tool.busy) { lastRunInputKey.current = inputKey; void runScreenshot('custom', t); }
  }, [inputKey, tool.busy, runScreenshot]);

  const handleFiles = useCallback(async (files: File[]) => { await tool.handleFiles(files); }, [tool]);

  return {
    ready: tool.ready, initError: tool.initError,
    inputUrls: tool.inputUrls, inputInfos: tool.inputInfos,
    outputUrls: tool.outputUrls, outputInfos: tool.outputInfos, outputBlobs: tool.outputBlobs,
    busy: tool.busy, error: tool.error, preset, time, setTime,
    handleFiles, setPreset, reset: tool.reset, clearError: tool.clearError,
    run: () => runScreenshot(preset, time),
  };
}
