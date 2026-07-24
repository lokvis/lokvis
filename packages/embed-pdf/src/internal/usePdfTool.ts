/**
 * usePdfTool — PDF 工具页共享 hook(@lokvis/embed-pdf 内部)。
 *
 * 与 @lokvis/embed-image 的 useImageTool 模式一致,但适配 PDF 特性:
 * - 支持多文件输入(merge 场景:N→1)
 * - 支持多输出(split 场景:1→N)
 * - 文件信息为 PdfFileInfo(pageCount/size)而非 ImageInfo(width/height)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssetId, PluginLoadEntry, Workflow, WorkflowResult } from '@lokvis/sdk';
import { useLokvisRuntime } from './useLokvisRuntime';
import { getPdfFileInfo, type PdfFileInfo } from './download';

export interface UsePdfToolOptions {
  /** 是否接受多文件输入(merge 场景,默认 false) */
  multiple?: boolean;
  /** 预加载插件列表 */
  plugins?: PluginLoadEntry[];
}

export interface UsePdfToolResult {
  runtime: ReturnType<typeof useLokvisRuntime>['runtime'];
  ready: boolean;
  initError: string | null;
  /** 输入资产 ID 列表(merge 时多个) */
  inputIds: AssetId[];
  /** 输入预览 URL 列表 */
  inputUrls: string[];
  /** 输入文件信息列表 */
  inputInfos: PdfFileInfo[];
  /** 输出 Blob 列表(split 时多个) */
  outputBlobs: Blob[];
  /** 输出预览 URL 列表 */
  outputUrls: string[];
  /** 输出文件信息列表 */
  outputInfos: PdfFileInfo[];
  /** 处理中 */
  busy: boolean;
  /** 错误信息 */
  error: string | null;
  /** 处理上传文件 */
  handleFiles: (files: File[]) => Promise<void>;
  /** 执行 workflow 并导出 output */
  runWorkflow: (workflow: Workflow) => Promise<void>;
  /** 执行 workflow 并返回原始 WorkflowResult */
  runWorkflowRaw: (workflow: Workflow) => Promise<WorkflowResult | null>;
  /** 重置全部状态 */
  reset: () => void;
  /** 清除错误 */
  clearError: () => void;
}

export function usePdfTool(options?: UsePdfToolOptions): UsePdfToolResult {
  const { multiple = false, plugins } = options ?? {};
  const { runtime, ready, error: initError } = useLokvisRuntime(undefined, plugins);
  const [inputIds, setInputIds] = useState<AssetId[]>([]);
  const [inputUrls, setInputUrls] = useState<string[]>([]);
  const [inputInfos, setInputInfos] = useState<PdfFileInfo[]>([]);
  const [outputBlobs, setOutputBlobs] = useState<Blob[]>([]);
  const [outputUrls, setOutputUrls] = useState<string[]>([]);
  const [outputInfos, setOutputInfos] = useState<PdfFileInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputUrlsRef = useRef<string[]>([]);
  inputUrlsRef.current = inputUrls;

  const revokeInputUrls = useCallback(() => {
    for (const url of inputUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    inputUrlsRef.current = [];
  }, []);

  const handleFiles = useCallback(
    async (files: File[]): Promise<void> => {
      if (!runtime || files.length === 0) return;
      const accepted = multiple ? files : [files[0]!];
      try {
        const ids: AssetId[] = [];
        const urls: string[] = [];
        const infos: PdfFileInfo[] = [];
        for (const file of accepted) {
          const id = await runtime.importAsset({ kind: 'file', file });
          ids.push(id);
          urls.push(URL.createObjectURL(file));
          infos.push(await getPdfFileInfo(file));
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
      const infos: PdfFileInfo[] = [];
      for (const outputId of result.outputs) {
        const blob = await runtime!.exportAsset(outputId);
        blobs.push(blob);
        infos.push(await getPdfFileInfo(blob));
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

  // outputUrls 生命周期管理
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

  // 卸载时清理 input URLs
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
