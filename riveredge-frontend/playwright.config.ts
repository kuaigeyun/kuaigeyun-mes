import { defineConfig } from '@playwright/test';

/**
 * RiverEdge 前端 E2E 验证配置
 *
 * 前置：前端 dev server (8100) 与后端 (8200) 已运行。
 * 账号：kg001 / 12345678 @ tenant 35（见 e2e/helpers/session.ts）。
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/output/test-results',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: 4,
  // 后端数据库为远程云主机，公网连接偶发抖动（10060/连接中断）；
  // 重试用于区分瞬时网络错误与真实代码缺陷，重试后仍失败的才是缺陷。
  retries: 2,
  reporter: [
    ['list'],
    ['json', { outputFile: 'e2e/output/results.json' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:8100',
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
    viewport: { width: 1600, height: 900 },
    locale: 'zh-CN',
  },
  globalSetup: './e2e/global-setup.ts',
});
