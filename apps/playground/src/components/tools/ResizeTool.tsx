/**
 * W5.2 · Resize 工具页
 *
 * 导入图片 → 宽度/高度输入 + fit 选择(cover/contain/fill/inside/outside)+ 保持比例 toggle → resize → before/after 对比 + 下载
 * 调用 image.resize capability。高度留空(0)表示按比例自动。
 */
import { useCallback, useState } from 'react';
import type { Workflow } from '@lokvis/sdk';
import { UploadBox } from '../toolkit/UploadBox';
import { PreviewBox } from '../toolkit/PreviewBox';
import { useImageTool } from '../toolkit/useImageTool';
import { downloadBlob, formatBytes, imageInfoToMeta } from '../toolkit/download';

type Fit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';

export default function ResizeTool() {
  const tool = useImageTool();
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(0); // 0 表示按比例自动
  const [fit, setFit] = useState<Fit>('inside');
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [skipped, setSkipped] = useState(0);

  const handleFiles = useCallback(
    async (files: File[]) => {
      const res = await tool.handleFiles(files);
      setSkipped(res.skipped);
    },
    [tool]
  );

  const handleResize = useCallback(async () => {
    // 高度为 0 时省略,由 engine 按比例自动计算
    const params: Record<string, unknown> = { width, fit, maintainAspectRatio };
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
  }, [tool, width, height, fit, maintainAspectRatio]);

  const { inputInfo, outputInfo } = tool;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">Resize</h1>
        <p className="mt-0.5 text-xs text-zinc-500">image.resize · 尺寸调整 + 比例控制</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* 参数面板 */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-5">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">宽度(px)</span>
            <input
              type="number"
              min={1}
              value={width || ''}
              onChange={(e) => setWidth(e.target.value ? Number(e.target.value) : 0)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">高度(px,留空自动)</span>
            <input
              type="number"
              min={1}
              value={height || ''}
              onChange={(e) => setHeight(e.target.value ? Number(e.target.value) : 0)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">Fit 策略</span>
            <select
              value={fit}
              onChange={(e) => setFit(e.target.value as Fit)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="inside">inside(包含)</option>
              <option value="cover">cover(覆盖)</option>
              <option value="contain">contain</option>
              <option value="fill">fill(拉伸)</option>
              <option value="outside">outside</option>
            </select>
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">保持比例</span>
            <div className="flex h-[26px] items-center gap-2">
              <input
                id="resize-ratio"
                type="checkbox"
                checked={maintainAspectRatio}
                onChange={(e) => setMaintainAspectRatio(e.target.checked)}
                className="h-3.5 w-3.5 accent-indigo-500"
              />
              <label htmlFor="resize-ratio" className="text-xs text-zinc-400">
                {maintainAspectRatio ? '是' : '否'}
              </label>
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleResize}
              disabled={!tool.ready || !tool.inputId || tool.busy || width <= 0}
              className="w-full rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {tool.busy ? 'Resize 中…' : 'Resize'}
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
        {inputInfo && outputInfo && (
          <p className="text-xs text-emerald-400">
            {inputInfo.width}×{inputInfo.height} → {outputInfo.width}×{outputInfo.height} · {formatBytes(inputInfo.size)} → {formatBytes(outputInfo.size)}
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
                      onClick={() =>
                        downloadBlob(
                          tool.outputBlob!,
                          `resized-${outputInfo?.width ?? width}x${outputInfo?.height ?? height}.${(outputInfo?.format ?? 'png').toLowerCase()}`
                        )
                      }
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
