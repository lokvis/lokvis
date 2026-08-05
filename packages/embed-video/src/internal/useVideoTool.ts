/**
 * useVideoTool — Video 工具页共享 hook(@lokvis/embed-video 内部)。
 *
 * FO-17: 经 useEmbedTool 工厂生成,仅注入 video 特有的 probe 函数。
 */
import { useEmbedTool } from '@lokvis/embed-kit';
import type { PluginLoadEntry, Workflow, WorkflowResult } from '@lokvis/sdk';
import { useLokvisRuntime } from './useLokvisRuntime';
import { getVideoFileInfo, type VideoFileInfo } from './download';

export interface UseVideoToolOptions {
  multiple?: boolean;
  plugins?: PluginLoadEntry[];
}

export interface UseVideoToolResult {
  runtime: ReturnType<typeof useLokvisRuntime>['runtime'];
  ready: boolean;
  initError: string | null;
  inputIds: string[];
  inputUrls: string[];
  inputInfos: VideoFileInfo[];
  outputBlobs: Blob[];
  outputUrls: string[];
  outputInfos: VideoFileInfo[];
  busy: boolean;
  error: string | null;
  handleFiles: (files: File[]) => Promise<void>;
  runWorkflow: (workflow: Workflow) => Promise<void>;
  runWorkflowRaw: (workflow: Workflow) => Promise<WorkflowResult | null>;
  reset: () => void;
  clearError: () => void;
}

export function useVideoTool(options?: UseVideoToolOptions): UseVideoToolResult {
  const { multiple = false, plugins } = options ?? {};
  const runtimeResult = useLokvisRuntime(undefined, plugins);
  return useEmbedTool<VideoFileInfo>({
    runtimeResult,
    multiple,
    probeFile: (file) => getVideoFileInfo(file),
    probeBlob: (blob) => getVideoFileInfo(blob),
  });
}
