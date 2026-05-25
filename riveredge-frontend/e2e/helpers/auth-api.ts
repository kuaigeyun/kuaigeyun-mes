import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import type { E2EEnv } from './env';

export type LoginPayload = {
  access_token: string;
  default_tenant_id?: number;
  user: {
    id: number;
    uuid: string;
    username: string;
    email?: string;
    full_name?: string;
    tenant_id?: number;
    tenant_name?: string;
    is_infra_admin?: boolean;
    is_tenant_admin?: boolean;
    permissions?: string[];
    permission_version?: number;
    roles?: Array<{ uuid: string; name: string; code: string }>;
  };
  requires_tenant_selection?: boolean;
  tenants?: Array<{ id: number; name: string }>;
};

export async function assertBackendReady(apiOrigin: string): Promise<void> {
  const res = await fetch(`${apiOrigin}/health`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    throw new Error(`后端未就绪：GET ${apiOrigin}/health 返回 ${res.status}。请先启动 riveredge-backend（默认 8200）。`);
  }
}

export async function loginViaApi(env: E2EEnv): Promise<LoginPayload> {
  await assertBackendReady(env.apiOrigin);

  const body: Record<string, unknown> = {
    username: env.username,
    password: env.password,
  };
  if (env.tenantId != null) {
    body.tenant_id = env.tenantId;
  }

  let res = await fetch(`${env.apiOrigin}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`E2E 登录失败 (${res.status})：${detail.slice(0, 500)}`);
  }

  let data = (await res.json()) as LoginPayload;

  if (data.requires_tenant_selection && !body.tenant_id) {
    const first = data.tenants?.[0];
    if (!first?.id) {
      throw new Error('账号需选择组织，请在 e2e/.env 中设置 E2E_TENANT_ID');
    }
    res = await fetch(`${env.apiOrigin}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, tenant_id: first.id }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      throw new Error(`E2E 二次登录（选组织）失败：${res.status}`);
    }
    data = (await res.json()) as LoginPayload;
  }

  if (!data.access_token) {
    throw new Error('E2E 登录响应缺少 access_token');
  }

  return data;
}

export async function seedBrowserAuth(page: Page, login: LoginPayload): Promise<void> {
  const tenantId = login.default_tenant_id ?? login.user.tenant_id ?? null;
  const userInfo = {
    id: login.user.id,
    uuid: login.user.uuid,
    username: login.user.username,
    email: login.user.email,
    full_name: login.user.full_name,
    is_infra_admin: login.user.is_infra_admin ?? false,
    is_tenant_admin: login.user.is_tenant_admin ?? false,
    permissions: login.user.permissions ?? [],
    permission_version: login.user.permission_version ?? 1,
    roles: login.user.roles ?? [],
    tenant_id: tenantId ?? undefined,
    tenant_name: login.user.tenant_name,
  };

  await page.evaluate(
    ({ token, tenant, user }) => {
      localStorage.setItem('token', token);
      if (tenant != null) {
        localStorage.setItem('tenant_id', String(tenant));
      }
      localStorage.setItem('user_info', JSON.stringify(user));
    },
    { token: login.access_token, tenant: tenantId, user: userInfo },
  );
}

export function ensureAuthDir(storageStatePath: string): void {
  fs.mkdirSync(path.dirname(storageStatePath), { recursive: true });
}
