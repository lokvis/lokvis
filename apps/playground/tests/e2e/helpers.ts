/**
 * E2E 测试共享辅助(W22.5)
 *
 * 单图工具页(resize/crop/convert/compress/watermark)主流程一致:
 *   1. 打开工具页
 *   2. 上传 PNG 到隐藏 input[type=file]
 *   3. 等待 action 按钮启用(runtime 初始化 + importAsset 完成)
 *   4. 点击 action 按钮
 *   5. 等待 Output 区出现 Download 按钮(代表 outputBlob 已就绪)
 *
 * 批量工具(watermark-batch)流程不同,在各自 spec 内独立编写。
 */
import type { Page } from '@playwright/test';
import { TEST_PNG } from '../fixtures/images';

/**
 * 上传 PNG 到工具页的 UploadBox。
 *
 * UploadBox 内部用 hidden `input[type=file]` + 点击触发,Playwright
 * 可直接对隐藏 input 调用 setInputFiles 注入文件。
 */
export async function uploadImage(page: Page): Promise<void> {
  const input = page.locator('input[type=file]').first();
  await input.setInputFiles({
    name: 'test.png',
    mimeType: 'image/png',
    buffer: TEST_PNG,
  });
}

/**
 * 等待并点击文本为 `buttonText` 的 action 按钮,然后等待 Output
 * PreviewBox 的 Download 按钮出现(代表 output 已生成)。
 *
 * 仅适用于单图工具页(由 ToolResultPanel 渲染 Download 按钮)。
 */
export async function runToolAndExpectOutput(
  page: Page,
  buttonText: string,
): Promise<void> {
  // action 按钮位于参数面板下方的居中 div,文本即 buttonText
  const actionBtn = page.getByRole('button', { name: buttonText });
  await actionBtn.waitFor({ state: 'visible' });
  // 等待按钮启用(runtime 初始化 + importAsset 完成后 disabled=false)
  await actionBtn.waitFor({ state: 'attached' });

  // 等待按钮不再 disabled(setInputFiles 后异步 import,可能有短暂窗口)
  await page.waitForFunction(
    (text) => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        if (b.textContent?.trim() === text) return !b.disabled;
      }
      return false;
    },
    buttonText,
    { timeout: 15_000 },
  );

  await actionBtn.click();

  // Output PreviewBox 的 Download 按钮(由 ToolResultPanel 渲染,
  // 仅在 outputBlob 就绪后出现)。UploadBox 也是 role=button,但文本不同。
  // Download 按钮文本 = "Download" (common.download,英文为 "Download")
  const downloadBtn = page
    .getByRole('button', { name: 'Download' })
    .first();
  await downloadBtn.waitFor({ state: 'visible', timeout: 20_000 });
}
