/**
 * W22.6 E2E · PDF 工具页 stub 提示
 *
 * 浏览器版 plugin-pdf 为 stub(engine-pdf 浏览器端不加载 pdf-lib),
 * 任何 PDF capability 调用都会抛 "not implemented in stub" 错误。
 *
 * PdfToolResultPanel 在 tool.error 包含 "not implemented in stub" 时,
 * 渲染 amber 色错误横幅 + 下方 stub hint 段落(英文文案:
 * "PDF processing runs in Node (mcp-server). Browser plugin-pdf is stub-only.")。
 *
 * 本 spec 覆盖 6 个 PDF 工具页,验证:
 *   1. 上传 PDF fixture 后 action 按钮启用(runtime ready + importAsset 完成)
 *   2. 点击 action 按钮后 amber 色 stub hint 段落出现
 *
 * 不验证具体 capability 抛错文案(前缀可能调整),只验证稳定 i18n 文案。
 */
import { test, expect } from '@playwright/test';
import { uploadPdf, runToolAndExpectStubError } from './helpers';
import { ui } from '../../src/i18n/ui';

/**
 * W22.7: stub hint 文案从 i18n/ui.ts 直接 import,避免硬编码常量与字典脱钩。
 *
 * 字典里 `pdf.stubHint.en` 是 PdfToolResultPanel 渲染英文文案的真正来源,
 * 通过 import 锁定,字典改动后 spec 同步失败而非静默漂移。
 */
const PDF_STUB_HINT = ui['pdf.stubHint'].en!;

test.describe('PDF 工具页 stub 提示', () => {
  test('pdf-compress 上传 PDF 后点击 Compress,显示 amber stub 提示', async ({ page }) => {
    await page.goto('/en/tools/pdf-compress');
    await expect(page).toHaveURL(/\/tools\/pdf-compress/);
    // 等待页面 hydrate(client:only)— hidden input 出现
    await page.locator('input[type=file]').first().waitFor({ state: 'attached', timeout: 15_000 });

    await uploadPdf(page);
    await runToolAndExpectStubError(page, 'Compress', PDF_STUB_HINT);
  });

  test('pdf-rotate 上传 PDF 后点击 Rotate,显示 amber stub 提示', async ({ page }) => {
    await page.goto('/en/tools/pdf-rotate');
    await expect(page).toHaveURL(/\/tools\/pdf-rotate/);
    await page.locator('input[type=file]').first().waitFor({ state: 'attached', timeout: 15_000 });

    await uploadPdf(page);
    await runToolAndExpectStubError(page, 'Rotate', PDF_STUB_HINT);
  });

  test('pdf-watermark 上传 PDF 后点击 Watermark,显示 amber stub 提示', async ({ page }) => {
    await page.goto('/en/tools/pdf-watermark');
    await expect(page).toHaveURL(/\/tools\/pdf-watermark/);
    await page.locator('input[type=file]').first().waitFor({ state: 'attached', timeout: 15_000 });

    await uploadPdf(page);
    await runToolAndExpectStubError(page, 'Watermark', PDF_STUB_HINT);
  });

  test('pdf-split 上传 PDF 后点击 Split,显示 amber stub 提示', async ({ page }) => {
    await page.goto('/en/tools/pdf-split');
    await expect(page).toHaveURL(/\/tools\/pdf-split/);
    await page.locator('input[type=file]').first().waitFor({ state: 'attached', timeout: 15_000 });

    await uploadPdf(page);
    await runToolAndExpectStubError(page, 'Split', PDF_STUB_HINT);
  });

  test('pdf-merge 上传 PDF 后点击 Merge,显示 amber stub 提示', async ({ page }) => {
    await page.goto('/en/tools/pdf-merge');
    await expect(page).toHaveURL(/\/tools\/pdf-merge/);
    await page.locator('input[type=file]').first().waitFor({ state: 'attached', timeout: 15_000 });

    await uploadPdf(page);
    await runToolAndExpectStubError(page, 'Merge', PDF_STUB_HINT);
  });

  test('pdf-extract-pages 上传 PDF 后点击 Extract,显示 amber stub 提示', async ({ page }) => {
    await page.goto('/en/tools/pdf-extract-pages');
    await expect(page).toHaveURL(/\/tools\/pdf-extract-pages/);
    await page.locator('input[type=file]').first().waitFor({ state: 'attached', timeout: 15_000 });

    await uploadPdf(page);
    await runToolAndExpectStubError(page, 'Extract', PDF_STUB_HINT);
  });
});
