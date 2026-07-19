/**
 * useAudioTool — 单音频工具页共享 hook。
 *
 * 与 useVideoTool / usePdfTool 对齐,但:
 * - 注入 audioToolsPlugin(浏览器版,全 stub,不加载 ffmpeg.wasm ~30MB)
 * - 输入为音频(用 inputUrl 直接 <audio> 预览)
 * - 输出永远为音频(transcode 不会跨形态,只换容器/codec)
 *
 * 浏览器版音频处理为 stub:实际执行会抛 "not implemented in stub" 错误,
 * UI 层捕获并显示明确提示(引导用户使用 Node 端 mcp-server)。
 *
 * 抽出此 hook 后,Audio 工具页只需定义参数面板 + buildWorkflow(params)。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssetId, Workflow } from '@lokvis/sdk';
import { createLokvis } from '@lokvis/sdk';
import type { LokvisRuntime } from '@lokvis/sdk';
import { audioToolsPlugin } from '@lokvis/plugin-audio';

export interface UseAudioToolResult {
  runtime: LokvisRuntime | null;
  ready: boolean;
  initError: string | null;
  /** 输入资产 ID */
  inputId: AssetId | null;
  /** 输入预览 URL(直接 <audio src>) */
  inputUrl: string | null;
  /** 输入文件名 */
  inputName: string | null;
  /** 输入大小(bytes) */
  inputSize: number | null;
  /** 输入音频时长(秒,由 <audio> metadata 读出) */
  inputDuration: number | null;
  /** 输出 Blob */
  outputBlob: Blob | null;
  /** 输出预览 URL */
  outputUrl: string | null;
  /** 输出文件名 */
  outputName: string | null;
  /** 处理中 */
  busy: boolean;
  /** 错误信息(含 stub 错误提示) */
  error: string | null;
  /** 处理上传文件 */
  handleFiles: (files: File[]) => Promise<{ skipped: number }>;
  /** 执行 workflow */
  runWorkflow: (workflow: Workflow) => Promise<void>;
  /** 设置输入音频时长(<audio> onLoadedMetadata 回调写入) */
  setInputDuration: (duration: number) => void;
  /** 重置 */
  reset: () => void;
  /** 手动设置输出 */
  setOutput: (blob: Blob, name: string) => void;
}

export function useAudioTool(): UseAudioToolResult {
  const [runtime, setRuntime] = useState<LokvisRuntime | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [inputId, setInputId] = useState<AssetId | null>(null);
  const [inputUrl, setInputUrl] = useState<string | null>(null);
  const [inputName, setInputName] = useState<string | null>(null);
  const [inputSize, setInputSize] = useState<number | null>(null);
  const [inputDuration, setInputDuration] = useState<number | null>(null);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputName, setOutputName] = useState<string | null>(null);
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

  // 初始化 runtime,注入 audioToolsPlugin(浏览器版全 stub,不加载 ffmpeg.wasm)
  useEffect(() => {
    let rt: LokvisRuntime | undefined;
    let cancelled = false;
    (async () => {
      try {
        rt = await createLokvis({ plugins: [audioToolsPlugin()] });
        if (cancelled) {
          void rt.cancel('all');
          return;
        }
        setRuntime(rt);
      } catch (err) {
        if (!cancelled) {
          setInitError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
      void rt?.cancel('all');
    };
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
        setInputName(file.name);
        setInputSize(file.size);
        setInputDuration(null);
        setOutputBlob(null);
        setOutputName(null);
        setError(null);
        return { skipped };
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return { skipped };
      }
    },
    [runtime, revokeInputUrl]
  );

  const runWorkflow = useCallback(
    async (workflow: Workflow): Promise<void> => {
      if (!runtime || !inputId) return;
      setBusy(true);
      setError(null);
      try {
        const result = await runtime.run(workflow, [inputId]);
        if (result.status === 'completed' && result.outputs[0]) {
          const blob = await runtime.exportAsset(result.outputs[0]);
          const defaultName = `audio-output-${Date.now()}.mp3`;
          setOutputBlob(blob);
          setOutputName(defaultName);
        } else {
          setError(result.error ?? '处理失败');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [runtime, inputId]
  );

  const setOutput = useCallback((blob: Blob, name: string) => {
    setOutputBlob(blob);
    setOutputName(name);
  }, []);

  const reset = useCallback(() => {
    revokeInputUrl();
    setInputId(null);
    setInputUrl(null);
    setInputName(null);
    setInputSize(null);
    setInputDuration(null);
    setOutputBlob(null);
    setOutputName(null);
    setError(null);
  }, [revokeInputUrl]);

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
    ready: runtime !== null,
    initError,
    inputId,
    inputUrl,
    inputName,
    inputSize,
    inputDuration,
    outputBlob,
    outputUrl,
    outputName,
    busy,
    error,
    handleFiles,
    runWorkflow,
    setInputDuration,
    reset,
    setOutput,
  };
}
