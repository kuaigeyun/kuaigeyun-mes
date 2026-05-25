import { chromium, type FullConfig } from '@playwright/test';
import { ensureAuthDir, loginViaApi, seedBrowserAuth } from './helpers/auth-api';
import { getE2EEnv } from './helpers/env';

export default async function globalSetup(_config: FullConfig): Promise<void> {
  const env = getE2EEnv();
  ensureAuthDir(env.storageStatePath);

  const login = await loginViaApi(env);

  const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext({ baseURL: env.baseURL });
  const page = await context.newPage();

  await page.goto('/');
  await seedBrowserAuth(page, login);
  await context.storageState({ path: env.storageStatePath });

  await browser.close();
}
