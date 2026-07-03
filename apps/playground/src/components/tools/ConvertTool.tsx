/**
 * W5.3 · Convert 工具页
 *
 * 导入图片 → 目标格式选择(PNG/JPEG/WebP/AVIF/GIF)+ 质量滑块 → 转换 → before/after 对比 + 下载
 * 调用 image.convert capability。
 */
import { useCallback, useEffect, useState } from 'react';
import type { AssetId, Workflow } from '@lokvis/sdk';
import { UploadBox } from '../toolkit/UploadBox';
import { PreviewBox } from '../toolkit/PreviewBox';
import { useLokvisRuntime } from '../toolkit/useLokvisRuntime';
import { downloadBlob, formatBytes, getImageInfo, imageInfoToMeta, type ImageInfo } from '../toolkit/download';

type Format = 'png' | 'jpeg' | 'webp' | 'avif' | 'gif';

export default function ConvertTool() {
  const { runtime, ready, error: initError } = useLokvisRuntime();
  const [inputId, setInputId] = useState<AssetId | null>(null);
  const [inputUrl, setInputUrl] = useState<string | null>(null);
  const [inputInfo, setInputInfo] = useState<ImageInfo | null>(null);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputInfo, setOutputInfo] = useState<ImageInfo | null>(null);
  const [format, setFormat] = useState<Format>('webp');
  const [quality, setQuality] = useState(90);
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

  const handleConvert = useCallback(async () => {
    if (!runtime || !inputId) return;
    setBusy(true);
    setError(null);
    try {
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
      const result = await runtime.run(wf, [inputId]);
      if (result.status === 'completed' && result.outputs[0]) {
        const blob = await runtime.exportAsset(result.outputs[0]);
        setOutputBlob(blob);
        setOutputInfo(await getImageInfo(blob));
      } else {
        setError(result.error ?? '转换失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [runtime, inputId, format, quality]);

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

  // PNG/GIF 为无损格式,quality 不适用
  const isLossless = format === 'png' || format === 'gif';

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">Convert</h1>
        <p className="mt-0.5 text-xs text-zinc-500">image.convert · 格式互转</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* 参数面板 */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">目标格式</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as Format)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="webp">WebP</option>
              <option value="avif">AVIF</option>
              <option value="jpeg">JPEG</option>
              <option value="png">PNG(无损)</option>
              <option value="gif">GIF</option>
            </select>
          </label>
          <label className={`flex flex-col gap-1 ${isLossless ? 'opacity-50' : ''}`}>
            <span className="text-[10px] font-medium text-zinc-500">
              质量:{quality}{isLossless ? '(无损格式无效)' : ''}
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
          <div className="flex items-end">
            <button
              onClick={handleConvert}
              disabled={!ready || !inputId || busy}
              className="w-full rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? '转换中…' : '转换'}
            </button>
          </div>
        </div>

        {initError && <p className="text-xs text-red-400">初始化失败:{initError}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
        {inputInfo && outputInfo && (
          <p className="text-xs text-emerald-400">
            {inputInfo.format} → {outputInfo.format} · {formatBytes(inputInfo.size)} → {formatBytes(outputInfo.size)}
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
                      onClick={() => downloadBlob(outputBlob, `converted.${format}`)}
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
