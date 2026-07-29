/**
 * W5.1 / W8.5 / W8.6 · Compress 工具页
 *
 * 导入图片 → 选择模式(质量 / 目标体积)+ 输出格式(含"智能"默认)→ 压缩 → before/after 对比 + 下载
 * 调用 image.compress capability。
 *
 * W8.5:新增"目标体积"模式 —— 输入目标 KB,engine 通过二分查找找到 ≤ 目标体积的最大质量
 *       (compressToTargetSize,见 engine-image/src/operations/compress-target.ts)。
 * W8.6:"智能"格式 —— 输入含透明像素 → 输出 PNG(保留透明);否则 → WebP(更高压缩率)。
 *       透明检测在 UI 层完成(detectTransparency),不影响 engine 的 Blob↔Blob 契约。
 */
import { useCallback, useEffect, useState } from 'react';
import { useImageTool } from '@/components/toolkit/useImageTool';
import { detectTransparency } from '@/components/toolkit/download';
import { formatBytes } from '@lokvis/runtime';
import { buildSingleStepImageWorkflow } from '@/components/toolkit/workflow-builder';
import { ToolResultPanel } from '@/components/toolkit/ToolResultPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

type Format = 'smart' | 'webp' | 'avif' | 'jpeg' | 'png';
type CompressMode = 'quality' | 'target';
/** 引擎实际接受的格式(去掉 'smart',在 handleCompress 内解析) */
type EngineFormat = 'webp' | 'avif' | 'jpeg' | 'png';

export default function CompressTool() {
  return (
    <ErrorBoundary>
      <CompressToolContent />
    </ErrorBoundary>
  );
}

function CompressToolContent() {
  const lang = useLang();
  const t = useTranslations(lang);
  const tool = useImageTool();
  const [mode, setMode] = useState<CompressMode>('quality');
  const [format, setFormat] = useState<Format>('smart');
  const [quality, setQuality] = useState(85);
  /** 目标体积(KB)—— engine 接受 bytes,提交时转换 */
  const [targetKB, setTargetKB] = useState(100);
  const [skipped, setSkipped] = useState(0);
  /** 当前输入 Blob(用于透明检测;不放入 useImageTool 是为避免影响其它 4 个工具页) */
  const [inputBlob, setInputBlob] = useState<Blob | null>(null);
  /** 透明检测结果(null = 检测中或未导入) */
  const [hasTransparency, setHasTransparency] = useState<boolean | null>(null);

  // 不用 useCallback:`tool` 是 useImageTool() 每次返回的新对象字面量,
  // 放进依赖数组会让 callback 每次重建——等于没 memo。函数本身轻量,直接用普通函数。
  const handleFiles = async (files: File[]) => {
    const res = await tool.handleFiles(files);
    setSkipped(res.skipped);
    if (files[0]) {
      setInputBlob(files[0]);
      setHasTransparency(null); // 重置,异步检测后更新
    }
  };

  // 输入变化时异步检测透明度(W8.6 智能格式用)
  useEffect(() => {
    if (!inputBlob) {
      setHasTransparency(null);
      return;
    }
    let cancelled = false;
    detectTransparency(inputBlob).then((result) => {
      if (!cancelled) setHasTransparency(result);
    });
    return () => {
      cancelled = true;
    };
  }, [inputBlob]);

  /**
   * 解析"智能"格式 → 实际输出格式。
   * - 质量模式:含透明 → PNG(保留透明);否则 → WebP
   * - 目标体积模式:PNG 无法质量压缩到目标体积,统一回退 WebP(支持透明 + 有损)
   */
  const resolveFormat = useCallback((): EngineFormat => {
    // 目标体积模式:PNG 无损,quality 二分查找无法收敛,统一回退 WebP(支持有损 + 透明)
    if (mode === 'target' && (format === 'smart' || format === 'png')) return 'webp';
    if (format === 'smart') return hasTransparency ? 'png' : 'webp';
    return format;
  }, [format, mode, hasTransparency]);

  const handleCompress = useCallback(async () => {
    const engineFormat = resolveFormat();
    const params: Record<string, unknown> = { format: engineFormat };
    if (mode === 'target') {
      params.targetSize = targetKB * 1024; // KB → bytes
    } else {
      // PNG 无损,quality 无意义;engine 内部对 PNG 会忽略 quality
      params.quality = quality;
    }
    const wf = buildSingleStepImageWorkflow(
      'image.compress',
      params,
      'Compress',
      'Compress image with specified quality or target size'
    );
    await tool.runWorkflow(wf);
  }, [tool, mode, format, quality, targetKB, resolveFormat]);

  const handleReset = () => {
    tool.reset();
    setInputBlob(null);
    setHasTransparency(null);
    setSkipped(0);
  };

  // 压缩率:输出比输入小时为正(节省),比输入大时为负(增大),分别给不同文案
  const { inputInfo, outputInfo } = tool;
  let ratioText: string | null = null;
  if (inputInfo && outputInfo) {
    const ratio = (1 - outputInfo.size / inputInfo.size) * 100;
    if (ratio >= 0) {
      ratioText = `${t('compress.savedPrefix')}${ratio.toFixed(1)}%(${formatBytes(inputInfo.size)} → ${formatBytes(outputInfo.size)})`;
    } else {
      ratioText = `${t('compress.increasedPrefix')}${(-ratio).toFixed(1)}%(${formatBytes(inputInfo.size)} → ${formatBytes(outputInfo.size)})`;
    }
  }

  // 智能格式提示文案(让用户知道实际选了什么)
  const resolvedFormat = resolveFormat();
  const smartHint =
    format === 'smart'
      ? mode === 'target'
        ? t('compress.smartTargetWebp')
        : hasTransparency === null
          ? t('compress.detectingTransparency')
          : hasTransparency
            ? t('compress.detectedTransparent')
            : t('compress.noTransparency')
      : mode === 'target' && format === 'png'
        ? t('compress.pngFallbackWebp')
        : '';

  // PNG 无损,质量滑块在 PNG 下不生效
  const qualityDisabled = resolvedFormat === 'png';

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">{t('compress.title')}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{t('compress.subtitle')}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* 参数面板 */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-12">
          <label className="flex flex-col gap-1 sm:col-span-3">
            <span className="text-[10px] font-medium text-zinc-500">{t('compress.mode')}</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as CompressMode)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="quality">{t('compress.modeQualityOption')}</option>
              <option value="target">{t('compress.modeTargetOption')}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 sm:col-span-3">
            <span className="text-[10px] font-medium text-zinc-500">{t('compress.format')}</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as Format)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="smart">{t('compress.formatSmartOption')}</option>
              <option value="webp">WebP</option>
              <option value="avif">AVIF</option>
              <option value="jpeg">JPEG</option>
              <option value="png">{t('compress.formatPngLossless')}</option>
            </select>
          </label>
          {mode === 'quality' ? (
            <label className={`flex flex-col gap-1 sm:col-span-3 ${qualityDisabled ? 'opacity-50' : ''}`}>
              <span className="flex items-center justify-between text-[10px] font-medium text-zinc-500">
                <span>{t('compress.quality')}</span>
                <span className="font-mono text-zinc-300">
                  {quality}{qualityDisabled ? t('compress.pngLossless') : ''}
                </span>
              </span>
              <input
                type="range"
                min={1}
                max={100}
                value={quality}
                disabled={qualityDisabled}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="h-1.5 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-indigo-500"
              />
            </label>
          ) : (
            <label className="flex flex-col gap-1 sm:col-span-3">
              <span className="flex items-center justify-between text-[10px] font-medium text-zinc-500">
                <span>{t('compress.targetSize')}</span>
                <span className="font-mono text-zinc-300">{targetKB} KB</span>
              </span>
              <input
                type="number"
                min={1}
                value={targetKB}
                onChange={(e) => setTargetKB(Math.max(1, Number(e.target.value)))}
                className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
              />
            </label>
          )}
        </div>

        {/* 压缩按钮(独立于参数面板外,居中) */}
        <div className="flex justify-center">
          <button
            onClick={handleCompress}
            disabled={!tool.ready || !tool.inputId || tool.busy}
            className="rounded-lg bg-indigo-600 px-24 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tool.busy ? t('compress.busy') : t('compress.btn')}
          </button>
        </div>

        {/* 智能格式提示 */}
        {smartHint && (
          <p className="text-[10px] text-zinc-500">{t('compress.smartFormatLabel')}{smartHint}</p>
        )}
        {mode === 'target' && (
          <p className="text-[10px] text-zinc-600">
            {t('compress.targetModeHintPrefix')}{targetKB}{t('compress.targetModeHintMiddle')}
          </p>
        )}

        <ToolResultPanel
          tool={tool}
          onFiles={handleFiles}
          uploadHint={t('compress.uploadHint')}
          reselectLabel={t('compress.reselect')}
          downloadName={() => `compressed.${resolvedFormat}`}
          onReset={handleReset}
        >
          {skipped > 0 && (
            <p className="text-xs text-amber-400">
              {t('common.skipPrefix')}{skipped}{t('common.skipSuffix')}
            </p>
          )}
          {ratioText && (
            <p className={`text-xs ${outputInfo && inputInfo && outputInfo.size <= inputInfo.size ? 'text-emerald-400' : 'text-amber-400'}`}>
              {ratioText}
            </p>
          )}
        </ToolResultPanel>
      </div>
    </div>
  );
}
