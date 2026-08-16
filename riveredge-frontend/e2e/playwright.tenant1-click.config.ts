import { defineConfig } from '@playwright/test';

/**
 * 租户1 UI 点击流：不走 globalSetup（避免 kg001/租户35 storageState）。
 * 账号由用例内登录页输入：u005 / 卢定杰。
 */
export default defineConfig({
  testDir: './',
  testMatch: '**/material-one-click.spec.ts',
  outputDir: './output/tenant1-click-results',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8100',
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'retain-on-failure',
    viewport: { width: 1600, height: 900 },
    locale: 'zh-CN',
    headless: false,
  },
});
