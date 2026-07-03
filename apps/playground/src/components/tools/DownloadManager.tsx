/**
 * W5.7 · Download Manager 工具页
 *
 * 接收多个 Blob → 单个下载或批量下载(逐个触发,间隔 200ms 避免浏览器拦截)。
 * 不引入 JSZip(需新增依赖,超出范围),用浏览器原生 downloadBlob 实现简化版。
 *
 * demo 数据:用 canvas 生成 2 张示例 PNG Blob,供无真实输入时演示。
 */
import { useCallback, useState } from 'react';
import { downloadBlob, formatBytes } from '../toolkit/download';

interface DownloadItem {
  id: string;
  blob: Blob;
  filename: string;
  size: number;
  downloaded: boolean;
}

// 延迟工具,避免浏览器拦截多下载
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// 用 canvas 生成示例图片 Blob(供 demo)
// toBlob 回调可能返回 null(某些 Safari 场景或 canvas 被污染),
// 此时拒绝 Promise 让调用方走 catch 分支(#7 修复)
async function makeDemoImage(text: string, color: string): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 100;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 200, 100);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 100, 55);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('canvas.toBlob returned null'));
    }, 'image/png');
  });
}

let idSeq = 0;
const nextId = () => `dl-${Date.now()}-${(idSeq++).toString(36)}`;

export default function DownloadManager() {
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [batchDownloading, setBatchDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 添加测试文件:生成 2 个示例 Blob
  const addDemoFiles = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        makeDemoImage('Demo A', '#6366f1'),
        makeDemoImage('Demo B', '#10b981'),
      ]);
      const ts = Date.now();
      setItems((prev) => [
        ...prev,
        { id: nextId(), blob: a, filename: `demo-a-${ts}.png`, size: a.size, downloaded: false },
        { id: nextId(), blob: b, filename: `demo-b-${ts}.png`, size: b.size, downloaded: false },
      ]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // 单个下载:触发后标记为已下载
  const downloadOne = useCallback((item: DownloadItem) => {
    downloadBlob(item.blob, item.filename);
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, downloaded: true } : it)));
  }, []);

  // 全部下载:逐个触发,间隔 200ms 避免浏览器拦截
  const downloadAll = useCallback(async () => {
    if (batchDownloading) return;
    const pending = items.filter((i) => !i.downloaded);
    if (pending.length === 0) return;
    setBatchDownloading(true);
    setError(null);
    try {
      for (const item of pending) {
        downloadBlob(item.blob, item.filename);
        setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, downloaded: true } : it)));
        await sleep(200);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBatchDownloading(false);
    }
  }, [items, batchDownloading]);

  const clearAll = useCallback(() => {
    setItems([]);
    setError(null);
  }, []);

  const totalSize = items.reduce((sum, i) => sum + i.size, 0);
  const downloadedCount = items.filter((i) => i.downloaded).length;
  const allDownloaded = items.length > 0 && downloadedCount === items.length;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">Download Manager</h1>
        <p className="mt-0.5 text-xs text-zinc-500">单/批量下载管理</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* 操作区 */}
        <div className="flex gap-2">
          <button
            onClick={addDemoFiles}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            添加测试文件
          </button>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* 下载项列表 */}
        <div className="flex flex-col gap-2">
          {items.length === 0 ? (
            <p className="py-8 text-center text-xs text-zinc-600">
              无下载项,点击「添加测试文件」生成示例
            </p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-zinc-200">{item.filename}</p>
                  <p className="text-[10px] text-zinc-500">{formatBytes(item.size)}</p>
                </div>
                <span
                  className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    item.downloaded
                      ? 'bg-emerald-600/20 text-emerald-300'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {item.downloaded ? '已下载' : '待下载'}
                </span>
                <button
                  onClick={() => downloadOne(item)}
                  className="w-12 text-right text-[10px] text-indigo-400 hover:text-indigo-300"
                >
                  下载
                </button>
              </div>
            ))
          )}
        </div>

        {/* 底部统计 + 批量操作 */}
        {items.length > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-500">
                共 {items.length} 项 · 已下载 {downloadedCount}
              </span>
              <span className="text-[10px] text-zinc-500">总大小 {formatBytes(totalSize)}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={downloadAll}
                disabled={batchDownloading || allDownloaded}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {batchDownloading ? '下载中…' : '全部下载'}
              </button>
              <button
                onClick={clearAll}
                className="rounded-lg border border-zinc-700 px-4 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
              >
                清空
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
