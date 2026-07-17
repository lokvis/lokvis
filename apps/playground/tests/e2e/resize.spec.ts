/**
 * W22.5 E2E · Resize 工具主流程
 *
 * 验证:上传 PNG → 点击 Resize → Output 区出现 Download 按钮。
 */
import { test, expect } from '@playwright/test';
import { uploadImage, runToolAndExpectOutput } from './helpers';

test.describe('Resize 工具', () => {
  test('上传图片后点击 Resize,输出区出现 Download 按钮', async ({ page }) => {
    await page.goto('/en/tools/resize');

    // 标题渲染(SSR ok 即可,client:only 内容稍后 hydrate)
    await expect(page.getByText('Resize', { exact: true })).toBeVisible();

    await uploadImage(page);
    await runToolAndExpectOutput(page, 'Resize');
  });
});
