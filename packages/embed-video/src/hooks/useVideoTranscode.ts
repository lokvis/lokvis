/**
 * useVideoTranscode — 视频转码 hook(Layer 0)。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useVideoTool } from '../internal/useVideoTool';
import { buildSingleStepVideoWorkflow } from '../internal/workflow-builder';
import type { VideoFileInfo } from '../internal/download';
import type { UseVideoActionOptions } from './useVideoCompress';

export type VideoTranscodePreset = 'mp4' | 'webm' | 'gif';

export const VIDEO_TRANSCODE_PRESETS: Record<VideoTranscodePreset, { format: string }> = {
  mp4: { format: 'mp4' },
  webm: { format: 'webm' },
  gif: { format: 'gif' },
};

export interface UseVideoTranscodeResult {
  ready: boolean;
  initError: string | null;
  inputUrls: string[];
  inputInfos: VideoFileInfo[];
  outputUrls: string[];
  outputInfos: VideoFileInfo[];
  outputBlobs: Blob[];
  busy: boolean;
  error: string | null;
  preset: VideoTranscodePreset;
  handleFiles: (files: File[]) => Promise<void>;
  setPreset: (preset: VideoTranscodePreset) => void;
  reset: () => void;
  clearError: () => void;
  run: () => Promise<void>;
}

export function useVideoTranscode(
  options?: UseVideoActionOptions<VideoTranscodePreset>
): UseVideoTranscodeResult {
  const { initialPreset = 'mp4', autoRun = true, onComplete, plugins } = options ?? {};
  const tool = useVideoTool({ plugins });
  const [preset, setPresetState] = useState<VideoTranscodePreset>(initialPreset);

  const lastRunInputKey = useRef<string | null>(null);
  const lastNotifiedKey = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const inputKey = tool.inputIds.join(',');

  const runTranscode = useCallback(
    async (nextPreset: VideoTranscodePreset): Promise<void> => {
      const config = VIDEO_TRANSCODE_PRESETS[nextPreset];
      const wf = buildSingleStepVideoWorkflow(
        'video.transcode', { format: config.format }, 'VideoTranscode', 'Transcode video format'
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
      void runTranscode(preset);
    }
    if (!inputKey) lastRunInputKey.current = null;
  }, [inputKey, tool.ready, autoRun, preset, runTranscode]);

  const setPreset = useCallback((next: VideoTranscodePreset) => {
    setPresetState(next);
    if (inputKey && !tool.busy) { lastRunInputKey.current = inputKey; void runTranscode(next); }
  }, [inputKey, tool.busy, runTranscode]);

  const handleFiles = useCallback(async (files: File[]) => { await tool.handleFiles(files); }, [tool]);

  return {
    ready: tool.ready, initError: tool.initError,
    inputUrls: tool.inputUrls, inputInfos: tool.inputInfos,
    outputUrls: tool.outputUrls, outputInfos: tool.outputInfos, outputBlobs: tool.outputBlobs,
    busy: tool.busy, error: tool.error, preset,
    handleFiles, setPreset, reset: tool.reset, clearError: tool.clearError,
    run: () => runTranscode(preset),
  };
}
