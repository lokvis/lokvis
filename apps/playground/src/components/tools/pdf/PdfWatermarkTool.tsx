/**
 * PDF Watermark 工具页
 *
 * 导入 PDF → 输入水印文字 + 颜色 + 不透明度 → 调用 pdf.watermark capability
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

export default function PdfWatermarkTool() {
  return (
    <ErrorBoundary>
      <PdfWatermarkToolContent />
    </ErrorBoundary>
  );
}

function PdfWatermarkToolContent() {
  const lang = useLang();
  const t = useTranslations(lang);
  const tool = usePdfTool();
  const [text, setText] = useState('CONFIDENTIAL');
  const [color, setColor] = useState('#888888');
  const [opacity, setOpacity] = useState(30); // 0-100
  const [fontSize, setFontSize] = useState(48);

  const handleWatermark = useCallback(async () => {
    if (!text.trim()) return;
    const wf = buildSingleStepPdfWorkflow(
      'pdf.watermark',
      {
        text: text.trim(),
        color,
        opacity: opacity / 100, // 0-1
        fontSize,
      },
      'PdfWatermark',
      'pdf',
      'Add text watermark to PDF'
    );
    await tool.runWorkflow(wf);
  }, [tool, text, color, opacity, fontSize]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">{t('pdfWatermark.title')}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{t('pdfWatermark.subtitle')}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-12">
          <label className="flex flex-col gap-1 sm:col-span-6">
            <span className="text-[10px] font-medium text-zinc-500">{t('pdfWatermark.text')}</span>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-3">
            <span className="text-[10px] font-medium text-zinc-500">{t('pdfWatermark.color')}</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-7 w-full rounded border border-zinc-700 bg-zinc-950"
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-3">
            <span className="flex items-center justify-between text-[10px] font-medium text-zinc-500">
              <span>{t('pdfWatermark.fontSize')}</span>
              <span className="font-mono text-zinc-300">{fontSize}</span>
            </span>
            <input
              type="number"
              min={8}
              max={144}
              value={fontSize}
              onChange={(e) => setFontSize(Math.max(8, Math.min(144, Number(e.target.value))))}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-12">
            <span className="flex items-center justify-between text-[10px] font-medium text-zinc-500">
              <span>{t('pdfWatermark.opacity')}</span>
              <span className="font-mono text-zinc-300">{opacity}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="h-1.5 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-indigo-500"
            />
          </label>
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleWatermark}
            disabled={!tool.ready || !tool.inputId || tool.busy || !text.trim()}
            className="rounded-lg bg-indigo-600 px-24 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tool.busy ? t('pdfWatermark.busy') : t('pdfWatermark.btn')}
          </button>
        </div>

        <PdfToolResultPanel
          tool={tool}
          onFiles={tool.handleFiles}
          uploadHint={t('pdfWatermark.uploadHint')}
          reselectLabel={t('pdfWatermark.reselect')}
          downloadName={() => `watermarked-${Date.now()}.pdf`}
          onReset={tool.reset}
        />
      </div>
    </div>
  );
}
