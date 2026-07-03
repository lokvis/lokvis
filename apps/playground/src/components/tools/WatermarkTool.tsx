/**
 * W5.5 · Watermark 工具页
 *
 * 导入图片 → 水印文字 + 位置(6 个)+ 透明度 + 字号 + 颜色 → 加水印 → before/after 对比 + 下载
 * 调用 image.watermark capability。
 */
import { useCallback, useEffect, useState } from 'react';
import type { AssetId, Workflow } from '@lokvis/sdk';
import { UploadBox } from '../toolkit/UploadBox';
import { PreviewBox } from '../toolkit/PreviewBox';
import { useLokvisRuntime } from '../toolkit/useLokvisRuntime';
import { downloadBlob, formatBytes, getImageInfo, imageInfoToMeta, type ImageInfo } from '../toolkit/download';

type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'tile';

const POSITIONS: { value: Position; label: string }[] = [
  { value: 'top-left', label: '左上' },
  { value: 'top-right', label: '右上' },
  { value: 'center', label: '居中' },
  { value: 'bottom-left', label: '左下' },
  { value: 'bottom-right', label: '右下' },
  { value: 'tile', label: '平铺' },
];

export default function WatermarkTool() {
  const { runtime, ready, error: initError } = useLokvisRuntime();
  const [inputId, setInputId] = useState<AssetId | null>(null);
  const [inputUrl, setInputUrl] = useState<string | null>(null);
  const [inputInfo, setInputInfo] = useState<ImageInfo | null>(null);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputInfo, setOutputInfo] = useState<ImageInfo | null>(null);
  const [text, setText] = useState('Lokvis');
  const [position, setPosition] = useState<Position>('bottom-right');
  const [opacity, setOpacity] = useState(0.8);
  const [fontSize, setFontSize] = useState(24);
  const [color, setColor] = useState('#ffffff');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(async (files: File[]) => {
    if (!runtime || files.length === 0) return;
    try {
      const file = files[0]!;
      const id = await runtime.importAsset({ kind: 'file', file });
      setInputId(id);
      const url = URL.createObjectURL(file);
      setInputUrl(url);
      setInputInfo(await getImageInfo(file));
      setOutputBlob(null);
      setOutputInfo(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [runtime]);

  const handleWatermark = useCallback(async () => {
    if (!runtime || !inputId) return;
    setBusy(true);
    setError(null);
    try {
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
      const result = await runtime.run(wf, [inputId]);
      if (result.status === 'completed' && result.outputs[0]) {
        const blob = await runtime.exportAsset(result.outputs[0]);
        setOutputBlob(blob);
        setOutputInfo(await getImageInfo(blob));
      } else {
        setError(result.error ?? '加水印失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [runtime, inputId, text, position, opacity, fontSize, color]);

  // output Blob → URL,自动 revoke
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!outputBlob) {
      setOutputUrl(null);
      return;
    }
    const url = URL.createObjectURL(outputBlob);
    setOutputUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [outputBlob]);

  // cleanup input url
  useEffect(() => {
    return () => {
      if (inputUrl) URL.revokeObjectURL(inputUrl);
    };
  }, [inputUrl]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">Watermark</h1>
        <p className="mt-0.5 text-xs text-zinc-500">image.watermark · 文字水印</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* 参数面板 */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[10px] font-medium text-zinc-500">水印文字</span>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">位置</span>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value as Position)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              {POSITIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">透明度:{opacity.toFixed(2)}</span>
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
            <span className="text-[10px] font-medium text-zinc-500">字号(px)</span>
            <input
              type="number"
              min={1}
              value={fontSize}
              onChange={(e) => setFontSize(Math.max(1, Number(e.target.value)))}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">颜色</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-[26px] w-full cursor-pointer rounded border border-zinc-700 bg-zinc-950 p-0.5"
            />
          </label>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleWatermark}
            disabled={!ready || !inputId || busy || !text}
            className="rounded-lg bg-indigo-600 px-6 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? '加水印中…' : '加水印'}
          </button>
        </div>

        {initError && <p className="text-xs text-red-400">初始化失败:{initError}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
        {inputInfo && outputInfo && (
          <p className="text-xs text-emerald-400">
            水印已应用 · {formatBytes(inputInfo.size)} → {formatBytes(outputInfo.size)}
          </p>
        )}

        {/* Input / Output 对比 */}
        <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
          {!inputId ? (
            <UploadBox onFiles={handleFiles} hint="选择或拖入图片" className="md:col-span-2" />
          ) : (
            <>
              <PreviewBox title="Input" url={inputUrl} meta={imageInfoToMeta(inputInfo)} />
              <PreviewBox
                title="Output"
                url={outputUrl}
                meta={imageInfoToMeta(outputInfo)}
                action={
                  outputBlob && (
                    <button
                      onClick={() =>
                        downloadBlob(outputBlob, `watermarked.${(outputInfo?.format ?? 'png').toLowerCase()}`)
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

        {inputId && (
          <button
            onClick={() => {
              setInputId(null);
              setInputUrl(null);
              setInputInfo(null);
              setOutputBlob(null);
              setOutputInfo(null);
            }}
            className="self-start text-[10px] text-zinc-500 hover:text-zinc-300"
          >
            ← 重新选择图片
          </button>
        )}
      </div>
    </div>
  );
}
