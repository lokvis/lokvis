/**
 * W5.5 · Watermark 工具页
 *
 * 导入图片 → 水印文字 + 位置(6 个)+ 透明度 + 字号 + 颜色 → 加水印 → before/after 对比 + 下载
 * 调用 image.watermark capability。
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

type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'tile';

const POSITION_KEYS: Record<Position, string> = {
  'top-left': 'watermark.positionTopLeft',
  'top-right': 'watermark.positionTopRight',
  'center': 'watermark.positionCenter',
  'bottom-left': 'watermark.positionBottomLeft',
  'bottom-right': 'watermark.positionBottomRight',
  'tile': 'watermark.positionTile',
};

const POSITIONS: Position[] = [
  'top-left',
  'top-right',
  'center',
  'bottom-left',
  'bottom-right',
  'tile',
];

export default function WatermarkTool() {
  return (
    <ErrorBoundary>
      <WatermarkToolContent />
    </ErrorBoundary>
  );
}

function WatermarkToolContent() {
  const lang = useLang();
  const t = useTranslations(lang);
  const tool = useImageTool();
  const [text, setText] = useState('Lokvis');
  const [position, setPosition] = useState<Position>('bottom-right');
  const [opacity, setOpacity] = useState(0.8);
  const [fontSize, setFontSize] = useState(24);
  const [color, setColor] = useState('#ffffff');
  const [skipped, setSkipped] = useState(0);

  // 不用 useCallback:`tool` 是 useImageTool() 每次返回的新对象字面量,
  // 放进依赖数组会让 callback 每次重建——等于没 memo。函数本身轻量,直接用普通函数。
  const handleFiles = async (files: File[]) => {
    const res = await tool.handleFiles(files);
    setSkipped(res.skipped);
  };

  const handleWatermark = useCallback(async () => {
    // #13:text 为空时不执行 runWorkflow,只通过 UI 提示(按钮始终可点击)
    if (!text) return;
    const wf: Workflow = {
      id: `watermark-${Date.now()}`,
      version: '1.0',
      name: 'Watermark',
      description: 'Add text watermark to image',
      author: { id: 'playground', name: 'Playground' },
      category: 'image',
      tags: [],
      nodes: [
        {
          id: 'n1',
          type: 'transform',
          capability: 'image.watermark',
          params: { text, position, opacity, fontSize, color },
        },
      ],
      edges: [],
      inputs: { type: 'image', multiple: false },
      outputs: { type: 'image' },
    };
    await tool.runWorkflow(wf);
  }, [tool, text, position, opacity, fontSize, color]);

  // text 为空时给出友好提示,按钮仍可点击(#13)
  const textEmpty = !text;
  const { inputInfo, outputInfo } = tool;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">{t('watermark.title')}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{t('watermark.subtitle')}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* 参数面板 */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[10px] font-medium text-zinc-500">{t('watermark.textLabel')}</span>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">{t('watermark.positionLabel')}</span>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value as Position)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p}>{t(POSITION_KEYS[p])}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="flex items-center justify-between text-[10px] font-medium text-zinc-500">
              <span>{t('watermark.opacityLabel')}</span>
              <span className="font-mono text-zinc-300">{opacity.toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="h-1.5 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-indigo-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">{t('watermark.fontSizeLabel')}</span>
            <input
              type="number"
              min={1}
              value={fontSize}
              onChange={(e) => setFontSize(Math.max(1, Number(e.target.value)))}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">{t('watermark.colorLabel')}</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-[26px] w-full cursor-pointer rounded border border-zinc-700 bg-zinc-950 p-0.5"
            />
          </label>
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleWatermark}
            disabled={!tool.ready || !tool.inputId || tool.busy}
            className="rounded-lg bg-indigo-600 px-24 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tool.busy ? t('watermark.busy') : t('watermark.btn')}
          </button>
        </div>

        {tool.initError && <p className="text-xs text-red-400">{t('common.initFailedPrefix')}{tool.initError}</p>}
        {tool.error && <p className="text-xs text-red-400">{tool.error}</p>}
        {textEmpty && tool.inputId && (
          <p className="text-xs text-amber-400">{t('watermark.textRequired')}</p>
        )}
        {skipped > 0 && (
          <p className="text-xs text-amber-400">
            {t('common.skipPrefix')}{skipped}{t('common.skipSuffix')}
          </p>
        )}
        {inputInfo && outputInfo && (
          <p className="text-xs text-emerald-400">
            {t('watermark.appliedPrefix')}{formatBytes(inputInfo.size)} → {formatBytes(outputInfo.size)}
          </p>
        )}

        {/* Input / Output 对比 */}
        <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
          {!tool.inputId ? (
            <UploadBox onFiles={handleFiles} hint={t('watermark.uploadHint')} className="md:col-span-2" />
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
                      onClick={() =>
                        downloadBlob(tool.outputBlob!, `watermarked.${(outputInfo?.format ?? 'png').toLowerCase()}`)
                      }
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
            {t('watermark.reselect')}
          </button>
        )}
      </div>
    </div>
  );
}
