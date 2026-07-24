/**
 * PDF Tools Plugin — 浏览器环境版本(基于 pdf-lib 引擎)
 *
 * 与默认入口 `pdfToolsPlugin()`(全 stub)的区别:
 * - 默认入口所有 capability 标记为 stub,不加载 pdf-lib(省 ~300KB 首屏)
 * - Web 版直接绑定 `@lokvis/engine-pdf` 的 Blob↔Blob 操作(5 真实 + 2 stub)
 *
 * pdf-lib 经 engine-pdf 内部 `await import('pdf-lib')` 动态加载,
 * 不会进入消费方首屏 bundle——仅在用户实际触发 PDF 处理时按需拉取。
 *
 * 5 个真实操作:
 * - pdf.merge(N→1):mergePdfs(Blob[] → Blob)
 * - pdf.split(1→N):splitPdf(Blob → Blob[])
 * - pdf.compress(1→1):compressPdf(Blob → Blob)
 * - pdf.rotate(1→1):rotatePdf(Blob → Blob)
 * - pdf.watermark(1→1):addWatermark(Blob → Blob)
 *
 * 2 个 stub 操作(暂未实装):
 * - pdf.ocr(1→1):依赖 tesseract.js,留 Phase 3
 * - pdf.sign(1→1):合规风险,留 Phase 4 企业版
 *
 * 用途:
 * - @lokvis/embed-pdf 的 hooks 内部使用(浏览器端 PDF 处理)
 * - 任何需要在浏览器端运行真实 PDF 操作的消费方
 *
 * 通过子路径 `@lokvis/plugin-pdf/web` 导出:
 *   import { pdfToolsPluginWeb } from '@lokvis/plugin-pdf/web';
 */
import {
  createBlobCapabilityImpl,
  createMergeCapabilityImpl,
  createSplitCapabilityImpl,
  definePlugin,
} from '@lokvis/plugin-sdk';
import { PDF_CAPABILITIES } from '@lokvis/capability';
import type {
  AssetMetadata,
  AssetType,
  PdfInfo,
} from '@lokvis/schema';
import {
  mergePdfs as opMergePdfs,
  splitPdf as opSplitPdf,
  compressPdf as opCompressPdf,
  rotatePdf as opRotatePdf,
  addWatermark as opAddWatermark,
  getPdfInfo,
} from '@lokvis/engine-pdf';
import { PLUGIN_NAME, PLUGIN_VERSION } from './plugin.js';

/** Web 引擎名(底层是 pdf-lib,与 Node 版一致) */
export const PLUGIN_ENGINE_WEB = 'pdf-lib' as const;

/** 元数据读取器名称(PDF 页数查询) */
export const PDF_INFO_READER_NAME = 'pdf.read-info';

/** 浏览器环境下未实现的操作集合(标记为 stub) */
const WEB_STUB_CAPABILITIES = new Set<string>([
  'pdf.ocr',
  'pdf.sign',
]);

/** single 形态的 Blob→Blob 操作签名 */
type SinglePdfOperation = (
  blob: Blob,
  params: Record<string, unknown>,
  signal?: AbortSignal
) => Promise<Blob>;

/** merge 形态的 Blob[]→Blob 操作签名 */
type MergePdfOperation = (
  blobs: Blob[],
  params: Record<string, unknown>
) => Promise<Blob>;

/** split 形态的 Blob→Blob[] 操作签名 */
type SplitPdfOperation = (
  blob: Blob,
  params: Record<string, unknown>
) => Promise<Blob[]>;

/** stub 错误消息(统一格式) */
function unsupportedMessage(capability: string): string {
  return (
    `Operation "${capability}" is not supported by the pdf-lib engine in browser environment. ` +
    `Supported operations: merge, split, compress, rotate, watermark. ` +
    `Future operations: ocr (Phase 3), sign (Phase 4).`
  );
}

/** 构造 single(1→1)形态的 stub 操作 */
function createUnsupportedSingleOp(capability: string): SinglePdfOperation {
  return async (_blob, _params, signal) => {
    if (signal?.aborted) {
      throw new DOMException('Operation aborted', 'AbortError');
    }
    throw new Error(unsupportedMessage(capability));
  };
}

/** 从输出 Blob 派生 PDF Asset 元数据 */
function derivePdfMetadata(outBlob: Blob): AssetMetadata {
  const mimeType = outBlob.type || 'application/pdf';
  const format = mimeType.split('/')[1] ?? 'pdf';
  return { mimeType, size: outBlob.size, format };
}

/** split 形态的 deriveMetadata(outputType='data') */
function deriveSplitPdfMetadata(outBlob: Blob): AssetMetadata {
  const mimeType = outBlob.type || 'application/octet-stream';
  const format = mimeType.split('/')[1] ?? 'bin';
  return { mimeType, size: outBlob.size, format };
}

/** ocr 形态的 deriveMetadata(outputType='text') */
function deriveOcrPdfMetadata(outBlob: Blob): AssetMetadata {
  const mimeType = outBlob.type || 'text/plain';
  const format = mimeType.split('/')[1] ?? 'txt';
  return { mimeType, size: outBlob.size, format };
}

/**
 * 创建 PDF 工具插件(浏览器环境,基于 pdf-lib 引擎)
 *
 * 5 真实(merge/split/compress/rotate/watermark)+ 2 stub(ocr/sign),
 * 共 7 个 capability 实现。pdf-lib 按需动态加载,不影响首屏。
 *
 * @example
 * ```ts
 * import { createLokvis } from '@lokvis/sdk';
 * import { pdfToolsPluginWeb } from '@lokvis/plugin-pdf/web';
 *
 * const lokvis = await createLokvis({
 *   plugins: [pdfToolsPluginWeb()],
 * });
 * ```
 */
export function pdfToolsPluginWeb() {
  return definePlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description:
        'Official PDF tools (browser, pdf-lib): merge / split / compress / rotate / watermark + stub(ocr/sign)',
      capabilities: PDF_CAPABILITIES,
      engine: PLUGIN_ENGINE_WEB,
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      const impls = [
        // ─── 真实操作 ────────────────────────────────────
        createMergeCapabilityImpl(
          {
            capability: 'pdf.merge',
            engine: PLUGIN_ENGINE_WEB,
            outputType: 'pdf' as AssetType,
            operation: opMergePdfs as MergePdfOperation,
            isStub: false,
            deriveMetadata: derivePdfMetadata,
          },
          ctx
        ),
        createSplitCapabilityImpl(
          {
            capability: 'pdf.split',
            engine: PLUGIN_ENGINE_WEB,
            outputType: 'data' as AssetType,
            operation: opSplitPdf as SplitPdfOperation,
            isStub: false,
            deriveMetadata: deriveSplitPdfMetadata,
          },
          ctx
        ),
        createBlobCapabilityImpl(
          {
            capability: 'pdf.compress',
            engine: PLUGIN_ENGINE_WEB,
            outputType: 'pdf' as AssetType,
            operation: opCompressPdf as SinglePdfOperation,
            isStub: false,
            deriveMetadata: (_source, outBlob) => derivePdfMetadata(outBlob),
          },
          ctx
        ),
        createBlobCapabilityImpl(
          {
            capability: 'pdf.rotate',
            engine: PLUGIN_ENGINE_WEB,
            outputType: 'pdf' as AssetType,
            operation: opRotatePdf as SinglePdfOperation,
            isStub: false,
            deriveMetadata: (_source, outBlob) => derivePdfMetadata(outBlob),
          },
          ctx
        ),
        createBlobCapabilityImpl(
          {
            capability: 'pdf.watermark',
            engine: PLUGIN_ENGINE_WEB,
            outputType: 'pdf' as AssetType,
            operation: opAddWatermark as SinglePdfOperation,
            isStub: false,
            deriveMetadata: (_source, outBlob) => derivePdfMetadata(outBlob),
          },
          ctx
        ),

        // ─── stub 操作 ────────────────────────────────────
        createBlobCapabilityImpl(
          {
            capability: 'pdf.ocr',
            engine: PLUGIN_ENGINE_WEB,
            outputType: 'text' as AssetType,
            operation: createUnsupportedSingleOp('pdf.ocr'),
            isStub: true,
            deriveMetadata: (_source, outBlob) => deriveOcrPdfMetadata(outBlob),
          },
          ctx
        ),
        createBlobCapabilityImpl(
          {
            capability: 'pdf.sign',
            engine: PLUGIN_ENGINE_WEB,
            outputType: 'pdf' as AssetType,
            operation: createUnsupportedSingleOp('pdf.sign'),
            isStub: true,
            deriveMetadata: (_source, outBlob) => derivePdfMetadata(outBlob),
          },
          ctx
        ),
      ];

      for (const impl of impls) {
        ctx.registerCapability(impl);
      }

      // PDF 页数查询 reader
      ctx.registerMetadataReader<PdfInfo>(
        PDF_INFO_READER_NAME,
        async (asset, readerCtx) => {
          const blob = await ctx.runtime.getAssetBlob(asset);
          try {
            return await getPdfInfo(blob);
          } catch (err) {
            readerCtx.log('warn', `getPdfInfo failed: ${err instanceof Error ? err.message : String(err)}`);
            return null;
          }
        }
      );

      ctx.log(
        'info',
        `Registered ${impls.length} pdf capabilities (pdf-lib engine, browser, ` +
          `${impls.length - WEB_STUB_CAPABILITIES.size} real + ${WEB_STUB_CAPABILITIES.size} stub) + pdf info reader`
      );
    }
  );
}
