/**
 * useVideoTool — Video 工具页共享 hook(@lokvis/embed-video 内部)。
 *
 * 与 @lokvis/embed-pdf 的 usePdfTool 模式一致,适配 Video 特性:
 * - 支持多文件输入(merge 场景)
 * - 文件信息为 VideoFileInfo(size/format/duration)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssetId, PluginLoadEntry, Workflow, WorkflowResult } from '@lokvis/sdk';
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
  inputIds: AssetId[];
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
  const { runtime, ready, error: initError } = useLokvisRuntime(undefined, plugins);
  const [inputIds, setInputIds] = useState<AssetId[]>([]);
  const [inputUrls, setInputUrls] = useState<string[]>([]);
  const [inputInfos, setInputInfos] = useState<VideoFileInfo[]>([]);
  const [outputBlobs, setOutputBlobs] = useState<Blob[]>([]);
  const [outputUrls, setOutputUrls] = useState<string[]>([]);
  const [outputInfos, setOutputInfos] = useState<VideoFileInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputUrlsRef = useRef<string[]>([]);
  inputUrlsRef.current = inputUrls;

  const revokeInputUrls = useCallback(() => {
    for (const url of inputUrlsRef.current) URL.revokeObjectURL(url);
    inputUrlsRef.current = [];
  }, []);

  const handleFiles = useCallback(
    async (files: File[]): Promise<void> => {
      if (!runtime || files.length === 0) return;
      const accepted = multiple ? files : [files[0]!];
      try {
        const ids: AssetId[] = [];
        const urls: string[] = [];
        const infos: VideoFileInfo[] = [];
        for (const file of accepted) {
          const id = await runtime.importAsset({ kind: 'file', file });
          ids.push(id);
          urls.push(URL.createObjectURL(file));
          infos.push(await getVideoFileInfo(file));
        }
        revokeInputUrls();
        setInputIds(ids);
        setInputUrls(urls);
        setInputInfos(infos);
        setOutputBlobs([]);
        setOutputInfos([]);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [runtime, multiple, revokeInputUrls]
  );

  const runWorkflowRaw = useCallback(
    async (workflow: Workflow): Promise<WorkflowResult | null> => {
      if (!runtime || inputIds.length === 0) return null;
      setBusy(true);
      setError(null);
      try {
        const result = await runtime.run(workflow, inputIds);
        if (result.status !== 'completed') {
          setError(result.error ?? '处理失败');
          return result;
        }
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [runtime, inputIds]
  );

  const runWorkflow = useCallback(
    async (workflow: Workflow): Promise<void> => {
      const result = await runWorkflowRaw(workflow);
      if (!result || result.status !== 'completed' || result.outputs.length === 0) return;
      const blobs: Blob[] = [];
      const infos: VideoFileInfo[] = [];
      for (const outputId of result.outputs) {
        const blob = await runtime!.exportAsset(outputId);
        blobs.push(blob);
        infos.push(await getVideoFileInfo(blob));
      }
      setOutputBlobs(blobs);
      setOutputInfos(infos);
    },
    [runtime, runWorkflowRaw]
  );

  const reset = useCallback(() => {
    revokeInputUrls();
    setInputIds([]);
    setInputUrls([]);
    setInputInfos([]);
    setOutputBlobs([]);
    setOutputInfos([]);
    setError(null);
  }, [revokeInputUrls]);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    if (outputBlobs.length === 0) {
      setOutputUrls([]);
      return;
    }
    const urls = outputBlobs.map((b) => URL.createObjectURL(b));
    setOutputUrls(urls);
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [outputBlobs]);

  useEffect(() => {
    return () => {
      for (const url of inputUrlsRef.current) URL.revokeObjectURL(url);
    };
  }, []);

  return {
    runtime,
    ready,
    initError,
    inputIds,
    inputUrls,
    inputInfos,
    outputBlobs,
    outputUrls,
    outputInfos,
    busy,
    error,
    handleFiles,
    runWorkflow,
    runWorkflowRaw,
    reset,
    clearError,
  };
}
