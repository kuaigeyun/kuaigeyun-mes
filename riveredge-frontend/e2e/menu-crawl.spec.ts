/**
 * 菜单全路由遍历验证。
 *
 * 数据源：e2e/routes.json（global-setup 从 navigation-tree 刷新，为当前账号实际可见的叶子路由）。
 * 每个路由一个 test，断言：
 *  1. 不被重定向回 /login（会话有效）
 *  2. 无未捕获 JS 异常（pageerror）
 *  3. 页面 API 请求无 5xx
 *  4. 不出现 ErrorBoundary（「页面出现错误」）
 *  5. 主布局渲染成功（.ant-layout 可见）
 */
import { test, expect, Page } from '@playwright/test';
import { readRoutes, STORAGE_STATE_PATH } from './helpers/session';

test.use({ storageState: STORAGE_STATE_PATH });

const routes = readRoutes();

interface PageIssues {
  pageErrors: string[];
  serverErrors: string[];
}

function watchPage(page: Page): PageIssues {
  const issues: PageIssues = { pageErrors: [], serverErrors: [] };
  page.on('pageerror', (err) => {
    issues.pageErrors.push(String(err?.message || err));
  });
  page.on('response', (res) => {
    if (res.status() >= 500 && res.url().includes('/api/')) {
      res
        .text()
        .catch(() => '')
        .then((body) => {
          issues.serverErrors.push(
            `${res.status()} ${res.request().method()} ${res.url()} :: ${body.slice(0, 300)}`,
          );
        });
    }
  });
  return issues;
}

async function assertPageHealthy(page: Page, route: string, issues: PageIssues) {
  // 主布局渲染（登录会话有效时 BasicLayout 一定存在）
  await page.waitForSelector('.ant-layout', { timeout: 60_000 });

  // 等待懒加载 chunk 与首屏 API 落定（dev 模式编译慢，宽限）
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);

  const currentPath = new URL(page.url()).pathname;
  expect(currentPath, `路由 ${route} 被重定向到登录页`).not.toBe('/login');

  const errorBoundary = page.locator('text=页面出现错误');
  await expect(errorBoundary, `路由 ${route} 渲染进入 ErrorBoundary`).toHaveCount(0);

  expect(issues.pageErrors, `路由 ${route} 存在未捕获 JS 异常`).toEqual([]);
  expect(issues.serverErrors, `路由 ${route} 存在 5xx API 响应`).toEqual([]);
}

test.describe('菜单路由遍历', () => {
  if (routes.length === 0) {
    test('routes.json 为空（global-setup 未生成）', () => {
      throw new Error('routes.json 为空，请先运行 global-setup（正常执行 npx playwright test 会自动生成）');
    });
  }

  for (const route of routes) {
    test(`页面可用: ${route}`, async ({ page }) => {
      const issues = watchPage(page);
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await assertPageHealthy(page, route, issues);
    });
  }
});
