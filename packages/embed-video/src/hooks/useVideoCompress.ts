/**
 * useVideoCompress — 视频压缩 hook(Layer 0)。
 *
 * 当前浏览器引擎为 stub,调用后 error 状态会体现"能力不可用"。
 * 引擎实装后(wasm / remote backend)零改动生效。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PluginLoadEntry } from '@lokvis/sdk';
import { useVideoTool } from '../internal/useVideoTool';
import { buildSingleStepVideoWorkflow } from '../internal/workflow-builder';
import type { VideoFileInfo } from '../internal/download';

export type VideoCompressPreset = 'balanced' | 'high' | 'small';

export const VIDEO_COMPRESS_PRESETS: Record<VideoCompressPreset, { quality: number }> = {
  balanced: { quality: 70 },
  high: { quality: 85 },
  small: { quality: 50 },
};

export interface UseVideoActionOptions<Preset extends string = string> {
  initialPreset?: Preset;
  autoRun?: boolean;
  onComplete?: (result: VideoActionResult) => void;
  plugins?: PluginLoadEntry[];
}

export interface VideoActionResult {
  outputBlobs: Blob[];
  outputUrls: string[];
  inputSize: number;
  outputSize: number;
  preset: string;
}

export interface UseVideoCompressResult {
  ready: boolean;
  initError: string | null;
  inputUrls: string[];
  inputInfos: VideoFileInfo[];
  outputUrls: string[];
  outputInfos: VideoFileInfo[];
  outputBlobs: Blob[];
  busy: boolean;
  error: string | null;
  preset: VideoCompressPreset;
  ratio: number | null;
  handleFiles: (files: File[]) => Promise<void>;
  setPreset: (preset: VideoCompressPreset) => void;
  reset: () => void;
  clearError: () => void;
  run: () => Promise<void>;
}

export function useVideoCompress(
  options?: UseVideoActionOptions<VideoCompressPreset>
): UseVideoCompressResult {
  const { initialPreset = 'balanced', autoRun = true, onComplete, plugins } = options ?? {};
  const tool = useVideoTool({ plugins });
  const [preset, setPresetState] = useState<VideoCompressPreset>(initialPreset);

  const lastRunInputKey = useRef<string | null>(null);
  const lastNotifiedKey = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const inputKey = tool.inputIds.join(',');

  const runCompress = useCallback(
    async (nextPreset: VideoCompressPreset): Promise<void> => {
      const config = VIDEO_COMPRESS_PRESETS[nextPreset];
      const wf = buildSingleStepVideoWorkflow(
        'video.compress',
        { quality: config.quality },
        'VideoCompress',
        'Compress video with preset'
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
        outputBlobs: tool.outputBlobs,
        outputUrls: tool.outputUrls,
        inputSize: tool.inputInfos.reduce((s, i) => s + i.size, 0),
        outputSize: tool.outputBlobs.reduce((s, b) => s + b.size, 0),
        preset,
      });
    }
  }, [tool.outputBlobs, tool.outputUrls, tool.inputInfos, preset]);

  useEffect(() => {
    if (inputKey && tool.ready && autoRun && lastRunInputKey.current !== inputKey) {
      lastRunInputKey.current = inputKey;
      void runCompress(preset);
    }
    if (!inputKey) lastRunInputKey.current = null;
  }, [inputKey, tool.ready, autoRun, preset, runCompress]);

  const setPreset = useCallback(
    (next: VideoCompressPreset) => {
      setPresetState(next);
      if (inputKey && !tool.busy) {
        lastRunInputKey.current = inputKey;
        void runCompress(next);
      }
    },
    [inputKey, tool.busy, runCompress]
  );

  const handleFiles = useCallback(async (files: File[]) => { await tool.handleFiles(files); }, [tool]);

  const inputSize = tool.inputInfos.reduce((s, i) => s + i.size, 0);
  const outputSize = tool.outputBlobs.reduce((s, b) => s + b.size, 0);
  const ratio = inputSize > 0 && tool.outputBlobs.length > 0 ? (1 - outputSize / inputSize) * 100 : null;

  return {
    ready: tool.ready, initError: tool.initError,
    inputUrls: tool.inputUrls, inputInfos: tool.inputInfos,
    outputUrls: tool.outputUrls, outputInfos: tool.outputInfos, outputBlobs: tool.outputBlobs,
    busy: tool.busy, error: tool.error, preset, ratio,
    handleFiles, setPreset, reset: tool.reset, clearError: tool.clearError,
    run: () => runCompress(preset),
  };
}
