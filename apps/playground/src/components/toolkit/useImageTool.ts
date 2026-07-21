/**
 * useImageTool — 单图片工具页共享 hook。
 *
 * 5 个工具页(Compress/Resize/Convert/Crop/Watermark)共用相同的 input/output 生命周期:
 *   - importAsset + 创建预览 URL + 读取 ImageInfo
 *   - output Blob → URL,自动 revoke
 *   - input URL cleanup(unmount 或换图时 revoke)
 *   - reset() 重置全部状态并 revoke 旧 URL
 *   - runWorkflow(workflow) 统一执行 + 导出 output Blob
 *
 * 抽出此 hook 后,工具页只需定义参数面板 + buildWorkflow(params)。
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
   *
   * 多步 pipeline 场景需读取 result.stepOutputs 取各步中间产物,
   * 不适合走 runWorkflow(它只暴露最终 Blob)。此方法统一错误归一化 +
   * busy 状态,避免调用方绕过 hook 直接调 runtime.run。
   */
  runWorkflowRaw: (workflow: Workflow) => Promise<WorkflowResult | null>;
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

  // 用 ref 持有当前 inputUrl,reset 时能立即 revoke(不必等 effect)
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
        // 换图时先 revoke 旧 URL,避免泄漏
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

  // output Blob → URL,自动 revoke
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

  // unmount 时 revoke inputUrl
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
    reset,
    clearError,
  };
}
