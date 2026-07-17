/**
 * W22.5 E2E · Watermark 工具主流程
 *
 * 验证:上传 PNG → 点击 Watermark → Output 区出现 Download 按钮。
 * 默认水印文字 "Lokvis",位置 bottom-right。
 */
import { test, expect } from '@playwright/test';
import { uploadImage, runToolAndExpectOutput } from './helpers';

test.describe('Watermark 工具', () => {
  test('上传图片后点击 Watermark,输出区出现 Download 按钮', async ({ page }) => {
    await page.goto('/en/tools/watermark');

    await expect(page.getByText('Watermark', { exact: true })).toBeVisible();

    await uploadImage(page);
    await runToolAndExpectOutput(page, 'Watermark');
  });
});
