/**
 * W22.5+ E2E · AVIF round-trip（T5）
 *
 * 验证 avif 编码端到端产出「真 AVIF」而非静默回退 PNG：
 *   - convert：上传 PNG → 选 AVIF → Convert → 下载文件 magic bytes 校验
 *   - compress：target-size 模式 + AVIF → 下载文件 magic bytes 校验
 *
 * Magic bytes（ISOBMFF 容器）：偏移 4 起为 `ftyp` box，偏移 8 起 major brand
 * 为 `avif`。PNG 的 magic 是 `89 50 4E 47`，若编码器静默回退 PNG 则此处必失败。
 *
 * ── 为何本地供给 wasm ─────────────────────────────────────────────
 * 实测 Chromium 无原生 AVIF 编码能力：`canvas.toBlob('image/avif')` 静默回退
 * PNG（blob.type === 'image/png'），故 AVIF 必走 engine-image 的 wasm 兜底路径
 * （encodeSmart → encodeAvifWasm → 私有 worker 内 fetch wasm 实例化 libavif）。
 * 默认 wasm URL 指向 jsdelivr 版本化地址（wasm 资产随 0.5.0 才发布），且 e2e
 * 浏览器沙箱无外网访问；因此用 `page.route` 把任意 `avif.wasm` 请求重定向到
 * 本地 engine-image 构建产物（dist/wasm/avif.wasm）。dedicated worker 的 fetch
 * 同样经页面网络栈被拦截。这样 e2e 自包含、可离线运行，并真实走通 worker +
 * wasm 编码全链路——恰恰是本特性（wasm 兜底）的核心验证，而非依赖发布状态。
 *
 * native 支持时「worker 未创建 / 不加载 wasm」的性能回归由单测覆盖
 * （wasm-encode.test.ts「avif 原生支持时不加载 wasm」+ avif-encoder.test.ts），
 * 不在此做网络层断言——页面 head 的 `<link rel="preload">` 会预取 avif.wasm，
 * 与「编码时是否创建 worker」是两件事，网络断言会误报。
 */
import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { uploadImage, clickDownloadAndReadBytes } from './helpers';

/** 本地 engine-image 构建产物中的单线程 avif wasm（T3 copy-wasm.mjs 落盘） */
const AVIF_WASM_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../packages/engine-image/dist/wasm/avif.wasm',
);

/** 断言字节流是合法 AVIF（ISOBMFF：`ftyp` box + `avif` major brand） */
function expectAvifMagic(bytes: Buffer): void {
  expect(bytes.length).toBeGreaterThan(12);
  expect(bytes.subarray(4, 8).toString('ascii')).toBe('ftyp');
  expect(bytes.subarray(8, 12).toString('ascii')).toBe('avif');
}

test.describe('AVIF round-trip', () => {
  test.beforeEach(async ({ page }) => {
    // 前置：本地 wasm 资产须已构建（pnpm --filter @lokvis/engine-image build）
    if (!existsSync(AVIF_WASM_PATH)) {
      throw new Error(
        `AVIF wasm 资产缺失：${AVIF_WASM_PATH}。先运行 pnpm --filter @lokvis/engine-image build`,
      );
    }
    // 把编码器对 avif.wasm 的 fetch（含 preload link 与 worker 内 fetch）
    // 重定向到本地产物，附带 CORS 与正确 MIME（wasm 实例化要求 application/wasm）
    await page.route('**/avif.wasm', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/wasm',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: readFileSync(AVIF_WASM_PATH),
      }),
    );
  });

  test('convert PNG → AVIF 产出真 AVIF（ftyp avif magic bytes）', async ({
    page,
  }) => {
    await page.goto('/en/tools/convert');
    await uploadImage(page);

    await page.getByLabel('Target format').selectOption('avif');

    const actionBtn = page.getByRole('button', { name: 'Convert' });
    await expect(actionBtn).toBeEnabled({ timeout: 15_000 });
    await actionBtn.click();

    const { bytes, filename } = await clickDownloadAndReadBytes(page);
    expect(filename).toBe('converted.avif');
    expectAvifMagic(bytes);
  });

  test('compress target-size + AVIF 产出真 AVIF（ftyp avif magic bytes）', async ({
    page,
  }) => {
    await page.goto('/en/tools/compress');
    await uploadImage(page);

    await page.getByLabel('Mode').selectOption('target');
    await page.getByLabel('Format').selectOption('avif');
    // target-size 数值输入是页面唯一的 number input（role=spinbutton）
    await page.getByRole('spinbutton').fill('50');

    const actionBtn = page.getByRole('button', { name: 'Compress' });
    await expect(actionBtn).toBeEnabled({ timeout: 15_000 });
    await actionBtn.click();

    const { bytes, filename } = await clickDownloadAndReadBytes(page);
    expect(filename).toBe('compressed.avif');
    expectAvifMagic(bytes);
  });
});
