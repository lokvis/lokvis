/**
 * W5.2 / W8.2 / W8.4 · Resize 工具页
 *
 * 导入图片 → 平台预设选择器 + 宽度/高度输入 + fit 选择 + DPI 输入 + 保持比例 toggle → resize → before/after 对比 + 下载
 * 调用 image.resize capability。高度留空(0)表示按比例自动。
 *
 * W8.2:平台预设选择器,选预设后自动填充 width/height/fit(format 在 convert/compress 页用)
 * W8.4:DPI 输入(72/150/300/自定义),不改变像素尺寸,而是写入 PNG 输出文件的 pHYs chunk
 *       (engine-image `embedPngDpi`),打印软件据此读取物理分辨率。仅 PNG 输出生效;
 *       非 PNG 时 DPI 仅用于 UI 的印刷尺寸 mm 提示。预设切换时按目标平台推荐 DPI 自动设置。
 */
import { useCallback, useRef, useState } from 'react';
import type { Workflow } from '@lokvis/sdk';
import { UploadBox } from '@/components/toolkit/UploadBox';
import { PreviewBox } from '@/components/toolkit/PreviewBox';
import { useImageTool } from '@/components/toolkit/useImageTool';
import { PlatformPresetSelector } from '@/components/toolkit/PlatformPresetSelector';
import { downloadBlob, formatBytes, imageInfoToMeta } from '@/components/toolkit/download';
import type { PlatformSizePreset } from '@lokvis/capability';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

type Fit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';

/** 常用 DPI 预设 */
const DPI_PRESETS = [72, 150, 300] as const;
type DpiPreset = (typeof DPI_PRESETS)[number] | 'custom';

export default function ResizeTool() {
  return (
    <ErrorBoundary>
      <ResizeToolContent />
    </ErrorBoundary>
  );
}

function ResizeToolContent() {
  const lang = useLang();
  const t = useTranslations(lang);
  const tool = useImageTool();
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(0); // 0 表示按比例自动
  const [fit, setFit] = useState<Fit>('inside');
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [skipped, setSkipped] = useState(0);
  /** 当前选中的平台预设 id(null 表示未选) */
  const [presetId, setPresetId] = useState<string | null>(null);
  /** DPI 输入模式:预设(72/150/300)或自定义 */
  const [dpiMode, setDpiMode] = useState<DpiPreset>(72);
  /** 自定义 DPI 数值(dpiMode='custom' 时生效) */
  const [dpiCustom, setDpiCustom] = useState(300);

  /** 当前 DPI 数值(供 workflow 参数与 UI 显示) */
  const dpi = dpiMode === 'custom' ? dpiCustom : dpiMode;

  // 用 ref 跟踪 dpiMode,避免 handlePresetSelect 因 dpiMode 变化而重建
  // (DPI 改动不应触发下游依赖 handlePresetSelect 的组件 re-render)
  const dpiModeRef = useRef(dpiMode);
  dpiModeRef.current = dpiMode;

  // 不用 useCallback:`tool` 是 useImageTool() 每次返回的新对象字面量,
  // 放进依赖数组会让 callback 每次重建——等于没 memo。函数本身轻量,直接用普通函数。
  const handleFiles = async (files: File[]) => {
    const res = await tool.handleFiles(files);
    setSkipped(res.skipped);
  };

  /** 应用平台预设到表单(用户可继续微调) */
  const handlePresetSelect = useCallback((preset: PlatformSizePreset | null) => {
    if (!preset) {
      setPresetId(null);
      return;
    }
    setPresetId(preset.id);
    setWidth(preset.width);
    setHeight(preset.height);
    if (preset.recommendedFit) setFit(preset.recommendedFit as Fit);
    // 打印类预设默认 300 DPI,其余默认 72(屏幕)
    if (preset.category === 'print') {
      setDpiMode(300);
    } else if (dpiModeRef.current === 300) {
      // 从打印预设切到非打印预设时,把 DPI 也降回 72(避免误用 300 DPI 给 Web 图)
      setDpiMode(72);
    }
  }, []);

  const handleResize = useCallback(async () => {
    // 高度为 0 时省略,由 engine 按比例自动计算
    const params: Record<string, unknown> = { width, fit, maintainAspectRatio, dpi };
    if (height > 0) params.height = height;
    const wf: Workflow = {
      id: `resize-${Date.now()}`,
      version: '1.0',
      name: 'Resize',
      description: 'Resize image to specified dimensions',
      author: { id: 'playground', name: 'Playground' },
      category: 'image',
      tags: [],
      nodes: [
        { id: 'n1', type: 'transform', capability: 'image.resize', params },
      ],
      edges: [],
      inputs: { type: 'image', multiple: false },
      outputs: { type: 'image' },
    };
    await tool.runWorkflow(wf);
  }, [tool, width, height, fit, maintainAspectRatio, dpi]);

  const { inputInfo, outputInfo, runtime } = tool;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">{t('resize.title')}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{t('resize.subtitle')}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* 平台预设选择器(W8.2) */}
        <PlatformPresetSelector
          value={presetId}
          onSelect={handlePresetSelect}
          isPro={runtime?.isPro}
          currentForm={{ width, height, fit }}
        />

        {/* 参数面板 */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-6">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">{t('resize.widthLabel')}</span>
            <input
              type="number"
              min={1}
              value={width || ''}
              onChange={(e) => setWidth(e.target.value ? Number(e.target.value) : 0)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">{t('resize.heightLabel')}</span>
            <input
              type="number"
              min={1}
              value={height || ''}
              onChange={(e) => setHeight(e.target.value ? Number(e.target.value) : 0)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">{t('resize.fit')}</span>
            <select
              value={fit}
              onChange={(e) => setFit(e.target.value as Fit)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="inside">{t('resize.fitInside')}</option>
              <option value="cover">{t('resize.fitCover')}</option>
              <option value="contain">{t('resize.fitContain')}</option>
              <option value="fill">{t('resize.fitFill')}</option>
              <option value="outside">{t('resize.fitOutside')}</option>
            </select>
          </label>
          {/* DPI 输入(W8.4)*/}
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">{t('resize.dpi')}</span>
            <select
              value={dpiMode}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'custom') setDpiMode('custom');
                else setDpiMode(Number(v) as DpiPreset);
              }}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value={72}>{t('resize.dpiScreen')}</option>
              <option value={150}>{t('resize.dpiDraft')}</option>
              <option value={300}>{t('resize.dpiPrint')}</option>
              <option value="custom">{t('resize.dpiCustom')}</option>
            </select>
          </label>
          {dpiMode === 'custom' && (
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-zinc-500">{t('resize.dpiCustomLabel')}</span>
              <input
                type="number"
                min={1}
                max={4800}
                value={dpiCustom}
                onChange={(e) => setDpiCustom(Math.min(4800, Math.max(1, Number(e.target.value))))}
                className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
              />
            </label>
          )}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">{t('resize.keepRatio')}</span>
            <div className="flex h-[26px] items-center gap-2">
              <input
                id="resize-ratio"
                type="checkbox"
                checked={maintainAspectRatio}
                onChange={(e) => setMaintainAspectRatio(e.target.checked)}
                className="h-3.5 w-3.5 accent-indigo-500"
              />
              <label htmlFor="resize-ratio" className="text-xs text-zinc-400">
                {maintainAspectRatio ? t('resize.keepRatioYes') : t('resize.keepRatioNo')}
              </label>
            </div>
          </div>
        </div>

        {/* 压缩按钮(独立于参数面板外,居中) */}
        <div className="flex justify-center">
          <button
            onClick={handleResize}
            disabled={!tool.ready || !tool.inputId || tool.busy || width <= 0}
            className="rounded-lg bg-indigo-600 px-24 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tool.busy ? t('resize.busyBtn') : t('resize.btn')}
          </button>
        </div>

        {/* DPI 提示 */}
        <p className="text-[10px] text-zinc-600">
          {t('resize.dpiHintPrefix')}{dpi}{t('resize.dpiHintMiddle')}{((width || 0) / dpi * 25.4).toFixed(1)}×
          {height > 0 ? `${((height / dpi) * 25.4).toFixed(1)}${t('resize.dpiHintSuffix')}` : t('resize.dpiHeightAuto')}
        </p>

        {tool.initError && <p className="text-xs text-red-400">{t('common.initFailedPrefix')}{tool.initError}</p>}
        {tool.error && <p className="text-xs text-red-400">{tool.error}</p>}
        {skipped > 0 && (
          <p className="text-xs text-amber-400">
            {t('common.skipPrefix')}{skipped}{t('common.skipSuffix')}
          </p>
        )}
        {inputInfo && outputInfo && (
          <p className="text-xs text-emerald-400">
            {inputInfo.width}×{inputInfo.height} → {outputInfo.width}×{outputInfo.height} · {formatBytes(inputInfo.size)} → {formatBytes(outputInfo.size)}
          </p>
        )}

        {/* Input / Output 对比 */}
        <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
          {!tool.inputId ? (
            <UploadBox onFiles={handleFiles} hint={t('resize.uploadHint')} className="md:col-span-2" />
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
                        downloadBlob(
                          tool.outputBlob!,
                          `resized-${outputInfo?.width ?? width}x${outputInfo?.height ?? height}.${(outputInfo?.format ?? 'png').toLowerCase()}`
                        )
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
            {t('resize.reselect')}
          </button>
        )}
      </div>
    </div>
  );
}
