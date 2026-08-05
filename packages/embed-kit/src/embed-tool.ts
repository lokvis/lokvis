/**
 * useEmbedTool — embed-* 包共享的工具 hook 工厂(FO-17)。
 *
 * 统一 useImageTool / usePdfTool / useVideoTool 中 ~70% 相同的:
 * - input/output asset 状态管理
 * - ObjectURL 生命周期(create / revoke)
 * - handleFiles → importAsset → probe 流程
 * - runWorkflow / runWorkflowRaw 状态机(busy / error / reset)
 *
 * 差异点通过注入:
 * - multiple: 单文件(scalar 适配) vs 多文件(array)
 * - probeFile: File → FileInfo(输入文件信息)
 * - probeBlob: Blob → FileInfo(输出文件信息)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AssetId,
  LokvisRuntime,
  Workflow,
  WorkflowResult,
} from '@lokvis/sdk';
import type { UseLokvisRuntimeResult } from './runtime.js';

/** useEmbedTool 工厂选项 */
export interface UseEmbedToolOptions<TFileInfo> {
  /** useLokvisRuntime 返回值(runtime / ready / initError) */
  runtimeResult: UseLokvisRuntimeResult;
  /** 是否接受多文件输入(默认 false,仅取首个) */
  multiple?: boolean;
  /** 从输入 File 提取文件信息(如 getImageInfo / getVideoFileInfo);assetId 供 PDF 等需 runtime 元数据的场景 */
  probeFile: (file: File, assetId: AssetId) => Promise<TFileInfo>;
  /** 从输出 Blob 提取文件信息;assetId 供 PDF 等需 runtime 元数据的场景 */
  probeBlob: (blob: Blob, assetId: AssetId) => Promise<TFileInfo>;
}

/** useEmbedTool 工厂返回值(统一 array 形态) */
export interface UseEmbedToolResult<TFileInfo> {
  runtime: LokvisRuntime | null;
  ready: boolean;
  initError: string | null;
  inputIds: AssetId[];
  inputUrls: string[];
  inputInfos: TFileInfo[];
  outputBlobs: Blob[];
  outputUrls: string[];
  outputInfos: TFileInfo[];
  busy: boolean;
  error: string | null;
  handleFiles: (files: File[]) => Promise<void>;
  runWorkflow: (workflow: Workflow) => Promise<void>;
  runWorkflowRaw: (workflow: Workflow) => Promise<WorkflowResult | null>;
  reset: () => void;
  clearError: () => void;
}

/**
 * embed-* 工具 hook 统一工厂。
 *
 * 各包用此工厂生成内部 hook,再包装为原有 API(scalar/array、额外方法等)。
 */
export function useEmbedTool<TFileInfo>(
  opts: UseEmbedToolOptions<TFileInfo>
): UseEmbedToolResult<TFileInfo> {
  const { runtimeResult, multiple = false, probeFile, probeBlob } = opts;
  const { runtime, ready, error: initError } = runtimeResult;

  const [inputIds, setInputIds] = useState<AssetId[]>([]);
  const [inputUrls, setInputUrls] = useState<string[]>([]);
  const [inputInfos, setInputInfos] = useState<TFileInfo[]>([]);
  const [outputBlobs, setOutputBlobs] = useState<Blob[]>([]);
  const [outputUrls, setOutputUrls] = useState<string[]>([]);
  const [outputInfos, setOutputInfos] = useState<TFileInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputUrlsRef = useRef<string[]>([]);

  const revokeInputUrls = useCallback((urlsToRevoke: string[]) => {
    for (const url of urlsToRevoke) URL.revokeObjectURL(url);
  }, []);

  const handleFiles = useCallback(
    async (files: File[]): Promise<void> => {
      if (!runtime || files.length === 0) return;
      const accepted = multiple ? files : [files[0]!];
      
      // Revoke previous input URLs first
      revokeInputUrls(inputUrlsRef.current);
      
      // Initialize arrays before try block for error cleanup
      const ids: AssetId[] = [];
      const urls: string[] = [];
      const infos: TFileInfo[] = [];
      
      try {
        for (const file of accepted) {
          const id = await runtime.importAsset({ kind: 'file', file });
          ids.push(id);
          urls.push(URL.createObjectURL(file));
          infos.push(await probeFile(file, id));
        }
        
        setInputIds(ids);
        setInputUrls(urls);
        setInputInfos(infos);
        setOutputBlobs([]);
        setOutputInfos([]);
        setError(null);
        
        // Update ref after successful state update
        inputUrlsRef.current = urls;
      } catch (err) {
        // Clean up created URLs on error
        revokeInputUrls(urls);
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [runtime, multiple, revokeInputUrls, probeFile]
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
      const infos: TFileInfo[] = [];
      for (const outputId of result.outputs) {
        const blob = await runtime!.exportAsset(outputId);
        blobs.push(blob);
        infos.push(await probeBlob(blob, outputId));
      }
      setOutputBlobs(blobs);
      setOutputInfos(infos);
    },
    [runtime, runWorkflowRaw, probeBlob]
  );

  const reset = useCallback(() => {
    revokeInputUrls(inputUrlsRef.current);
    inputUrlsRef.current = [];
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
      // Clean up on unmount
      revokeInputUrls(inputUrlsRef.current);
    };
  }, [revokeInputUrls]);

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
