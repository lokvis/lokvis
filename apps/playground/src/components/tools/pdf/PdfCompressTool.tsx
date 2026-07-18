/**
 * PDF Compress 工具页
 *
 * 导入 PDF → 选择压缩级别(1-9)→ 调用 pdf.compress capability
 *
 * 浏览器版 plugin-pdf 为 stub,执行时会抛 "not implemented in stub" 错误,
 * UI 通过 PdfToolResultPanel 显示明确提示(引导用户使用 Node 端 mcp-server)。
 */
import { useCallback, useState } from 'react';
import { usePdfTool } from '@/components/toolkit/usePdfTool';
import { buildSingleStepPdfWorkflow } from '@/components/toolkit/pdf-workflow-builder';
import { PdfToolResultPanel } from '@/components/toolkit/PdfToolResultPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

export default function PdfCompressTool() {
  return (
    <ErrorBoundary>
      <PdfCompressToolContent />
    </ErrorBoundary>
  );
}

function PdfCompressToolContent() {
  const lang = useLang();
  const t = useTranslations(lang);
  const tool = usePdfTool();
  const [level, setLevel] = useState(6);

  const handleCompress = useCallback(async () => {
    const wf = buildSingleStepPdfWorkflow(
      'pdf.compress',
      { level },
      'PdfCompress',
      'pdf',
      'Compress PDF with specified level'
    );
    await tool.runWorkflow(wf);
  }, [tool, level]);

  const handleReset = () => {
    tool.reset();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">{t('pdfCompress.title')}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{t('pdfCompress.subtitle')}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-12">
          <label className="flex flex-col gap-1 sm:col-span-6">
            <span className="flex items-center justify-between text-[10px] font-medium text-zinc-500">
              <span>{t('pdfCompress.level')}</span>
              <span className="font-mono text-zinc-300">{level}</span>
            </span>
            <input
              type="range"
              min={1}
              max={9}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="h-1.5 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-indigo-500"
            />
            <span className="text-[10px] text-zinc-600">{t('pdfCompress.levelHint')}</span>
          </label>
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleCompress}
            disabled={!tool.ready || !tool.inputId || tool.busy}
            className="rounded-lg bg-indigo-600 px-24 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tool.busy ? t('pdfCompress.busy') : t('pdfCompress.btn')}
          </button>
        </div>

        <PdfToolResultPanel
          tool={tool}
          onFiles={tool.handleFiles}
          uploadHint={t('pdfCompress.uploadHint')}
          reselectLabel={t('pdfCompress.reselect')}
          downloadName={() => `compressed-${Date.now()}.pdf`}
          onReset={handleReset}
        />
      </div>
    </div>
  );
}
