/**
 * E2E 会话工具：通过后端 API 登录，生成 Playwright storageState。
 */
import fs from 'node:fs';
import path from 'node:path';

export const BACKEND_URL = process.env.E2E_BACKEND_URL || 'http://127.0.0.1:8200';
export const FRONTEND_URL = process.env.E2E_FRONTEND_URL || 'http://127.0.0.1:8100';
export const USERNAME = process.env.E2E_USERNAME || 'kg001';
export const PASSWORD = process.env.E2E_PASSWORD || '12345678';
export const TENANT_ID = Number(process.env.E2E_TENANT_ID || 35);

export const AUTH_DIR = path.join(__dirname, '..', '.auth');
export const STORAGE_STATE_PATH = path.join(AUTH_DIR, 'state.json');
export const ROUTES_PATH = path.join(__dirname, '..', 'routes.json');

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: Record<string, unknown>;
}

export async function apiLogin(): Promise<LoginResult> {
  const res = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD, tenant_id: TENANT_ID }),
  });
  if (!res.ok) {
    throw new Error(`E2E 登录失败: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
    user: data.user || {},
  };
}

/** 生成带 localStorage 注入的 storageState 文件 */
export async function buildStorageState(): Promise<string> {
  const login = await apiLogin();
  const localStorageEntries = [
    { name: 'token', value: login.accessToken },
    { name: 'tenant_id', value: String(TENANT_ID) },
    { name: 'user_info', value: JSON.stringify(login.user) },
  ];
  if (login.refreshToken) {
    localStorageEntries.push({ name: 'refresh_token', value: login.refreshToken });
  }
  const state = {
    cookies: [],
    origins: [{ origin: FRONTEND_URL, localStorage: localStorageEntries }],
  };
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(STORAGE_STATE_PATH, JSON.stringify(state, null, 2));
  return login.accessToken;
}

interface MenuNode {
  name?: string;
  path?: string;
  children?: MenuNode[];
}

/** 从 navigation-tree 拉取当前账号可见的叶子路由，写入 routes.json */
export async function fetchLeafRoutes(accessToken: string): Promise<string[]> {
  const res = await fetch(`${BACKEND_URL}/api/v1/core/menus/navigation-tree`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Tenant-ID': String(TENANT_ID),
    },
  });
  if (!res.ok) {
    throw new Error(`拉取菜单树失败: ${res.status}`);
  }
  const tree: MenuNode[] = await res.json();
  const leaves: string[] = [];
  const walk = (nodes: MenuNode[]) => {
    for (const node of nodes) {
      const children = node.children || [];
      if (children.length === 0) {
        if (node.path) leaves.push(node.path);
      } else {
        walk(children);
      }
    }
  };
  walk(tree);
  fs.writeFileSync(ROUTES_PATH, JSON.stringify(leaves, null, 2));
  return leaves;
}

export function readRoutes(): string[] {
  if (!fs.existsSync(ROUTES_PATH)) return [];
  return JSON.parse(fs.readFileSync(ROUTES_PATH, 'utf-8'));
}
