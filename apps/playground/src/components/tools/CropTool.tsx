/**
 * W5.4 · Crop 工具页
 *
 * 导入图片 → x/y/width/height 数值输入 + 预设比例(1:1/16:9/4:3/3:4/自由)→ crop → before/after 对比 + 下载
 * 调用 image.crop capability。预设比例按图片尺寸自动计算居中裁剪框。
 */
import { useCallback, useEffect, useState } from 'react';
import type { AssetId, Workflow } from '@lokvis/sdk';
import { UploadBox } from '../toolkit/UploadBox';
import { PreviewBox } from '../toolkit/PreviewBox';
import { useLokvisRuntime } from '../toolkit/useLokvisRuntime';
import { downloadBlob, formatBytes, getImageInfo, imageInfoToMeta, type ImageInfo } from '../toolkit/download';

type Preset = '1:1' | '16:9' | '4:3' | '3:4' | 'free';

/** 按目标比例(rw:rh)在 w×h 图片中计算居中裁剪框 */
function computeCenteredCrop(w: number, h: number, rw: number, rh: number) {
  const r = rw / rh;
  let cropW: number;
  let cropH: number;
  if (w / h > r) {
    // 图片比目标比例更宽 → 以高度为基准
    cropH = h;
    cropW = Math.round(h * r);
  } else {
    cropW = w;
    cropH = Math.round(w / r);
  }
  const x = Math.floor((w - cropW) / 2);
  const y = Math.floor((h - cropH) / 2);
  return { x, y, width: cropW, height: cropH };
}

export default function CropTool() {
  const { runtime, ready, error: initError } = useLokvisRuntime();
  const [inputId, setInputId] = useState<AssetId | null>(null);
  const [inputUrl, setInputUrl] = useState<string | null>(null);
  const [inputInfo, setInputInfo] = useState<ImageInfo | null>(null);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputInfo, setOutputInfo] = useState<ImageInfo | null>(null);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [width, setWidth] = useState(200);
  const [height, setHeight] = useState(200);
  const [preset, setPreset] = useState<Preset>('free');
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

  // 应用预设比例:按图片尺寸计算居中裁剪框
  const applyPreset = useCallback((p: Preset) => {
    setPreset(p);
    if (p === 'free') {
      // 自由:重置为默认裁剪框
      setX(0);
      setY(0);
      setWidth(200);
      setHeight(200);
      return;
    }
    if (!inputInfo) return;
    const ratios: Record<Exclude<Preset, 'free'>, [number, number]> = {
      '1:1': [1, 1],
      '16:9': [16, 9],
      '4:3': [4, 3],
      '3:4': [3, 4],
    };
    const [rw, rh] = ratios[p];
    const box = computeCenteredCrop(inputInfo.width, inputInfo.height, rw, rh);
    setX(box.x);
    setY(box.y);
    setWidth(box.width);
    setHeight(box.height);
  }, [inputInfo]);

  const handleCrop = useCallback(async () => {
    if (!runtime || !inputId) return;
    setBusy(true);
    setError(null);
    try {
      const wf: Workflow = {
        id: `crop-${Date.now()}`,
        version: '1.0',
        name: 'Crop',
        description: 'Crop image to a region',
        author: { id: 'playground', name: 'Playground' },
        category: 'image',
        tags: [],
        nodes: [
          { id: 'n1', type: 'transform', capability: 'image.crop', params: { x, y, width, height } },
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
        setError(result.error ?? 'crop 失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [runtime, inputId, x, y, width, height]);

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

  const presets: Preset[] = ['1:1', '16:9', '4:3', '3:4', 'free'];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">Crop</h1>
        <p className="mt-0.5 text-xs text-zinc-500">image.crop · 区域裁剪 + 预设比例</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* 参数面板 */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">X(px)</span>
            <input
              type="number"
              min={0}
              value={x}
              onChange={(e) => setX(Math.max(0, Number(e.target.value)))}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">Y(px)</span>
            <input
              type="number"
              min={0}
              value={y}
              onChange={(e) => setY(Math.max(0, Number(e.target.value)))}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">宽度(px)</span>
            <input
              type="number"
              min={1}
              value={width}
              onChange={(e) => setWidth(Math.max(1, Number(e.target.value)))}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">高度(px)</span>
            <input
              type="number"
              min={1}
              value={height}
              onChange={(e) => setHeight(Math.max(1, Number(e.target.value)))}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </label>
        </div>

        {/* 预设比例 */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-medium text-zinc-500">预设比例</span>
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              disabled={!inputInfo}
              className={`rounded border px-2.5 py-1 text-[11px] disabled:cursor-not-allowed disabled:opacity-40 ${
                preset === p
                  ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300'
                  : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-600'
              }`}
            >
              {p === 'free' ? '自由' : p}
            </button>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleCrop}
            disabled={!ready || !inputId || busy || width < 1 || height < 1}
            className="rounded-lg bg-indigo-600 px-6 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Crop 中…' : 'Crop'}
          </button>
        </div>

        {initError && <p className="text-xs text-red-400">初始化失败:{initError}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
        {inputInfo && outputInfo && (
          <p className="text-xs text-emerald-400">
            {inputInfo.width}×{inputInfo.height} → {outputInfo.width}×{outputInfo.height} · {formatBytes(inputInfo.size)} → {formatBytes(outputInfo.size)}
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
                        downloadBlob(
                          outputBlob,
                          `cropped-${outputInfo?.width ?? width}x${outputInfo?.height ?? height}.${(outputInfo?.format ?? 'png').toLowerCase()}`
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
