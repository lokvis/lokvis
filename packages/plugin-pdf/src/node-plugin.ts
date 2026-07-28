/**
 * PDF Tools Plugin — Node 环境版本(基于 pdf-lib 引擎)
 *
 * 与浏览器版本 `pdfToolsPlugin()` 的区别:
 * - 浏览器版所有 capability 标记为 stub,运行时抛错(不加载 pdf-lib)
 * - Node 版直接绑定 `@lokvis/engine-pdf` 的独立 Blob↔Blob 操作
 *   (mergePdfs / splitPdf / compressPdf / rotatePdf / addWatermark /
 *    addPageNumbers,基于 pdf-lib),6 个真实能力 + 2 个 stub(ocr / sign)
 *
 * 6 个真实操作:
 * - pdf.merge(N→1):mergePdfs(Blob[] → Blob)
 * - pdf.split(1→N):splitPdf(Blob → Blob[])
 * - pdf.compress(1→1):compressPdf(Blob → Blob)
 * - pdf.rotate(1→1):rotatePdf(Blob → Blob)
 * - pdf.watermark(1→1):addWatermark(Blob → Blob)
 * - pdf.add-page-numbers(1→1):addPageNumbers(Blob → Blob)
 *
 * 2 个 stub 操作(暂未实装):
 * - pdf.ocr(1→1):依赖 tesseract.js,留 Phase 3
 * - pdf.sign(1→1):合规风险,留 Phase 4 企业版
 *
 * 用途:
 * - MCP Server(Node 端 pdf tool 实际执行器)
 * - 让 mcp-server 的 pdf tool 经 runtime.run() 走完整 capability 系统
 *   (与 image tool 模式一致,见 TD-1.1 长期方案)
 *
 * 通过子路径 `@lokvis/plugin-pdf/node` 导出,与 plugin-image/node 模式一致,
 * 避免浏览器构建误加载 pdf-lib 的 Node 端实现:
 *   import { pdfToolsPluginNode } from '@lokvis/plugin-pdf/node';
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
  addPageNumbers as opAddPageNumbers,
  getPdfInfo,
} from '@lokvis/engine-pdf';
import { PLUGIN_NAME, PLUGIN_VERSION } from './plugin.js';

/** Node 引擎名(底层仍是 pdf-lib,与浏览器版一致) */
export const PLUGIN_ENGINE_NODE = 'pdf-lib' as const;

/** 元数据读取器名称(PDF 页数查询,走 MetadataReader 机制) */
export const PDF_INFO_READER_NAME = 'pdf.read-info';

/** Node 环境下未实现的操作集合(标记为 stub) */
const NODE_STUB_CAPABILITIES = new Set<string>([
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
    `Operation "${capability}" is not supported by the pdf-lib engine in Node environment. ` +
    `Supported operations: merge, split, compress, rotate, watermark, add-page-numbers. ` +
    `Future operations: ocr (Phase 3), sign (Phase 4).`
  );
}

/**
 * 构造 single(1→1)形态的 stub 操作。
 *
 * stub 函数永远抛错(给出明确的 capability 名 + 支持列表),
 * 但同时 isStub=true 让 CapabilityRegistry 自动跳过,executor 优先
 * 选择非 stub 实现。当仅有 stub 实现可用时,executor 会调用本函数并抛出此错误。
 */
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
 * 创建 PDF 工具插件(Node 环境,基于 pdf-lib 引擎)
 *
 * 6 真实(merge/split/compress/rotate/watermark/add-page-numbers)+ 2 stub
 * (ocr/sign),共 8 个 capability 实现。
 *
 * @example
 * ```ts
 * import { createLokvis } from '@lokvis/sdk';
 * import { pdfToolsPluginNode } from '@lokvis/plugin-pdf/node';
 *
 * const lokvis = await createLokvis({
 *   plugins: [await pdfToolsPluginNode()],
 * });
 * ```
 *
 * 注:本函数为 async,与 imageToolsPluginNode 对齐,保留未来引擎初始化
 * (如 pdf-lib 字体预加载)的扩展点。
 */
export async function pdfToolsPluginNode() {
  return definePlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description:
        'Official PDF tools (Node, pdf-lib): merge / split / compress / rotate / watermark / add-page-numbers + stub(ocr/sign)',
      capabilities: PDF_CAPABILITIES,
      engine: PLUGIN_ENGINE_NODE,
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      // 8 个能力实现:6 真实 + 2 stub
      const impls = [
        // ─── 真实操作 ────────────────────────────────────
        // pdf.merge: N→1,用 createMergeCapabilityImpl + mergePdfs
        createMergeCapabilityImpl(
          {
            capability: 'pdf.merge',
            engine: PLUGIN_ENGINE_NODE,
            outputType: 'pdf' as AssetType,
            operation: opMergePdfs as MergePdfOperation,
            isStub: false,
            deriveMetadata: derivePdfMetadata,
          },
          ctx
        ),
        // pdf.split: 1→N,用 createSplitCapabilityImpl + splitPdf
        createSplitCapabilityImpl(
          {
            capability: 'pdf.split',
            engine: PLUGIN_ENGINE_NODE,
            outputType: 'data' as AssetType,
            operation: opSplitPdf as SplitPdfOperation,
            isStub: false,
            deriveMetadata: deriveSplitPdfMetadata,
          },
          ctx
        ),
        // pdf.compress: 1→1,用 createBlobCapabilityImpl + compressPdf
        createBlobCapabilityImpl(
          {
            capability: 'pdf.compress',
            engine: PLUGIN_ENGINE_NODE,
            outputType: 'pdf' as AssetType,
            operation: opCompressPdf as SinglePdfOperation,
            isStub: false,
            // PDF 变换不传播 source dimensions,丢弃 source 只传 outBlob
            deriveMetadata: (_source, outBlob) => derivePdfMetadata(outBlob),
          },
          ctx
        ),
        // pdf.rotate: 1→1,用 createBlobCapabilityImpl + rotatePdf
        createBlobCapabilityImpl(
          {
            capability: 'pdf.rotate',
            engine: PLUGIN_ENGINE_NODE,
            outputType: 'pdf' as AssetType,
            operation: opRotatePdf as SinglePdfOperation,
            isStub: false,
            deriveMetadata: (_source, outBlob) => derivePdfMetadata(outBlob),
          },
          ctx
        ),
        // pdf.watermark: 1→1,用 createBlobCapabilityImpl + addWatermark
        createBlobCapabilityImpl(
          {
            capability: 'pdf.watermark',
            engine: PLUGIN_ENGINE_NODE,
            outputType: 'pdf' as AssetType,
            operation: opAddWatermark as SinglePdfOperation,
            isStub: false,
            deriveMetadata: (_source, outBlob) => derivePdfMetadata(outBlob),
          },
          ctx
        ),
        // pdf.add-page-numbers: 1→1,用 createBlobCapabilityImpl + addPageNumbers
        createBlobCapabilityImpl(
          {
            capability: 'pdf.add-page-numbers',
            engine: PLUGIN_ENGINE_NODE,
            outputType: 'pdf' as AssetType,
            operation: opAddPageNumbers as SinglePdfOperation,
            isStub: false,
            deriveMetadata: (_source, outBlob) => derivePdfMetadata(outBlob),
          },
          ctx
        ),

        // ─── stub 操作 ────────────────────────────────────
        // pdf.ocr: 1→1,outputType='text'(依赖 tesseract.js,留 Phase 3)
        createBlobCapabilityImpl(
          {
            capability: 'pdf.ocr',
            engine: PLUGIN_ENGINE_NODE,
            outputType: 'text' as AssetType,
            operation: createUnsupportedSingleOp('pdf.ocr'),
            isStub: true,
            deriveMetadata: (_source, outBlob) => deriveOcrPdfMetadata(outBlob),
          },
          ctx
        ),
        // pdf.sign: 1→1,outputType='pdf'(合规风险,留 Phase 4 企业版)
        createBlobCapabilityImpl(
          {
            capability: 'pdf.sign',
            engine: PLUGIN_ENGINE_NODE,
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

      // PDF 页数查询 reader(供 mcp-server 报告处理结果页数)。
      // 内部调 engine-pdf 的 getPdfInfo(pdf-lib getPageCount),
      // 走 MetadataReader 机制避免上层(mcp-server)直接依赖 engine-pdf。
      ctx.registerMetadataReader<PdfInfo>(
        PDF_INFO_READER_NAME,
        async (asset, readerCtx) => {
          const blob = await ctx.runtime.getAssetBlob(asset);
          try {
            return await getPdfInfo(blob);
          } catch (err) {
            // 解析失败与"无数据"区分:warn 上报,返回 null 不影响主流程
            readerCtx.log('warn', `getPdfInfo failed: ${err instanceof Error ? err.message : String(err)}`);
            return null;
          }
        }
      );

      ctx.log(
        'info',
        `Registered ${impls.length} pdf capabilities (pdf-lib engine, ` +
          `${impls.length - NODE_STUB_CAPABILITIES.size} real + ${NODE_STUB_CAPABILITIES.size} stub) + pdf info reader`
      );
    }
  );
}
