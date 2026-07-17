/**
 * W22.5 E2E · Convert 工具主流程
 *
 * 验证:上传 PNG → 点击 Convert(默认转 WebP)→ Output 区出现 Download 按钮。
 */
import { test, expect } from '@playwright/test';
import { uploadImage, runToolAndExpectOutput } from './helpers';

test.describe('Convert 工具', () => {
  test('上传图片后点击 Convert,输出区出现 Download 按钮', async ({ page }) => {
    await page.goto('/en/tools/convert');

    await expect(page.getByText('Convert', { exact: true })).toBeVisible();

    await uploadImage(page);
    await runToolAndExpectOutput(page, 'Convert');
  });
});
