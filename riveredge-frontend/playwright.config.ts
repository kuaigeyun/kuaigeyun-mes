import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const rootDir = process.cwd();
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:8100';
const storageState = path.join(rootDir, 'e2e/.auth/user.json');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  globalSetup: path.join(rootDir, 'e2e/global-setup.ts'),
  use: {
    baseURL,
    storageState,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'zh-CN',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // 优先使用本机 Chrome，避免首次下载 Chromium 阻塞
        channel: 'chrome',
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
