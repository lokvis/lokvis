/**
 * useVideoToGif — 视频转 GIF hook(Layer 0)。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useVideoTool } from '../internal/useVideoTool';
import { buildSingleStepVideoWorkflow } from '../internal/workflow-builder';
import type { VideoFileInfo } from '../internal/download';
import type { UseVideoActionOptions } from './useVideoCompress';

export type VideoToGifPreset = 'standard' | 'high';

export const VIDEO_TO_GIF_PRESETS: Record<VideoToGifPreset, { fps: number; width: number }> = {
  standard: { fps: 10, width: 480 },
  high: { fps: 15, width: 640 },
};

export interface UseVideoToGifResult {
  ready: boolean;
  initError: string | null;
  inputUrls: string[];
  inputInfos: VideoFileInfo[];
  outputUrls: string[];
  outputInfos: VideoFileInfo[];
  outputBlobs: Blob[];
  busy: boolean;
  error: string | null;
  preset: VideoToGifPreset;
  handleFiles: (files: File[]) => Promise<void>;
  setPreset: (preset: VideoToGifPreset) => void;
  reset: () => void;
  clearError: () => void;
  run: () => Promise<void>;
}

export function useVideoToGif(
  options?: UseVideoActionOptions<VideoToGifPreset>
): UseVideoToGifResult {
  const { initialPreset = 'standard', autoRun = true, onComplete, plugins } = options ?? {};
  const tool = useVideoTool({ plugins });
  const [preset, setPresetState] = useState<VideoToGifPreset>(initialPreset);

  const lastRunInputKey = useRef<string | null>(null);
  const lastNotifiedKey = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const inputKey = tool.inputIds.join(',');

  const runToGif = useCallback(
    async (nextPreset: VideoToGifPreset): Promise<void> => {
      const config = VIDEO_TO_GIF_PRESETS[nextPreset];
      const wf = buildSingleStepVideoWorkflow(
        'video.to-gif', { fps: config.fps, width: config.width }, 'VideoToGif', 'Convert video to GIF'
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
      void runToGif(preset);
    }
    if (!inputKey) lastRunInputKey.current = null;
  }, [inputKey, tool.ready, autoRun, preset, runToGif]);

  const setPreset = useCallback((next: VideoToGifPreset) => {
    setPresetState(next);
    if (inputKey && !tool.busy) { lastRunInputKey.current = inputKey; void runToGif(next); }
  }, [inputKey, tool.busy, runToGif]);

  const handleFiles = useCallback(async (files: File[]) => { await tool.handleFiles(files); }, [tool]);

  return {
    ready: tool.ready, initError: tool.initError,
    inputUrls: tool.inputUrls, inputInfos: tool.inputInfos,
    outputUrls: tool.outputUrls, outputInfos: tool.outputInfos, outputBlobs: tool.outputBlobs,
    busy: tool.busy, error: tool.error, preset,
    handleFiles, setPreset, reset: tool.reset, clearError: tool.clearError,
    run: () => runToGif(preset),
  };
}
