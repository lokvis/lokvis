/**
 * PDF Tools Plugin — Node/Web 共享实现(基于 pdf-lib 引擎)
 *
 * node-plugin.ts 与 web-plugin.ts 的实现此前 ~95% 重复,仅环境文案不同。
 * 本模块抽取共享骨架:8 个 capability 绑定(6 真实 + 2 stub)、PDF 页数
 * MetadataReader、info 日志,均由 buildRealPdfPlugin(options) 一次性构造。
 * node/web 仅传入环境相关文案(stub 错误短语 + 日志引擎描述)。
 *
 * 与默认入口 `pdfToolsPlugin()`(全 stub、engine-free)的区别:
 * 本模块 import `@lokvis/engine-pdf`,故仅供 `/node`、`/web` 子路径使用,
 * 不进入默认入口 bundle(浏览器默认省 ~300KB 首屏)。
 */
import {
  createBlobCapabilityImpl,
  createMergeCapabilityImpl,
  createSplitCapabilityImpl,
  definePlugin,
} from '@lokvis/plugin-sdk';
import { PDF_CAPABILITIES } from '@lokvis/capability';
import type { AssetType, PdfInfo } from '@lokvis/schema';
import { METADATA_READER_NAMES } from '@lokvis/schema';
import {
  mergePdfs as opMergePdfs,
  splitPdf as opSplitPdf,
  compressPdf as opCompressPdf,
  rotatePdf as opRotatePdf,
  addWatermark as opAddWatermark,
  addPageNumbers as opAddPageNumbers,
  getPdfInfo,
  PDF_ENGINE,
} from '@lokvis/engine-pdf';
import { PLUGIN_NAME, PLUGIN_VERSION } from './plugin.js';
import { derivePdfMetadata } from './operations.js';

/** 引擎名(单一来源:engine-pdf 的 PDF_ENGINE 描述符,Node/Web 一致) */
export const PLUGIN_ENGINE_PDF = PDF_ENGINE.name;

/** engine 级 stub 状态单点推导(AGENTS.md 约定:version 含 'stub') */
const ENGINE_IS_STUB = PDF_ENGINE.version.includes('stub');

/** 元数据读取器名称(单一来源:@lokvis/schema METADATA_READER_NAMES) */
export const PDF_INFO_READER_NAME = METADATA_READER_NAMES.pdfInfo;

/**
 * 真实实现下未实装的操作集合(按能力叠加标记为 stub)。
 *
 * pdf-lib 引擎本身为真实实现(ENGINE_IS_STUB=false),但 ocr/sign 尚未实装,
 * 故最终 isStub = ENGINE_IS_STUB || REAL_STUB_CAPABILITIES.has(capability)。
 */
export const REAL_STUB_CAPABILITIES = new Set<string>(['pdf.ocr', 'pdf.sign']);

/** 单个能力的最终 stub 状态:engine 级 stub 或按能力标记的未实装 */
function resolvePdfStub(capability: string): boolean {
  return ENGINE_IS_STUB || REAL_STUB_CAPABILITIES.has(capability);
}

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

/** 真实操作绑定项(operation → kind + outputType 映射) */
interface RealPdfEntry {
  capability: string;
  kind: 'single' | 'merge' | 'split';
  outputType: AssetType;
  operation: SinglePdfOperation | MergePdfOperation | SplitPdfOperation;
  isStub: boolean;
}

/** buildRealPdfPlugin 的环境相关文案 */
export interface RealPdfPluginOptions {
  /** stub 错误消息中的环境短语,如 "Node environment" / "browser environment" */
  environmentPhrase: string;
  /** 日志中的引擎描述,如 "pdf-lib engine" / "pdf-lib engine, browser" */
  logEngineDesc: string;
}

/** stub 错误消息(统一格式,环境短语参数化) */
function unsupportedMessage(capability: string, environmentPhrase: string): string {
  return (
    `Operation "${capability}" is not supported by the pdf-lib engine in ${environmentPhrase}. ` +
    `Supported operations: merge, split, compress, rotate, watermark, add-page-numbers. ` +
    `Future operations: ocr (Phase 3), sign (Phase 4).`
  );
}

/** 构造 single(1→1)形态的 stub 操作(永远抛错,isStub=true 让 registry 跳过) */
function createUnsupportedSingleOp(
  capability: string,
  environmentPhrase: string
): SinglePdfOperation {
  return async (_blob, _params, signal) => {
    if (signal?.aborted) {
      throw new DOMException('Operation aborted', 'AbortError');
    }
    throw new Error(unsupportedMessage(capability, environmentPhrase));
  };
}

/** 8 个真实/桩操作绑定项(6 真实 + 2 stub) */
function realPdfEntries(environmentPhrase: string): RealPdfEntry[] {
  return [
    { capability: 'pdf.merge', kind: 'merge', outputType: 'pdf', operation: opMergePdfs as MergePdfOperation, isStub: resolvePdfStub('pdf.merge') },
    { capability: 'pdf.split', kind: 'split', outputType: 'data', operation: opSplitPdf as SplitPdfOperation, isStub: resolvePdfStub('pdf.split') },
    { capability: 'pdf.compress', kind: 'single', outputType: 'pdf', operation: opCompressPdf as SinglePdfOperation, isStub: resolvePdfStub('pdf.compress') },
    { capability: 'pdf.rotate', kind: 'single', outputType: 'pdf', operation: opRotatePdf as SinglePdfOperation, isStub: resolvePdfStub('pdf.rotate') },
    { capability: 'pdf.watermark', kind: 'single', outputType: 'pdf', operation: opAddWatermark as SinglePdfOperation, isStub: resolvePdfStub('pdf.watermark') },
    { capability: 'pdf.add-page-numbers', kind: 'single', outputType: 'pdf', operation: opAddPageNumbers as SinglePdfOperation, isStub: resolvePdfStub('pdf.add-page-numbers') },
    { capability: 'pdf.ocr', kind: 'single', outputType: 'text', operation: createUnsupportedSingleOp('pdf.ocr', environmentPhrase), isStub: resolvePdfStub('pdf.ocr') },
    { capability: 'pdf.sign', kind: 'single', outputType: 'pdf', operation: createUnsupportedSingleOp('pdf.sign', environmentPhrase), isStub: resolvePdfStub('pdf.sign') },
  ];
}

/**
 * 构造真实 PDF 工具插件(Node/Web 共享)。
 *
 * 6 真实(merge/split/compress/rotate/watermark/add-page-numbers)+ 2 stub
 * (ocr/sign),共 8 个 capability 实现 + PDF 页数 MetadataReader。
 */
export function buildRealPdfPlugin(options: RealPdfPluginOptions) {
  const { environmentPhrase, logEngineDesc } = options;
  return definePlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description:
        'Official PDF tools (pdf-lib): merge / split / compress / rotate / watermark / add-page-numbers + stub(ocr/sign)',
      capabilities: PDF_CAPABILITIES,
      engine: PLUGIN_ENGINE_PDF,
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      const impls = realPdfEntries(environmentPhrase).map((entry) => {
        const derive = derivePdfMetadata(entry.outputType);
        switch (entry.kind) {
          case 'merge':
            return createMergeCapabilityImpl(
              {
                capability: entry.capability,
                engine: PLUGIN_ENGINE_PDF,
                outputType: entry.outputType,
                operation: entry.operation as MergePdfOperation,
                isStub: entry.isStub,
                deriveMetadata: derive,
              },
              ctx
            );
          case 'split':
            return createSplitCapabilityImpl(
              {
                capability: entry.capability,
                engine: PLUGIN_ENGINE_PDF,
                outputType: entry.outputType,
                operation: entry.operation as SplitPdfOperation,
                isStub: entry.isStub,
                deriveMetadata: derive,
              },
              ctx
            );
          case 'single':
            return createBlobCapabilityImpl(
              {
                capability: entry.capability,
                engine: PLUGIN_ENGINE_PDF,
                outputType: entry.outputType,
                operation: entry.operation as SinglePdfOperation,
                isStub: entry.isStub,
                // PDF 变换不读 source,丢弃 source 只传 outBlob
                deriveMetadata: (_source, outBlob) => derive(outBlob),
              },
              ctx
            );
        }
      });

      for (const impl of impls) {
        ctx.registerCapability(impl);
      }

      // PDF 页数查询 reader(供 mcp-server 报告处理结果页数)。
      // 内部调 engine-pdf 的 getPdfInfo,走 MetadataReader 机制避免上层直接依赖 engine-pdf。
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

      const realCount = impls.length - REAL_STUB_CAPABILITIES.size;
      ctx.log(
        'info',
        `Registered ${impls.length} pdf capabilities (${logEngineDesc}, ` +
          `${realCount} real + ${REAL_STUB_CAPABILITIES.size} stub) + pdf info reader`
      );
    }
  );
}
