/**
 * PDF Merge 工具页
 *
 * 导入多个 PDF → 调用 pdf.merge capability(N→1)→ 输出合并后的 PDF
 *
 * 浏览器版 plugin-pdf 为 stub,执行时会抛 "not implemented in stub" 错误。
 * 注:当前 playground UI 只支持单输入预览(usePdfTool 单 inputId),
 *    merge 需要多文件上传,Phase 3 将集成 BatchQueue。
 *    本工具页先实装为"占位"模式:展示概念但提示需 Node 端运行。
 */
import { useCallback, useState } from 'react';
import { usePdfTool } from '@/components/toolkit/usePdfTool';
import { buildMergePdfWorkflow } from '@/components/toolkit/pdf-workflow-builder';
import { PdfToolResultPanel } from '@/components/toolkit/PdfToolResultPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

export default function PdfMergeTool() {
  return (
    <ErrorBoundary>
      <PdfMergeToolContent />
    </ErrorBoundary>
  );
}

function PdfMergeToolContent() {
  const lang = useLang();
  const t = useTranslations(lang);
  const tool = usePdfTool();
  const [useObjectStreams, setUseObjectStreams] = useState(true);

  const handleMerge = useCallback(async () => {
    // 注:当前 usePdfTool 只支持单 inputId,merge 需要多文件
    // 此处用单输入演示 workflow 构造,实际 merge 需要 [id1, id2, ...]
    // Phase 3 集成 BatchQueue 后会扩展 usePdfTool 支持多输入
    const wf = buildMergePdfWorkflow(
      { useObjectStreams },
      'PdfMerge'
    );
    await tool.runWorkflow(wf);
  }, [tool, useObjectStreams]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">{t('pdfMerge.title')}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{t('pdfMerge.subtitle')}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        <div className="rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-[11px] text-amber-300">
          {t('pdfMerge.multiInputHint')}
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-12">
          <label className="flex flex-col gap-1 sm:col-span-12">
            <span className="flex items-center gap-2 text-[10px] font-medium text-zinc-500">
              <input
                type="checkbox"
                checked={useObjectStreams}
                onChange={(e) => setUseObjectStreams(e.target.checked)}
                className="h-3 w-3 accent-indigo-500"
              />
              {t('pdfMerge.useObjectStreams')}
            </span>
            <span className="text-[10px] text-zinc-600">{t('pdfMerge.useObjectStreamsHint')}</span>
          </label>
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleMerge}
            disabled={!tool.ready || !tool.inputId || tool.busy}
            className="rounded-lg bg-indigo-600 px-24 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tool.busy ? t('pdfMerge.busy') : t('pdfMerge.btn')}
          </button>
        </div>

        <PdfToolResultPanel
          tool={tool}
          onFiles={tool.handleFiles}
          uploadHint={t('pdfMerge.uploadHint')}
          reselectLabel={t('pdfMerge.reselect')}
          downloadName={() => `merged-${Date.now()}.pdf`}
          onReset={tool.reset}
        />
      </div>
    </div>
  );
}
