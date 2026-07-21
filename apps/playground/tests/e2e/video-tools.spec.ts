/**
 * W22.6 E2E · Video 工具页 stub 提示
 *
 * 浏览器版 plugin-video 为 stub(engine-video 浏览器端不加载 ffmpeg.wasm ~30MB),
 * 任何 Video capability 调用都会抛 "not implemented in stub" 错误。
 *
 * VideoToolResultPanel 在 tool.error 包含 "not implemented in stub" 时,
 * 渲染 amber 色错误横幅 + 下方 stub hint 段落(英文文案:
 * "Video processing runs in Node (mcp-server). Browser plugin-video is stub-only
 * (ffmpeg.wasm ~30MB not loaded).")。
 *
 * 本 spec 覆盖 5 个 Video 工具页,验证:
 *   1. 上传 MP4 fixture 后 action 按钮启用(runtime ready + importAsset 完成)
 *   2. 点击 action 按钮后 amber 色 stub hint 段落出现
 *
 * video-trim / video-thumbnail 的 action 按钮在 <video> 加载 metadata
 * 之前为 disabled,故先等待 durationLabel 渲染(由 useVideoTool 在
 * onLoadedMetadata 回调中 setInputDuration 后触发)。
 *
 * 不验证具体 capability 抛错文案(前缀可能调整),只验证稳定 i18n 文案。
 */
import { test, expect } from '@playwright/test';
import { uploadVideo, runToolAndExpectStubError, waitForVideoMetadata } from './helpers';
import { ui } from '../../src/i18n/ui';

/**
 * W22.7: stub hint 文案从 i18n/ui.ts 直接 import,避免硬编码常量与字典脱钩。
 *
 * 字典里 `video.stubHint.en` 是 VideoToolResultPanel 渲染英文文案的真正来源,
 * 通过 import 锁定,字典改动后 spec 同步失败而非静默漂移。
 */
const VIDEO_STUB_HINT = ui['video.stubHint'].en!;

test.describe('Video 工具页 stub 提示', () => {
  test('video-compress 上传 MP4 后点击 Compress,显示 amber stub 提示', async ({ page }) => {
    await page.goto('/en/tools/video-compress');
    await expect(page).toHaveURL(/\/tools\/video-compress/);
    await page.locator('input[type=file]').first().waitFor({ state: 'attached', timeout: 15_000 });

    await uploadVideo(page);
    // video-compress 不依赖 metadata,button 在 importAsset 完成后即可启用
    await runToolAndExpectStubError(page, 'Compress', VIDEO_STUB_HINT);
  });

  test('video-transcode 上传 MP4 后点击 Transcode,显示 amber stub 提示', async ({ page }) => {
    await page.goto('/en/tools/video-transcode');
    await expect(page).toHaveURL(/\/tools\/video-transcode/);
    await page.locator('input[type=file]').first().waitFor({ state: 'attached', timeout: 15_000 });

    await uploadVideo(page);
    // video-transcode 不依赖 metadata,button 在 importAsset 完成后即可启用
    await runToolAndExpectStubError(page, 'Transcode', VIDEO_STUB_HINT);
  });

  test('video-trim 上传 MP4 后点击 Trim,显示 amber stub 提示', async ({ page }) => {
    await page.goto('/en/tools/video-trim');
    await expect(page).toHaveURL(/\/tools\/video-trim/);
    await page.locator('input[type=file]').first().waitFor({ state: 'attached', timeout: 15_000 });

    await uploadVideo(page);
    // video-trim 的 action 按钮在 metadata 未加载时 disabled,
    // 需等待 <video> onLoadedMetadata 触发 setInputDuration 后再点击。
    await waitForVideoMetadata(page);
    await runToolAndExpectStubError(page, 'Trim', VIDEO_STUB_HINT);
  });

  test('video-to-gif 上传 MP4 后点击 Convert,显示 amber stub 提示', async ({ page }) => {
    await page.goto('/en/tools/video-to-gif');
    await expect(page).toHaveURL(/\/tools\/video-to-gif/);
    await page.locator('input[type=file]').first().waitFor({ state: 'attached', timeout: 15_000 });

    await uploadVideo(page);
    // video-to-gif 默认 useRange=false,不依赖 metadata;button 在 importAsset 完成后即可启用
    await runToolAndExpectStubError(page, 'Convert', VIDEO_STUB_HINT);
  });

  test('video-thumbnail 上传 MP4 后点击 Capture,显示 amber stub 提示', async ({ page }) => {
    await page.goto('/en/tools/video-thumbnail');
    await expect(page).toHaveURL(/\/tools\/video-thumbnail/);
    await page.locator('input[type=file]').first().waitFor({ state: 'attached', timeout: 15_000 });

    await uploadVideo(page);
    // video-thumbnail 的 action 按钮在 metadata 未加载时 disabled,
    // 需等待 <video> onLoadedMetadata 触发 setInputDuration 后再点击。
    await waitForVideoMetadata(page);
    await runToolAndExpectStubError(page, 'Capture', VIDEO_STUB_HINT);
  });
});
