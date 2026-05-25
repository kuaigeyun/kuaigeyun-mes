import { expect, test } from '@playwright/test';

test.describe('主数据 · 本地 dev 冒烟', () => {
  test('物料管理页可加载', async ({ page }) => {
    await page.goto('/apps/master-data/materials');
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
    await expect(page.locator('.ant-layout')).toBeVisible();
  });

  test('客户列表页可打开', async ({ page }) => {
    await page.goto('/apps/master-data/supply-chain/customers');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('.ant-pro-table, .ant-table').first()).toBeVisible({ timeout: 30_000 });
  });

  test('后端应用 health 正常', async ({ request }) => {
    const apiOrigin = process.env.E2E_API_ORIGIN || 'http://127.0.0.1:8200';
    const res = await request.get(`${apiOrigin}/api/v1/apps/master-data/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});
