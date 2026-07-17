/**
 * W22.5 E2E · Compress 工具主流程
 *
 * 验证:上传 PNG → 点击 Compress → Output 区出现 Download 按钮。
 * 默认模式 quality=85、format=smart(PNG 含透明,实际输出 PNG)。
 */
import { test, expect } from '@playwright/test';
import { uploadImage, runToolAndExpectOutput } from './helpers';

test.describe('Compress 工具', () => {
  test('上传图片后点击 Compress,输出区出现 Download 按钮', async ({ page }) => {
    await page.goto('/en/tools/compress');

    await expect(page.getByText('Compress', { exact: true })).toBeVisible();

    await uploadImage(page);
    await runToolAndExpectOutput(page, 'Compress');
  });
});
