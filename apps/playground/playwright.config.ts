/**
 * Playwright 配置(W22.5)
 *
 * E2E 测试覆盖 6 个工具页主流程:resize / crop / convert / compress /
 * watermark / watermark-batch。
 *
 * - baseURL: 与 astro.config.mjs 的 server.port 一致(5601),默认 lang=en
 * - webServer: 自动拉起 `astro dev`,首次启动允许 60s
 * - 仅启用 chromium project(单浏览器覆盖,节省 CI 时间;
 *   Firefox 降级场景已有 BrowserSupportBanner 单测覆盖)
 * - 测试产物 test-results/ / playwright-report/ 已在 .gitignore 中排除
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: 'http://localhost:5601',
    locale: 'en-US',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5601/en',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
