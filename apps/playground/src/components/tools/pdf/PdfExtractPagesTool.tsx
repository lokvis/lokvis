/**
 * PDF Extract Pages 工具页
 *
 * 导入 PDF → 输入要提取的页码范围(如 "1-3,5,7-9")→ 调用 pdf.split capability
 *
 * 实质上 extract-pages 是 pdf.split 的 ranges 模式特化版本,这里独立成工具页
 * 是为了用户场景区分:"split" 偏向均等拆分,"extract" 偏向按需挑选页。
 * capability 复用 pdf.split(1→N),UI 展示首个输出。
 *
 * 浏览器版 plugin-pdf 为 stub,执行时会抛 "not implemented in stub" 错误。
 */
import { useCallback, useState } from 'react';
import { usePdfTool } from '@/components/toolkit/usePdfTool';
import { buildSingleStepPdfWorkflow } from '@/components/toolkit/pdf-workflow-builder';
import { PdfToolResultPanel } from '@/components/toolkit/PdfToolResultPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

export default function PdfExtractPagesTool() {
  return (
    <ErrorBoundary>
      <PdfExtractPagesToolContent />
    </ErrorBoundary>
  );
}

function PdfExtractPagesToolContent() {
  const lang = useLang();
  const t = useTranslations(lang);
  const tool = usePdfTool();
  const [ranges, setRanges] = useState('1-3,5,7-9');

  const handleExtract = useCallback(async () => {
    const trimmed = ranges.trim();
    if (!trimmed) return;
    // extract-pages 复用 pdf.split capability 的 ranges 模式
    const wf = buildSingleStepPdfWorkflow(
      'pdf.split',
      { ranges: trimmed },
      'PdfExtractPages',
      'data',
      'Extract specific pages from PDF'
    );
    await tool.runWorkflow(wf);
  }, [tool, ranges]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">{t('pdfExtractPages.title')}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{t('pdfExtractPages.subtitle')}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-12">
          <label className="flex flex-col gap-1 sm:col-span-12">
            <span className="text-[10px] font-medium text-zinc-500">{t('pdfExtractPages.ranges')}</span>
            <input
              type="text"
              value={ranges}
              onChange={(e) => setRanges(e.target.value)}
              placeholder="1-3,5,7-9"
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
            <span className="text-[10px] text-zinc-600">{t('pdfExtractPages.rangesHint')}</span>
          </label>
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleExtract}
            disabled={!tool.ready || !tool.inputId || tool.busy || !ranges.trim()}
            className="rounded-lg bg-indigo-600 px-24 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tool.busy ? t('pdfExtractPages.busy') : t('pdfExtractPages.btn')}
          </button>
        </div>

        <PdfToolResultPanel
          tool={tool}
          onFiles={tool.handleFiles}
          uploadHint={t('pdfExtractPages.uploadHint')}
          reselectLabel={t('pdfExtractPages.reselect')}
          downloadName={() => `extracted-${Date.now()}.pdf`}
          onReset={tool.reset}
        />
      </div>
    </div>
  );
}
