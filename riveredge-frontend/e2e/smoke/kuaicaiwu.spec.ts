import { expect, test } from '@playwright/test';

test.describe('快财务 · 本地 dev 冒烟', () => {
  test('财务中心看板可加载', async ({ page }) => {
    await page.goto('/apps/kuaicaiwu/finance-management/dashboard');
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
    await expect(page.locator('.ant-layout')).toBeVisible();
  });

  test('应收单列表页可打开', async ({ page }) => {
    await page.goto('/apps/kuaicaiwu/finance-management/receivables');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('.ant-pro-table, .ant-table').first()).toBeVisible({ timeout: 30_000 });
  });

  test('后端应用 health 正常', async ({ request }) => {
    const apiOrigin = process.env.E2E_API_ORIGIN || 'http://127.0.0.1:8200';
    const res = await request.get(`${apiOrigin}/api/v1/apps/kuaicaiwu/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});
