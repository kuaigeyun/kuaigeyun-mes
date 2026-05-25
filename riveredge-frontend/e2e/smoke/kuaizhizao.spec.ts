import { expect, test } from '@playwright/test';

test.describe('快制造 · 本地 dev 冒烟', () => {
  test('制造执行看板可加载且未跳转到登录页', async ({ page }) => {
    await page.goto('/apps/kuaizhizao/production-execution/dashboard');
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
    await expect(page.locator('.ant-layout, .ant-pro-table, .ant-table').first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test('销售订单列表页可打开', async ({ page }) => {
    await page.goto('/apps/kuaizhizao/sales-management/sales-orders');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('.ant-pro-table, .ant-table').first()).toBeVisible({ timeout: 30_000 });
  });

  test('后端应用 health 正常', async ({ request }) => {
    const apiOrigin = process.env.E2E_API_ORIGIN || 'http://127.0.0.1:8200';
    const res = await request.get(`${apiOrigin}/api/v1/apps/kuaizhizao/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});
