/**
 * W5.3 · Convert 工具页
 *
 * 导入图片 → 目标格式选择(PNG/JPEG/WebP/AVIF/GIF)+ 质量滑块 → 转换 → before/after 对比 + 下载
 * 调用 image.convert capability。
 */
import { useCallback, useState } from 'react';
import type { Workflow } from '@lokvis/sdk';
import { UploadBox } from '@/components/toolkit/UploadBox';
import { PreviewBox } from '@/components/toolkit/PreviewBox';
import { useImageTool } from '@/components/toolkit/useImageTool';
import { downloadBlob, formatBytes, imageInfoToMeta } from '@/components/toolkit/download';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

type Format = 'png' | 'jpeg' | 'webp' | 'avif' | 'gif';

export default function ConvertTool() {
  return (
    <ErrorBoundary>
      <ConvertToolContent />
    </ErrorBoundary>
  );
}

function ConvertToolContent() {
  const lang = useLang();
  const t = useTranslations(lang);
  const tool = useImageTool();
  const [format, setFormat] = useState<Format>('webp');
  const [quality, setQuality] = useState(90);
  const [skipped, setSkipped] = useState(0);

  // 不用 useCallback:`tool` 是 useImageTool() 每次返回的新对象字面量,
  // 放进依赖数组会让 callback 每次重建——等于没 memo。函数本身轻量,直接用普通函数。
  const handleFiles = async (files: File[]) => {
    const res = await tool.handleFiles(files);
    setSkipped(res.skipped);
  };

  const handleConvert = useCallback(async () => {
    const wf: Workflow = {
      id: `convert-${Date.now()}`,
      version: '1.0',
      name: 'Convert',
      description: 'Convert image to another format',
      author: { id: 'playground', name: 'Playground' },
      category: 'image',
      tags: [],
      nodes: [
        { id: 'n1', type: 'transform', capability: 'image.convert', params: { format, quality } },
      ],
      edges: [],
      inputs: { type: 'image', multiple: false },
      outputs: { type: 'image' },
    };
    await tool.runWorkflow(wf);
  }, [tool, format, quality]);

  // PNG/GIF 为无损格式,quality 不适用
  const isLossless = format === 'png' || format === 'gif';
  const { inputInfo, outputInfo } = tool;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">{t('convert.title')}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{t('convert.subtitle')}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* 参数面板 */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">{t('convert.targetFormat')}</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as Format)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="webp">WebP</option>
              <option value="avif">AVIF</option>
              <option value="jpeg">JPEG</option>
              <option value="png">{t('convert.formatPngLossless')}</option>
              <option value="gif">GIF</option>
            </select>
          </label>
          <label className={`flex flex-col gap-1 ${isLossless ? 'opacity-50' : ''}`}>
            <span className="flex items-center justify-between text-[10px] font-medium text-zinc-500">
              <span>{t('convert.quality')}</span>
              <span className="font-mono text-zinc-300">
                {quality}{isLossless ? t('convert.lossless') : ''}
              </span>
            </span>
            <input
              type="range"
              min={1}
              max={100}
              value={quality}
              disabled={isLossless}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="h-1.5 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-indigo-500"
            />
          </label>
        </div>

        {/* 压缩按钮(独立于参数面板外,居中) */}
        <div className="flex justify-center">
          <button
            onClick={handleConvert}
            disabled={!tool.ready || !tool.inputId || tool.busy}
            className="rounded-lg bg-indigo-600 px-24 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tool.busy ? t('convert.busy') : t('convert.btn')}
          </button>
        </div>

        {tool.initError && <p className="text-xs text-red-400">{t('common.initFailedPrefix')}{tool.initError}</p>}
        {tool.error && <p className="text-xs text-red-400">{tool.error}</p>}
        {skipped > 0 && (
          <p className="text-xs text-amber-400">
            {t('common.skipPrefix')}{skipped}{t('common.skipSuffix')}
          </p>
        )}
        {inputInfo && outputInfo && (
          <p className="text-xs text-emerald-400">
            {inputInfo.format} → {outputInfo.format} · {formatBytes(inputInfo.size)} → {formatBytes(outputInfo.size)}
          </p>
        )}

        {/* Input / Output 对比 */}
        <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
          {!tool.inputId ? (
            <UploadBox onFiles={handleFiles} hint={t('convert.uploadHint')} className="md:col-span-2" />
          ) : (
            <>
              <PreviewBox title={t('common.input')} url={tool.inputUrl} meta={imageInfoToMeta(tool.inputInfo)} />
              <PreviewBox
                title={t('common.output')}
                url={tool.outputUrl}
                meta={imageInfoToMeta(tool.outputInfo)}
                action={
                  tool.outputBlob && (
                    <button
                      onClick={() => downloadBlob(tool.outputBlob!, `converted.${format}`)}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300"
                    >
                      {t('common.download')}
                    </button>
                  )
                }
              />
            </>
          )}
        </div>

        {tool.inputId && (
          <button
            onClick={tool.reset}
            className="self-start text-[10px] text-zinc-500 hover:text-zinc-300"
          >
            {t('convert.reselect')}
          </button>
        )}
      </div>
    </div>
  );
}
