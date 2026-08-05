/**
 * usePdfTool — PDF 工具页共享 hook(@lokvis/embed-pdf 内部)。
 *
 * FO-17: 经 useEmbedTool 工厂生成,注入 PDF 特有的 probe 函数。
 * 输入 probe 需 runtime.readAssetPdfInfo(走 MetadataReader 依赖反转)。
 */
import { useEmbedTool } from '@lokvis/embed-kit';
import type { PluginLoadEntry, Workflow, WorkflowResult } from '@lokvis/sdk';
import { useLokvisRuntime } from './useLokvisRuntime';
import { getPdfFileInfo, type PdfFileInfo } from './download';

export interface UsePdfToolOptions {
  multiple?: boolean;
  plugins?: PluginLoadEntry[];
}

export interface UsePdfToolResult {
  runtime: ReturnType<typeof useLokvisRuntime>['runtime'];
  ready: boolean;
  initError: string | null;
  inputIds: string[];
  inputUrls: string[];
  inputInfos: PdfFileInfo[];
  outputBlobs: Blob[];
  outputUrls: string[];
  outputInfos: PdfFileInfo[];
  busy: boolean;
  error: string | null;
  handleFiles: (files: File[]) => Promise<void>;
  runWorkflow: (workflow: Workflow) => Promise<void>;
  runWorkflowRaw: (workflow: Workflow) => Promise<WorkflowResult | null>;
  reset: () => void;
  clearError: () => void;
}

export function usePdfTool(options?: UsePdfToolOptions): UsePdfToolResult {
  const { multiple = false, plugins } = options ?? {};
  const { runtime, ...runtimeResult } = useLokvisRuntime(undefined, plugins);

  return useEmbedTool<PdfFileInfo>({
    runtimeResult: { runtime, ...runtimeResult },
    multiple,
    probeFile: async (_file, assetId) => {
      const info = await runtime!.readAssetPdfInfo(assetId);
      return getPdfFileInfo(_file, info?.pages ?? null);
    },
    probeBlob: async (blob, assetId) => {
      const info = await runtime!.readAssetPdfInfo(assetId);
      return getPdfFileInfo(blob, info?.pages ?? null);
    },
  });
}
