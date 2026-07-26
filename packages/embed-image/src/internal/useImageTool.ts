/**
 * useImageTool — 单图片工具页共享 hook(@lokvis/embed-image 内部副本)。
 *
 * 与 apps/playground/src/components/toolkit/useImageTool.ts 保持一致;
 * 包内独立维护避免与 playground 相互耦合。
 *
 * W23:接受可选 `plugins` 参数,透传给 useLokvisRuntime。三方接入可组合
 * image / audio / pdf / video 插件。undefined 时使用默认 [imageToolsPlugin()]。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssetId, PluginLoadEntry, Workflow, WorkflowResult } from '@lokvis/sdk';
import { useLokvisRuntime } from './useLokvisRuntime';
import { getImageInfo, type ImageInfo } from './download';

export interface UseImageToolResult {
  /** 复用 runtime hook 的状态 */
  runtime: ReturnType<typeof useLokvisRuntime>['runtime'];
  ready: boolean;
  initError: string | null;
  /** 输入资产 ID */
  inputId: AssetId | null;
  /** 输入预览 URL */
  inputUrl: string | null;
  /** 输入图片信息 */
  inputInfo: ImageInfo | null;
  /** 输出 Blob */
  outputBlob: Blob | null;
  /** 输出预览 URL(自动管理生命周期) */
  outputUrl: string | null;
  /** 输出图片信息 */
  outputInfo: ImageInfo | null;
  /** 处理中 */
  busy: boolean;
  /** 错误信息 */
  error: string | null;
  /** 处理上传文件(取首个,多文件时仅取第一个) */
  handleFiles: (files: File[]) => Promise<{ skipped: number }>;
  /** 执行 workflow 并导出 output(单步场景:写入 outputBlob/outputInfo 状态) */
  runWorkflow: (workflow: Workflow) => Promise<void>;
  /**
   * 执行 workflow 并返回原始 WorkflowResult(不写入 output 状态)。
   * 多步 pipeline 场景需读取 result.stepOutputs 取各步中间产物。
   */
  runWorkflowRaw: (workflow: Workflow) => Promise<WorkflowResult | null>;
  /**
   * 将已产出的 blob 直接写入 output 状态(outputBlob/outputInfo)。
   * 用于迭代压缩(target-size)收敛后复用中间产物,避免重复编码一次。
   */
  commitOutput: (blob: Blob) => Promise<void>;
  /** 重置全部状态并 revoke 旧 URL */
  reset: () => void;
  /** 手动清错误 */
  clearError: () => void;
}

export function useImageTool(plugins?: PluginLoadEntry[]): UseImageToolResult {
  const { runtime, ready, error: initError } = useLokvisRuntime(undefined, plugins);
  const [inputId, setInputId] = useState<AssetId | null>(null);
  const [inputUrl, setInputUrl] = useState<string | null>(null);
  const [inputInfo, setInputInfo] = useState<ImageInfo | null>(null);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputInfo, setOutputInfo] = useState<ImageInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputUrlRef = useRef<string | null>(null);
  inputUrlRef.current = inputUrl;

  const revokeInputUrl = useCallback(() => {
    if (inputUrlRef.current) {
      URL.revokeObjectURL(inputUrlRef.current);
      inputUrlRef.current = null;
    }
  }, []);

  const handleFiles = useCallback(
    async (files: File[]): Promise<{ skipped: number }> => {
      if (!runtime || files.length === 0) return { skipped: 0 };
      const skipped = Math.max(0, files.length - 1);
      try {
        const file = files[0]!;
        const id = await runtime.importAsset({ kind: 'file', file });
        revokeInputUrl();
        const url = URL.createObjectURL(file);
        setInputId(id);
        setInputUrl(url);
        setInputInfo(await getImageInfo(file));
        setOutputBlob(null);
        setOutputInfo(null);
        setError(null);
        return { skipped };
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return { skipped };
      }
    },
    [runtime, revokeInputUrl]
  );

  const runWorkflowRaw = useCallback(
    async (workflow: Workflow): Promise<WorkflowResult | null> => {
      if (!runtime || !inputId) return null;
      setBusy(true);
      setError(null);
      try {
        const result = await runtime.run(workflow, [inputId]);
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
    [runtime, inputId]
  );

  const runWorkflow = useCallback(
    async (workflow: Workflow): Promise<void> => {
      const result = await runWorkflowRaw(workflow);
      if (!result || result.status !== 'completed' || !result.outputs[0]) return;
      const blob = await runtime!.exportAsset(result.outputs[0]);
      setOutputBlob(blob);
      setOutputInfo(await getImageInfo(blob));
    },
    [runtime, runWorkflowRaw]
  );

  const commitOutput = useCallback(async (blob: Blob): Promise<void> => {
    setOutputBlob(blob);
    setOutputInfo(await getImageInfo(blob));
  }, []);

  const reset = useCallback(() => {
    revokeInputUrl();
    setInputId(null);
    setInputUrl(null);
    setInputInfo(null);
    setOutputBlob(null);
    setOutputInfo(null);
    setError(null);
  }, [revokeInputUrl]);

  const clearError = useCallback(() => setError(null), []);

  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!outputBlob) {
      setOutputUrl(null);
      return;
    }
    const url = URL.createObjectURL(outputBlob);
    setOutputUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [outputBlob]);

  useEffect(() => {
    return () => {
      if (inputUrlRef.current) URL.revokeObjectURL(inputUrlRef.current);
    };
  }, []);

  return {
    runtime,
    ready,
    initError,
    inputId,
    inputUrl,
    inputInfo,
    outputBlob,
    outputUrl,
    outputInfo,
    busy,
    error,
    handleFiles,
    runWorkflow,
    runWorkflowRaw,
    commitOutput,
    reset,
    clearError,
  };
}
