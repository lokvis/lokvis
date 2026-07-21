/**
 * E2E 测试共享辅助(W22.5 / W22.6)
 *
 * 单图工具页(resize/crop/convert/compress/watermark)主流程一致:
 *   1. 打开工具页
 *   2. 上传 PNG 到隐藏 input[type=file]
 *   3. 等待 action 按钮启用(runtime 初始化 + importAsset 完成)
 *   4. 点击 action 按钮
 *   5. 等待 Output 区出现 Download 按钮(代表 outputBlob 已就绪)
 *
 * 批量工具(watermark-batch)流程不同,在各自 spec 内独立编写。
 *
 * PDF / Video 工具页为 stub-only(plugin-pdf / plugin-video 浏览器端为占位实现),
 * 实际执行必抛 "not implemented in stub";主流程为:
 *   1. 打开工具页
 *   2. 上传 fixture(PDF / MP4)
 *   3. 等待 action 按钮启用
 *   4. 点击 action 按钮
 *   5. 等待 amber 色 stub 错误横幅出现(PdfToolResultPanel / VideoToolResultPanel 渲染)
 *
 * Video 工具中 video-trim / video-thumbnail 的 action 按钮在 <video> 加载 metadata
 * 之前为 disabled,使用真实可解码 TEST_MP4 fixture(64×48 / 0.2s 黑色视频)。
 */
import { expect, type Page } from '@playwright/test';
import { TEST_PNG } from '../fixtures/images';
import { TEST_PDF } from '../fixtures/pdf';
import { TEST_MP4 } from '../fixtures/video';

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
  // 等待按钮可见且启用(runtime 初始化 + importAsset 完成后 disabled=false)。
  // 用 Playwright 原生 expect(locator).toBeEnabled() 而非手工 waitForFunction,
  // 让 auto-retrying + ARIA 引擎接管,避免在 DOM 结构变化时脆性匹配。
  await expect(actionBtn).toBeVisible({ timeout: 15_000 });
  await expect(actionBtn).toBeEnabled({ timeout: 15_000 });
  await actionBtn.click();

  // Output PreviewBox 的 Download 按钮(由 ToolResultPanel 渲染,
  // 仅在 outputBlob 就绪后出现)。UploadBox 也是 role=button,但文本不同。
  // Download 按钮文本 = "Download" (common.download,英文为 "Download")
  const downloadBtn = page
    .getByRole('button', { name: 'Download' })
    .first();
  await expect(downloadBtn).toBeVisible({ timeout: 20_000 });
}

/**
 * 上传 PDF 到工具页的 UploadBox(accept="application/pdf")。
 *
 * 与 uploadImage 对齐,使用 TEST_PDF fixture(3 对象 + xref + trailer)。
 */
export async function uploadPdf(page: Page): Promise<void> {
  const input = page.locator('input[type=file]').first();
  await input.setInputFiles({
    name: 'test.pdf',
    mimeType: 'application/pdf',
    buffer: TEST_PDF,
  });
}

/**
 * 上传 MP4 到工具页的 UploadBox(accept="video/*")。
 *
 * 使用 TEST_MP4 fixture(64×48 / 0.2s 黑色视频,Chrome 可解码 metadata)。
 * video-trim / video-thumbnail 等需要 <video> onLoadedMetadata 才能启用按钮的工具,
 * 必须用此真实可解码 fixture;其他 Video 工具同样使用,保持一致。
 */
export async function uploadVideo(page: Page): Promise<void> {
  const input = page.locator('input[type=file]').first();
  await input.setInputFiles({
    name: 'test.mp4',
    mimeType: 'video/mp4',
    buffer: TEST_MP4,
  });
}

/**
 * 等待并点击文本为 `buttonText` 的 action 按钮,然后等待 amber 色 stub
 * 错误横幅出现(代表 stub capability 抛错且 UI 已渲染提示)。
 *
 * 用于 PDF / Video 工具页(plugin-pdf / plugin-video 浏览器端为 stub):
 * PdfToolResultPanel / VideoToolResultPanel 在 tool.error 包含
 * "not implemented in stub" 时,渲染 amber 色 banner + 下方 stub hint 段落。
 *
 * 断言 stub hint 段落文本(由 i18n 字典控制,英文文案稳定):
 *   - PDF:   "PDF processing runs in Node (mcp-server). Browser plugin-pdf is stub-only."
 *   - Video: "Video processing runs in Node (mcp-server). Browser plugin-video is stub-only (ffmpeg.wasm ~30MB not loaded)."
 *
 * 不直接断言 banner 自身,因为 tool.error 的具体 capability 前缀可能调整;
 * stubHintText 由调用方按工具族传入。
 */
export async function runToolAndExpectStubError(
  page: Page,
  buttonText: string,
  stubHintText: string,
): Promise<void> {
  const actionBtn = page.getByRole('button', { name: buttonText });
  await expect(actionBtn).toBeVisible({ timeout: 15_000 });
  await expect(actionBtn).toBeEnabled({ timeout: 15_000 });
  await actionBtn.click();

  // amber banner 下方的 stub hint 段落(文本稳定且工具族内唯一)。
  const stubHint = page.getByText(stubHintText);
  await expect(stubHint).toBeVisible({ timeout: 20_000 });
}

/**
 * 等待 <video> 元素的 metadata 加载完成(duration > 0)。
 *
 * video-trim / video-thumbnail 的 action 按钮在 metadata 未加载时 disabled,
 * 需在调用 runToolAndExpectStubError 之前调用此辅助。
 *
 * 通过等待 durationLabel 文本(由 useVideoTool 写入)间接确认 metadata 已就绪。
 * durationLabel 的英文文案包含 "Duration" 关键词,与 label 文本一致。
 */
export async function waitForVideoMetadata(page: Page): Promise<void> {
  // useVideoTool 在 metadata 加载后 setInputDuration,durationLabel 随即渲染。
  // 等待 10s 以容忍慢速解码(实测 64×48 / 0.2s MP4 在 <100ms 完成)。
  const durationLabel = page.getByText(/Duration|时长/).first();
  await expect(durationLabel).toBeVisible({ timeout: 10_000 });
}
