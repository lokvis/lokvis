/**
 * W22.5 E2E · Watermark Batch 工具主流程
 *
 * 验证:上传 3 个 PNG → 点击 "Watermark all" → 队列全部变为 Done 状态。
 *
 * WatermarkBatchTool 不通过 ToolResultPanel 渲染 Download 按钮,
 * 每个 item 完成后状态徽章显示 "Done"(batch.statusDone,英文 "Done"),
 * 故断言依据 Done 徽章数量。
 */
import { test, expect } from '@playwright/test';
import { TEST_PNG, TEST_PNG_BLUE } from '../fixtures/images';

test.describe('Watermark Batch 工具', () => {
  test('上传 3 个 PNG,全部加水印后状态变为 Done', async ({ page }) => {
    await page.goto('/en/tools/watermark-batch');

    // 等待页面 hydrate(client:only)—— UploadBox 的 hidden input 出现
    await page.locator('input[type=file]').first().waitFor({ state: 'attached', timeout: 15_000 });

    // 上传 3 个文件(UploadBox multiple)。
    // 注意:WatermarkBatchTool 的 action 按钮文本随状态切换:
    //   - 队列空 → "Completed"(初始)
    //   - hasPending → "Watermark all"
    //   - processing → "Processing…"
    // 故上传前不能通过 "Watermark all" 文本断言按钮存在,先上传再等文本。
    const input = page.locator('input[type=file]').first();
    await input.setInputFiles([
      { name: 'a.png', mimeType: 'image/png', buffer: TEST_PNG },
      { name: 'b.png', mimeType: 'image/png', buffer: TEST_PNG_BLUE },
      { name: 'c.png', mimeType: 'image/png', buffer: TEST_PNG },
    ]);

    // 等待队列出现 3 个 item(由文件名渲染)
    await expect(page.getByText('a.png', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('b.png', { exact: true })).toBeVisible();
    await expect(page.getByText('c.png', { exact: true })).toBeVisible();

    // 此时 hasPending=true,action 按钮文本为 "Watermark all"。
    // 等其启用(runtime ready + hasPending + !processing + !textEmpty)
    const processBtn = page.getByRole('button', { name: 'Watermark all' });
    // 用 Playwright 原生 expect(locator).toBeEnabled() 而非手工 waitForFunction,
    // 让 auto-retrying + ARIA 引擎接管,避免在 DOM 结构变化时脆性匹配。
    await expect(processBtn).toBeVisible({ timeout: 15_000 });
    await expect(processBtn).toBeEnabled({ timeout: 15_000 });
    await processBtn.click();

    // 等待 3 个 Done 状态徽章出现(每个 item 完成时状态由 Pending → Processing → Done)
    // StatusBadge 渲染为 <span>,英文文案 "Done"
    await expect(page.locator('span:has-text("Done")')).toHaveCount(3, { timeout: 60_000 });
  });
});
