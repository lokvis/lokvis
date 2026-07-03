/**
 * W5.1 · Compress 工具页
 *
 * 导入图片 → 选择格式(WebP/AVIF/JPEG/PNG)+ 质量滑块 → 压缩 → before/after 对比 + 下载
 * 调用 image.compress capability。
 */
import { useCallback, useState } from 'react';
import type { Workflow } from '@lokvis/sdk';
import { UploadBox } from '../toolkit/UploadBox';
import { PreviewBox } from '../toolkit/PreviewBox';
import { useImageTool } from '../toolkit/useImageTool';
import { downloadBlob, formatBytes, imageInfoToMeta } from '../toolkit/download';

type Format = 'webp' | 'avif' | 'jpeg' | 'png';

export default function CompressTool() {
  const tool = useImageTool();
  const [format, setFormat] = useState<Format>('webp');
  const [quality, setQuality] = useState(85);
  const [skipped, setSkipped] = useState(0);

  const handleFiles = useCallback(
    async (files: File[]) => {
      const res = await tool.handleFiles(files);
      setSkipped(res.skipped);
    },
    [tool]
  );

  const handleCompress = useCallback(async () => {
    const wf: Workflow = {
      id: `compress-${Date.now()}`,
      version: '1.0',
      name: 'Compress',
      description: 'Compress image with specified quality',
      author: { id: 'playground', name: 'Playground' },
      category: 'image',
      tags: [],
      nodes: [
        { id: 'n1', type: 'transform', capability: 'image.compress', params: { format, quality } },
      ],
      edges: [],
      inputs: { type: 'image', multiple: false },
      outputs: { type: 'image' },
    };
    await tool.runWorkflow(wf);
  }, [tool, format, quality]);

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

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">Compress</h1>
        <p className="mt-0.5 text-xs text-zinc-500">image.compress · 格式转换 + 质量压缩</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* 参数面板 */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">输出格式</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as Format)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="webp">WebP(推荐)</option>
              <option value="avif">AVIF</option>
              <option value="jpeg">JPEG</option>
              <option value="png">PNG(无损)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">质量:{quality}</span>
            <input
              type="range"
              min={1}
              max={100}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="h-1.5 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-indigo-500"
            />
          </label>
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
                      onClick={() => downloadBlob(tool.outputBlob!, `compressed.${format}`)}
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
            onClick={tool.reset}
            className="self-start text-[10px] text-zinc-500 hover:text-zinc-300"
          >
            ← 重新选择图片
          </button>
        )}
      </div>
    </div>
  );
}
