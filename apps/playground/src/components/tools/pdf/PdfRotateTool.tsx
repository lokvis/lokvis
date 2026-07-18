/**
 * PDF Rotate 工具页
 *
 * 导入 PDF → 选择旋转角度(90/180/270)与页码范围 → 调用 pdf.rotate capability
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

type Angle = 90 | 180 | 270;

export default function PdfRotateTool() {
  return (
    <ErrorBoundary>
      <PdfRotateToolContent />
    </ErrorBoundary>
  );
}

function PdfRotateToolContent() {
  const lang = useLang();
  const t = useTranslations(lang);
  const tool = usePdfTool();
  const [angle, setAngle] = useState<Angle>(90);
  const [pages, setPages] = useState(''); // 空 = 所有页

  const handleRotate = useCallback(async () => {
    const params: Record<string, unknown> = { angle };
    if (pages.trim()) {
      params.pages = pages.trim();
    }
    const wf = buildSingleStepPdfWorkflow(
      'pdf.rotate',
      params,
      'PdfRotate',
      'pdf',
      'Rotate PDF pages by specified angle'
    );
    await tool.runWorkflow(wf);
  }, [tool, angle, pages]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">{t('pdfRotate.title')}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{t('pdfRotate.subtitle')}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-12">
          <label className="flex flex-col gap-1 sm:col-span-3">
            <span className="text-[10px] font-medium text-zinc-500">{t('pdfRotate.angle')}</span>
            <select
              value={angle}
              onChange={(e) => setAngle(Number(e.target.value) as Angle)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value={90}>90°</option>
              <option value={180}>180°</option>
              <option value={270}>270°</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 sm:col-span-6">
            <span className="text-[10px] font-medium text-zinc-500">{t('pdfRotate.pages')}</span>
            <input
              type="text"
              value={pages}
              onChange={(e) => setPages(e.target.value)}
              placeholder={t('pdfRotate.pagesPlaceholder')}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
            <span className="text-[10px] text-zinc-600">{t('pdfRotate.pagesHint')}</span>
          </label>
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleRotate}
            disabled={!tool.ready || !tool.inputId || tool.busy}
            className="rounded-lg bg-indigo-600 px-24 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tool.busy ? t('pdfRotate.busy') : t('pdfRotate.btn')}
          </button>
        </div>

        <PdfToolResultPanel
          tool={tool}
          onFiles={tool.handleFiles}
          uploadHint={t('pdfRotate.uploadHint')}
          reselectLabel={t('pdfRotate.reselect')}
          downloadName={() => `rotated-${Date.now()}.pdf`}
          onReset={tool.reset}
        />
      </div>
    </div>
  );
}
