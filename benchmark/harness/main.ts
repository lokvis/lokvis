/**
 * Benchmark harness(D2)—— 在真实 chromium 内执行 engine-image 操作矩阵。
 *
 * 由 run-bench.mjs 经 Playwright page.evaluate 驱动:
 * - `__bench.init()`:探测编码支持(native map)
 * - `__bench.runCase(combo, images)`:对一组语料图执行一个矩阵组合,
 *   每图 1 次预热 + N 次计时取中位数,输出 encodeMs/体积/简版 SSIM。
 *
 * 源格式变体(jpeg/webp)在页内从规范 PNG 源派生(convert q90)并缓存,
 * 保证所有源变体来自同一规范源。
 */
import { compress, convert, resize, detectFormatSupport } from '@lokvis/engine-image';

type SourceFormat = 'png' | 'jpeg' | 'webp';

interface Combo {
  operation: 'convert' | 'compress' | 'resize';
  from: SourceFormat;
  to: string;
  quality: number;
  runs: number;
}

interface ImageRef {
  id: string;
  file: string;
  category: string;
}

const sourceCache = new Map<string, Blob>();

async function getSource(img: ImageRef, format: SourceFormat): Promise<Blob> {
  const key = `${img.id}:${format}`;
  const hit = sourceCache.get(key);
  if (hit) return hit;
  let blob: Blob;
  if (format === 'png') {
    const res = await fetch(`/${img.file}`);
    if (!res.ok) throw new Error(`fetch ${img.file}: HTTP ${res.status}`);
    blob = await res.blob();
  } else {
    blob = await convert(await getSource(img, 'png'), { format, quality: 90 });
  }
  sourceCache.set(key, blob);
  return blob;
}

// ── 简版灰度 SSIM(降采样至最长边 256,8x8 窗口均值) ──────────────
const SSIM_MAX_EDGE = 256;

async function toGray(blob: Blob, w: number, h: number): Promise<Float64Array> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const gray = new Float64Array(w * h);
    for (let i = 0; i < w * h; i++) {
      gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    }
    return gray;
  } finally {
    bitmap.close?.();
  }
}

function ssimWindows(a: Float64Array, b: Float64Array, w: number, h: number): number {
  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;
  const win = 8;
  let sum = 0;
  let count = 0;
  for (let wy = 0; wy + win <= h; wy += win) {
    for (let wx = 0; wx + win <= w; wx += win) {
      let ma = 0;
      let mb = 0;
      for (let y = 0; y < win; y++) {
        for (let x = 0; x < win; x++) {
          const i = (wy + y) * w + wx + x;
          ma += a[i];
          mb += b[i];
        }
      }
      const n = win * win;
      ma /= n;
      mb /= n;
      let va = 0;
      let vb = 0;
      let cov = 0;
      for (let y = 0; y < win; y++) {
        for (let x = 0; x < win; x++) {
          const i = (wy + y) * w + wx + x;
          va += (a[i] - ma) ** 2;
          vb += (b[i] - mb) ** 2;
          cov += (a[i] - ma) * (b[i] - mb);
        }
      }
      va /= n - 1;
      vb /= n - 1;
      cov /= n - 1;
      sum += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      count++;
    }
  }
  return count ? sum / count : 1;
}

async function computeSsim(source: Blob, output: Blob): Promise<number> {
  const probe = await createImageBitmap(source);
  const scale = Math.min(1, SSIM_MAX_EDGE / Math.max(probe.width, probe.height));
  const w = Math.max(1, Math.round(probe.width * scale));
  const h = Math.max(1, Math.round(probe.height * scale));
  probe.close?.();
  const [ga, gb] = await Promise.all([toGray(source, w, h), toGray(output, w, h)]);
  return ssimWindows(ga, gb, w, h);
}

// ── 矩阵组合执行 ────────────────────────────────────────────────
function runOperation(combo: Combo, source: Blob, sourceW: number, sourceH: number): Promise<Blob> {
  switch (combo.operation) {
    case 'convert':
      return convert(source, { format: combo.to, quality: combo.quality });
    case 'compress':
      return compress(source, { format: combo.to, quality: combo.quality });
    case 'resize':
      return resize(source, {
        width: Math.round(sourceW / 2),
        height: Math.round(sourceH / 2),
        maintainAspectRatio: true,
        fit: 'contain',
      });
  }
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const bench = {
  async init() {
    const support = await detectFormatSupport();
    return { nativeEncodeSupport: support };
  },

  /** 执行一个组合;单图失败(如编码器不支持)记 error,不中断整组 */
  async runCase(combo: Combo, images: ImageRef[]) {
    const perImage = [];
    for (const img of images) {
      try {
        const source = await getSource(img, combo.from);
        const probe = await createImageBitmap(source);
        const sourceW = probe.width;
        const sourceH = probe.height;
        probe.close?.();

        await runOperation(combo, source, sourceW, sourceH); // 预热(JIT/解码缓存)
        const runsMs: number[] = [];
        let output: Blob | undefined;
        for (let r = 0; r < combo.runs; r++) {
          const t0 = performance.now();
          output = await runOperation(combo, source, sourceW, sourceH);
          runsMs.push(performance.now() - t0);
        }
        const ssim = combo.operation === 'resize' ? null : await computeSsim(source, output!);
        perImage.push({
          id: img.id,
          category: img.category,
          sourceBytes: source.size,
          outputBytes: output!.size,
          encodeMsRuns: runsMs.map((v) => Math.round(v * 100) / 100),
          encodeMsMedian: Math.round(median(runsMs) * 100) / 100,
          ssim: ssim === null ? null : Math.round(ssim * 10000) / 10000,
        });
      } catch (e) {
        perImage.push({ id: img.id, category: img.category, error: String(e) });
      }
    }
    return perImage;
  },
};

declare global {
  interface Window {
    __bench: typeof bench;
  }
}

window.__bench = bench;
