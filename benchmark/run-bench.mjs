/**
 * Benchmark 运行器(D2)—— vite dev server + Playwright chromium headless。
 *
 * 矩阵:【操作(convert/compress/resize) × 源格式 × 目标格式 × 质量 60/80/95】,
 * 每组合逐图 1 次预热 + BENCH_RUNS(默认 3)次计时取中位数。
 *
 * 语料默认取每类前若干张(deterministic 子集,控制单次时长);
 * BENCH_FULL=1 使用全部 32 张。原始结果写 results/raw.json。
 *
 * AVIF 目标:chromium canvas 无原生编码器时由 engine-image 自动走 WASM
 * 兜底(jsdelivr 版本锁定),结果的 params.encoder 记录 native/wasm 以便区分。
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

const RUNS = Number(process.env.BENCH_RUNS ?? 3);
const FULL = process.env.BENCH_FULL === '1';

/** 默认子集:每类取前 N 张(控制单次运行时长;BENCH_FULL=1 跑全量) */
const SUBSET_PER_CATEGORY = { photo: 4, illustration: 3, screenshot: 3, transparent: 2, large: 2 };

const QUALITIES = [60, 80, 95];

function buildMatrix() {
  const cases = [];
  const convertPairs = [
    ['png', 'jpeg'],
    ['png', 'webp'],
    ['png', 'avif'],
    ['jpeg', 'webp'],
    ['jpeg', 'avif'],
  ];
  for (const [from, to] of convertPairs) {
    for (const quality of QUALITIES) cases.push({ operation: 'convert', from, to, quality, runs: RUNS });
  }
  for (const fmt of ['jpeg', 'webp']) {
    for (const quality of QUALITIES) cases.push({ operation: 'compress', from: fmt, to: fmt, quality, runs: RUNS });
  }
  // resize:50% 缩小,输出格式跟随源(引擎 inferFormat),quality 引擎默认
  for (const fmt of ['png', 'jpeg']) cases.push({ operation: 'resize', from: fmt, to: fmt, quality: 95, runs: RUNS });
  return cases;
}

function pickImages(manifest) {
  if (FULL) return manifest.images;
  const counters = {};
  return manifest.images.filter((img) => {
    counters[img.category] = (counters[img.category] ?? 0) + 1;
    return counters[img.category] <= (SUBSET_PER_CATEGORY[img.category] ?? 0);
  });
}

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function main() {
  const manifest = JSON.parse(readFileSync(join(here, 'corpus/manifest.json'), 'utf8'));
  const images = pickImages(manifest).map(({ id, file, category }) => ({
    id,
    file: `corpus/${file}`,
    category,
  }));
  const cases = buildMatrix();
  console.log(`Benchmark: ${cases.length} cases x ${images.length} images x ${RUNS} runs (+1 warmup each)`);

  const server = await createServer({
    configFile: false,
    root: here,
    logLevel: 'warn',
    server: { port: 0, fs: { allow: [repoRoot] } },
  });
  await server.listen();
  const port = server.httpServer.address().port;

  const browser = await chromium.launch();
  try {
    /** 每个 case 用独立 page:隔离 renderer 内存(连续 WASM AVIF 编码会累积 OOM 崩溃) */
    const openHarness = async () => {
      const page = await browser.newPage();
      page.on('pageerror', (e) => console.error('[page]', e.message));
      await page.goto(`http://localhost:${port}/harness/`);
      await page.waitForFunction(() => typeof window.__bench === 'object', undefined, {
        timeout: 30_000,
      });
      return page;
    };

    let page = await openHarness();
    const { nativeEncodeSupport } = await page.evaluate(() => window.__bench.init());
    console.log('Native encode support:', JSON.stringify(nativeEncodeSupport));

    const results = [];
    for (const [i, combo] of cases.entries()) {
      const label = `${combo.operation} ${combo.from}->${combo.to} q${combo.quality}`;
      process.stdout.write(`[${i + 1}/${cases.length}] ${label} ... `);
      // WASM AVIF 编码 4000x2400 单次 >10s 且内存峰值高,large 类只跑原生编码路径
      const caseImages =
        combo.to === 'avif' && !nativeEncodeSupport.avif
          ? images.filter((img) => img.category !== 'large')
          : images;
      const t0 = Date.now();
      let perImage;
      try {
        perImage = await page.evaluate(
          ([c, imgs]) => window.__bench.runCase(c, imgs),
          [combo, caseImages]
        );
      } catch (e) {
        console.log(`CRASH (${String(e.message).slice(0, 80)}), recreating page`);
        await page.close().catch((err) => console.debug("page.close failed:", err));
        page = await openHarness();
        results.push({
          ...combo,
          encoder: combo.to === 'avif' && !nativeEncodeSupport.avif ? 'wasm' : 'native',
          skipped: true,
          skipReason: `renderer crashed: ${String(e.message).slice(0, 200)}`,
          aggregate: null,
          images: [],
        });
        continue;
      }
      // case 间重建 page,避免跨 case 内存累积影响计时与稳定性
      await page.close().catch((err) => console.debug("page.close failed:", err));
      page = await openHarness();
      const ok = perImage.filter((r) => !r.error);
      const failed = perImage.filter((r) => r.error);
      const aggregate = ok.length
        ? {
            imageCount: ok.length,
            encodeMsMedian: Math.round(median(ok.map((r) => r.encodeMsMedian)) * 100) / 100,
            bytesRatioMedian:
              Math.round(median(ok.map((r) => r.outputBytes / r.sourceBytes)) * 10000) / 10000,
            ssimMean: ok.some((r) => r.ssim != null)
              ? Math.round(
                  (ok.reduce((s, r) => s + (r.ssim ?? 0), 0) / ok.filter((r) => r.ssim != null).length) * 10000
                ) / 10000
              : null,
          }
        : null;
      const encoder =
        combo.to === 'avif' && !nativeEncodeSupport.avif ? 'wasm' : 'native';
      results.push({
        ...combo,
        encoder,
        skipped: ok.length === 0,
        skipReason: ok.length === 0 ? (failed[0]?.error ?? 'all images failed') : undefined,
        aggregate,
        images: perImage,
      });
      console.log(
        ok.length === 0
          ? `SKIP (${failed[0]?.error?.slice(0, 80)})`
          : `median ${aggregate.encodeMsMedian}ms, ratio ${aggregate.bytesRatioMedian}, ssim ${aggregate.ssimMean ?? '-'} (${Date.now() - t0}ms)`
      );
      if (failed.length && ok.length) {
        console.warn(`  WARN ${failed.length} image(s) failed: ${failed.map((f) => f.id).join(', ')}`);
      }
    }

    const enginePkg = JSON.parse(
      readFileSync(join(repoRoot, 'packages/engine-image/package.json'), 'utf8')
    );
    const playwrightPkg = JSON.parse(
      readFileSync(require.resolve('@playwright/test/package.json'), 'utf8')
    );
    const raw = {
      generatedAt: new Date().toISOString(),
      engine: 'canvas',
      engineVersion: enginePkg.version,
      browser: `chromium-${browser.version()}`,
      playwrightVersion: playwrightPkg.version,
      runsPerImage: RUNS,
      corpus: { name: manifest.name, version: manifest.version, imageCount: images.length },
      nativeEncodeSupport,
      results,
    };
    const outDir = join(here, 'results');
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, 'raw.json');
    writeFileSync(outPath, `${JSON.stringify(raw, null, 2)}\n`);
    console.log(`\nRaw results written to ${outPath}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
