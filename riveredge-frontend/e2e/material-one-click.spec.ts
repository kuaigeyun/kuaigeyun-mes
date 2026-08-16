/**
 * 最短路径：登录卢定杰 → 物料页 → 新建 → 填必填 → 创建
 * 目标：3 分钟内落库 1 个成品物料
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const USERNAME = 'u005';
const PASSWORD = 'Password123';
const TENANT_NAME = '无锡快格信息技术有限公司';
const NAME = `KG流程测试智能落地柜-${Date.now().toString().slice(-6)}`;

test('最短路径创建 1 个物料', async ({ page }) => {
  test.setTimeout(120_000);

  // 1) 登录
  await page.goto('/login');
  await page.locator('input[autocomplete="username"]').fill(USERNAME);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.getByText(TENANT_NAME).first().click({ timeout: 8_000 }).catch(() => undefined);
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  // 切中文偏好，避免英文文案干扰
  const token = await page.evaluate(() => localStorage.getItem('token'));
  if (token) {
    await page.request.put('http://127.0.0.1:8200/api/v1/personal/user-preferences', {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-ID': '1',
        'Content-Type': 'application/json',
      },
      data: { preferences: { language: 'zh-CN' } },
    });
  }
  await page.evaluate(() => localStorage.setItem('i18nextLng', 'zh-CN'));

  // 2) 进物料列表，选 KG-FG，新建
  await page.goto('/apps/master-data/materials');
  await page.waitForLoadState('domcontentloaded');
  const fg = page.locator('.material-group-tree .ant-tree-title, .ant-tree-node-content-wrapper').filter({ hasText: /KG-FG/ }).first();
  await fg.click({ timeout: 15_000 });
  await page.getByRole('button', { name: /新建物料\s*[（(]/ }).click();
  await page.waitForURL(/\/materials\/new/, { timeout: 20_000 });

  // 3) 只填必填：名称 + 来源类型（分组/单位应已预填或有默认）
  const nameInput = page.locator('#name, input#name').first();
  if (await nameInput.isVisible().catch(() => false)) {
    await nameInput.fill(NAME);
  } else {
    await page.locator('.ant-form-item').filter({ hasText: /^物料名称/ }).locator('input').first().fill(NAME);
  }

  // 基础单位：若空则选「台」
  const unitItem = page.locator('.ant-form-item').filter({ hasText: /基础单位/ }).first();
  const unitVal = await unitItem.locator('.ant-select-selection-item').textContent().catch(() => '');
  if (!unitVal || !String(unitVal).trim()) {
    await unitItem.locator('.ant-select').click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: /^台$/ }).first().click();
  }

  // 来源类型（必填多选）
  const sourceItem = page.locator('.ant-form-item').filter({ hasText: /物料来源类型/ }).first();
  await sourceItem.scrollIntoViewIfNeeded();
  await sourceItem.locator('.ant-select').click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: /自制/ }).first().click();
  await page.keyboard.press('Escape');

  // 4) 创建
  await page.getByRole('button', { name: /^创建/ }).click();

  // 成功：离开 /new，或 toast 成功
  const left = await page
    .waitForURL((u) => !u.pathname.includes('/materials/new'), { timeout: 25_000 })
    .then(() => true)
    .catch(() => false);

  const toast = page.locator('.ant-message-notice, .ant-notification-notice').last();
  const toastText = (await toast.textContent({ timeout: 5_000 }).catch(() => '')) || '';
  const errors = await page.locator('.ant-form-item-explain-error').allTextContents().catch(() => []);

  const result = {
    name: NAME,
    leftNewPage: left,
    url: page.url(),
    toast: toastText.trim(),
    errors,
  };
  fs.mkdirSync(path.join(__dirname, 'output'), { recursive: true });
  fs.writeFileSync(
    path.join(__dirname, 'output', 'kg-one-material-result.json'),
    JSON.stringify(result, null, 2),
    'utf-8',
  );
  console.log('[RESULT]', JSON.stringify(result, null, 2));

  expect(left || /成功/.test(toastText), `创建失败 errors=${errors.join('|')} toast=${toastText}`).toBeTruthy();
});
