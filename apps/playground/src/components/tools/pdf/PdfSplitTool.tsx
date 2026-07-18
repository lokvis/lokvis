/**
 * PDF Split 工具页
 *
 * 导入 PDF → 选择拆分模式(每页一个 / 按页数 / 自定义范围)→ 调用 pdf.split capability
 *
 * 浏览器版 plugin-pdf 为 stub,执行时会抛 "not implemented in stub" 错误。
 * split 为 1→N 形态,UI 仅展示首个输出(runtime 已自动处理多输出)。
 */
import { useCallback, useState } from 'react';
import { usePdfTool } from '@/components/toolkit/usePdfTool';
import { buildSingleStepPdfWorkflow } from '@/components/toolkit/pdf-workflow-builder';
import { PdfToolResultPanel } from '@/components/toolkit/PdfToolResultPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

type SplitMode = 'single' | 'pagesPerFile' | 'ranges';

export default function PdfSplitTool() {
  return (
    <ErrorBoundary>
      <PdfSplitToolContent />
    </ErrorBoundary>
  );
}

function PdfSplitToolContent() {
  const lang = useLang();
  const t = useTranslations(lang);
  const tool = usePdfTool();
  const [mode, setMode] = useState<SplitMode>('single');
  const [pagesPerFile, setPagesPerFile] = useState(1);
  const [ranges, setRanges] = useState('1-3,4-6');

  const handleSplit = useCallback(async () => {
    const params: Record<string, unknown> = {};
    if (mode === 'pagesPerFile') {
      params.pagesPerFile = pagesPerFile;
    } else if (mode === 'ranges') {
      params.ranges = ranges.trim();
    }
    // 'single' 模式无参数(默认每页一个)
    const wf = buildSingleStepPdfWorkflow(
      'pdf.split',
      params,
      'PdfSplit',
      'data',
      'Split PDF into multiple files'
    );
    await tool.runWorkflow(wf);
  }, [tool, mode, pagesPerFile, ranges]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">{t('pdfSplit.title')}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{t('pdfSplit.subtitle')}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-12">
          <label className="flex flex-col gap-1 sm:col-span-4">
            <span className="text-[10px] font-medium text-zinc-500">{t('pdfSplit.mode')}</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as SplitMode)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="single">{t('pdfSplit.modeSingle')}</option>
              <option value="pagesPerFile">{t('pdfSplit.modePagesPerFile')}</option>
              <option value="ranges">{t('pdfSplit.modeRanges')}</option>
            </select>
          </label>
          {mode === 'pagesPerFile' && (
            <label className="flex flex-col gap-1 sm:col-span-4">
              <span className="text-[10px] font-medium text-zinc-500">{t('pdfSplit.pagesPerFile')}</span>
              <input
                type="number"
                min={1}
                value={pagesPerFile}
                onChange={(e) => setPagesPerFile(Math.max(1, Number(e.target.value)))}
                className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
              />
            </label>
          )}
          {mode === 'ranges' && (
            <label className="flex flex-col gap-1 sm:col-span-8">
              <span className="text-[10px] font-medium text-zinc-500">{t('pdfSplit.ranges')}</span>
              <input
                type="text"
                value={ranges}
                onChange={(e) => setRanges(e.target.value)}
                placeholder="1-3,4-6,7"
                className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
              />
              <span className="text-[10px] text-zinc-600">{t('pdfSplit.rangesHint')}</span>
            </label>
          )}
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleSplit}
            disabled={!tool.ready || !tool.inputId || tool.busy}
            className="rounded-lg bg-indigo-600 px-24 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tool.busy ? t('pdfSplit.busy') : t('pdfSplit.btn')}
          </button>
        </div>

        <PdfToolResultPanel
          tool={tool}
          onFiles={tool.handleFiles}
          uploadHint={t('pdfSplit.uploadHint')}
          reselectLabel={t('pdfSplit.reselect')}
          downloadName={() => `split-${Date.now()}.pdf`}
          onReset={tool.reset}
        />
      </div>
    </div>
  );
}
