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
import type { Workflow } from '@lokvis/sdk';
import { UploadBox } from '../toolkit/UploadBox';
import { PreviewBox } from '../toolkit/PreviewBox';
import { useImageTool } from '../toolkit/useImageTool';
import { downloadBlob, detectTransparency, formatBytes, imageInfoToMeta } from '../toolkit/download';

type Format = 'smart' | 'webp' | 'avif' | 'jpeg' | 'png';
type CompressMode = 'quality' | 'target';
/** 引擎实际接受的格式(去掉 'smart',在 handleCompress 内解析) */
type EngineFormat = 'webp' | 'avif' | 'jpeg' | 'png';

export default function CompressTool() {
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
    const wf: Workflow = {
      id: `compress-${Date.now()}`,
      version: '1.0',
      name: 'Compress',
      description: 'Compress image with specified quality or target size',
      author: { id: 'playground', name: 'Playground' },
      category: 'image',
      tags: [],
      nodes: [
        { id: 'n1', type: 'transform', capability: 'image.compress', params },
      ],
      edges: [],
      inputs: { type: 'image', multiple: false },
      outputs: { type: 'image' },
    };
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
      ratioText = `节省 ${ratio.toFixed(1)}%(${formatBytes(inputInfo.size)} → ${formatBytes(outputInfo.size)})`;
    } else {
      ratioText = `增大 ${(-ratio).toFixed(1)}%(${formatBytes(inputInfo.size)} → ${formatBytes(outputInfo.size)})`;
    }
  }

  // 智能格式提示文案(让用户知道实际选了什么)
  const resolvedFormat = resolveFormat();
  const smartHint =
    format === 'smart'
      ? mode === 'target'
        ? `目标体积模式下使用 WebP(支持有损 + 透明)`
        : hasTransparency === null
          ? '检测透明中…'
          : hasTransparency
            ? '检测到透明 → PNG(保留透明)'
            : '无透明 → WebP(更高压缩率)'
      : mode === 'target' && format === 'png'
        ? 'PNG 无损无法压到目标体积,已回退 WebP'
        : '';

  // PNG 无损,质量滑块在 PNG 下不生效
  const qualityDisabled = resolvedFormat === 'png';

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">Compress</h1>
        <p className="mt-0.5 text-xs text-zinc-500">image.compress · 质量压缩 / 目标体积压缩 + 智能格式</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* 参数面板 */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">压缩模式</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as CompressMode)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="quality">质量模式</option>
              <option value="target">目标体积模式</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">输出格式</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as Format)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="smart">智能(推荐)</option>
              <option value="webp">WebP</option>
              <option value="avif">AVIF</option>
              <option value="jpeg">JPEG</option>
              <option value="png">PNG(无损)</option>
            </select>
          </label>
          {mode === 'quality' ? (
            <label className={`flex flex-col gap-1 ${qualityDisabled ? 'opacity-50' : ''}`}>
              <span className="text-[10px] font-medium text-zinc-500">
                质量:{quality}{qualityDisabled ? '(PNG 无损无效)' : ''}
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
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-zinc-500">目标体积(KB)</span>
              <input
                type="number"
                min={1}
                value={targetKB}
                onChange={(e) => setTargetKB(Math.max(1, Number(e.target.value)))}
                className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
              />
            </label>
          )}
          <div className="flex items-end">
            <button
              onClick={handleCompress}
              disabled={!tool.ready || !tool.inputId || tool.busy}
              className="w-full rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {tool.busy ? '压缩中…' : '压缩'}
            </button>
          </div>
        </div>

        {/* 智能格式提示 */}
        {smartHint && (
          <p className="text-[10px] text-zinc-500">智能格式:{smartHint}</p>
        )}
        {mode === 'target' && (
          <p className="text-[10px] text-zinc-600">
            目标体积模式下,engine 通过二分查找 [10, 95] 质量区间找到 ≤ {targetKB} KB 的最大质量(最多 6 次迭代)。
            若最低质量仍超目标,返回最低质量结果。
          </p>
        )}

        {tool.initError && <p className="text-xs text-red-400">初始化失败:{tool.initError}</p>}
        {tool.error && <p className="text-xs text-red-400">{tool.error}</p>}
        {skipped > 0 && (
          <p className="text-xs text-amber-400">
            仅处理首个文件,已忽略其余 {skipped} 个(批量处理请用 Batch Queue)
          </p>
        )}
        {ratioText && (
          <p className={`text-xs ${outputInfo && inputInfo && outputInfo.size <= inputInfo.size ? 'text-emerald-400' : 'text-amber-400'}`}>
            {ratioText}
          </p>
        )}

        {/* Input / Output 对比 */}
        <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
          {!tool.inputId ? (
            <UploadBox onFiles={handleFiles} hint="选择或拖入图片" className="md:col-span-2" />
          ) : (
            <>
              <PreviewBox title="Input" url={tool.inputUrl} meta={imageInfoToMeta(tool.inputInfo)} />
              <PreviewBox
                title="Output"
                url={tool.outputUrl}
                meta={imageInfoToMeta(tool.outputInfo)}
                action={
                  tool.outputBlob && (
                    <button
                      onClick={() => downloadBlob(tool.outputBlob!, `compressed.${resolvedFormat}`)}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300"
                    >
                      下载
                    </button>
                  )
                }
              />
            </>
          )}
        </div>

        {tool.inputId && (
          <button
            onClick={handleReset}
            className="self-start text-[10px] text-zinc-500 hover:text-zinc-300"
          >
            ← 重新选择图片
          </button>
        )}
      </div>
    </div>
  );
}
