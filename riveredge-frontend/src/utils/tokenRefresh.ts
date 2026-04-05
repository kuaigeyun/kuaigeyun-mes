/**
 * 访问令牌静默续期（不经过 apiRequest，避免 401 与刷新逻辑递归）
 * 多路并发 401 时共用同一刷新 Promise，避免重复 /auth/refresh 与重复登出。
 *
 * API 前缀与 services/api.ts 中 API_BASE_URL 保持一致。
 */
import { getToken, setToken, getTenantId } from './auth';

const API_BASE_URL = '/api/v1';

let refreshPromise: Promise<boolean> | null = null;

export async function refreshAccessTokenSilently(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }
  refreshPromise = (async () => {
    try {
      const token = getToken();
      if (!token) {
        return false;
      }
      const tenantId = getTenantId();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (tenantId != null) {
        headers['X-Tenant-ID'] = String(tenantId);
      }
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ token }),
      });
      const text = await res.text();
      let data: { access_token?: string } | null = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        return false;
      }
      if (!res.ok || !data?.access_token) {
        return false;
      }
      setToken(data.access_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}
