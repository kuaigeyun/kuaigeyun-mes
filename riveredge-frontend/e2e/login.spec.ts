/**
 * 登录页 UI 验证：表单登录 kg001，成功后离开 /login。
 */
import { test, expect } from '@playwright/test';
import { USERNAME, PASSWORD } from './helpers/session';

test.describe('登录', () => {
  test('表单登录成功并跳转', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('form');

    await page.locator('input[autocomplete="username"]').fill(USERNAME);
    await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();

    // kg001 属于多个组织：出现「选择组织」弹窗时选择目标租户（kgsoft）
    const tenantOption = page.locator('text=无锡快格软件有限公司').first();
    await tenantOption.click({ timeout: 15_000 }).catch(() => undefined);

    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
    expect(page.url()).not.toContain('/login');

    // 登录后 localStorage 有 token
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
  });

  test('错误密码提示失败且停留在登录页', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('form');

    await page.locator('input[autocomplete="username"]').fill(USERNAME);
    await page.locator('input[autocomplete="current-password"]').fill('wrong-password-1');
    await page.locator('button[type="submit"]').click();

    // 等待请求返回；应停留在 /login 且无 token
    await page.waitForTimeout(3000);
    expect(new URL(page.url()).pathname).toBe('/login');
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeFalsy();
  });
});
