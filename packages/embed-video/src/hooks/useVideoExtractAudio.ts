/**
 * useVideoExtractAudio — 视频提取音频 hook(Layer 0)。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useVideoTool } from '../internal/useVideoTool';
import { buildSingleStepVideoWorkflow } from '../internal/workflow-builder';
import type { VideoFileInfo } from '../internal/download';
import type { UseVideoActionOptions } from './useVideoCompress';

export type VideoExtractAudioPreset = 'mp3' | 'wav' | 'aac';

export const VIDEO_EXTRACT_AUDIO_PRESETS: Record<VideoExtractAudioPreset, { format: string }> = {
  mp3: { format: 'mp3' },
  wav: { format: 'wav' },
  aac: { format: 'aac' },
};

export interface UseVideoExtractAudioResult {
  ready: boolean;
  initError: string | null;
  inputUrls: string[];
  inputInfos: VideoFileInfo[];
  outputUrls: string[];
  outputInfos: VideoFileInfo[];
  outputBlobs: Blob[];
  busy: boolean;
  error: string | null;
  preset: VideoExtractAudioPreset;
  handleFiles: (files: File[]) => Promise<void>;
  setPreset: (preset: VideoExtractAudioPreset) => void;
  reset: () => void;
  clearError: () => void;
  run: () => Promise<void>;
}

export function useVideoExtractAudio(
  options?: UseVideoActionOptions<VideoExtractAudioPreset>
): UseVideoExtractAudioResult {
  const { initialPreset = 'mp3', autoRun = true, onComplete, plugins } = options ?? {};
  const tool = useVideoTool({ plugins });
  const [preset, setPresetState] = useState<VideoExtractAudioPreset>(initialPreset);

  const lastRunInputKey = useRef<string | null>(null);
  const lastNotifiedKey = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const inputKey = tool.inputIds.join(',');

  const runExtract = useCallback(
    async (nextPreset: VideoExtractAudioPreset): Promise<void> => {
      const config = VIDEO_EXTRACT_AUDIO_PRESETS[nextPreset];
      const wf = buildSingleStepVideoWorkflow(
        'video.extract-audio', { format: config.format }, 'VideoExtractAudio', 'Extract audio from video'
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
      void runExtract(preset);
    }
    if (!inputKey) lastRunInputKey.current = null;
  }, [inputKey, tool.ready, autoRun, preset, runExtract]);

  const setPreset = useCallback((next: VideoExtractAudioPreset) => {
    setPresetState(next);
    if (inputKey && !tool.busy) { lastRunInputKey.current = inputKey; void runExtract(next); }
  }, [inputKey, tool.busy, runExtract]);

  const handleFiles = useCallback(async (files: File[]) => { await tool.handleFiles(files); }, [tool]);

  return {
    ready: tool.ready, initError: tool.initError,
    inputUrls: tool.inputUrls, inputInfos: tool.inputInfos,
    outputUrls: tool.outputUrls, outputInfos: tool.outputInfos, outputBlobs: tool.outputBlobs,
    busy: tool.busy, error: tool.error, preset,
    handleFiles, setPreset, reset: tool.reset, clearError: tool.clearError,
    run: () => runExtract(preset),
  };
}
