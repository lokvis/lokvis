/**
 * W22.5 E2E · Crop 工具主流程
 *
 * 验证:上传 PNG → 点击 Crop → Output 区出现 Download 按钮。
 * 默认裁剪框 200×200,256×256 输入足够覆盖。
 */
import { test, expect } from '@playwright/test';
import { uploadImage, runToolAndExpectOutput } from './helpers';

test.describe('Crop 工具', () => {
  test('上传图片后点击 Crop,输出区出现 Download 按钮', async ({ page }) => {
    await page.goto('/en/tools/crop');

    await expect(page.getByText('Crop', { exact: true })).toBeVisible();

    await uploadImage(page);
    await runToolAndExpectOutput(page, 'Crop');
  });
});
