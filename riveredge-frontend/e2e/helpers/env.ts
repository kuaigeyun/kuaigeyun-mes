import fs from 'node:fs';
import path from 'node:path';

const e2eRoot = path.join(process.cwd(), 'e2e');

/** 读取 e2e/.env（若存在），不覆盖已设置的环境变量 */
function loadDotEnv(): void {
  const envPath = path.join(e2eRoot, '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadDotEnv();

export type E2EEnv = {
  baseURL: string;
  apiOrigin: string;
  username: string;
  password: string;
  tenantId: number | null;
  storageStatePath: string;
};

export function getE2EEnv(): E2EEnv {
  const baseURL = (process.env.E2E_BASE_URL || 'http://127.0.0.1:8100').replace(/\/$/, '');
  const apiOrigin = (process.env.E2E_API_ORIGIN || 'http://127.0.0.1:8200').replace(/\/$/, '');
  const username = process.env.E2E_USERNAME || '';
  const password = process.env.E2E_PASSWORD || '';
  const tenantRaw = process.env.E2E_TENANT_ID?.trim();
  const tenantId = tenantRaw ? Number(tenantRaw) : null;

  if (!username || !password) {
    throw new Error(
      'E2E 缺少登录凭据：请复制 e2e/.env.example 为 e2e/.env 并填写 E2E_USERNAME / E2E_PASSWORD',
    );
  }

  return {
    baseURL,
    apiOrigin,
    username,
    password,
    tenantId: Number.isFinite(tenantId) ? tenantId : null,
    storageStatePath: path.join(e2eRoot, '.auth/user.json'),
  };
}
