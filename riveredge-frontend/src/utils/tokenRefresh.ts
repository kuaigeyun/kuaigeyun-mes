/**
 * 访问令牌静默续期（不经过 apiRequest，避免 401 与刷新逻辑递归）
 * 多路并发 401 时共用同一刷新 Promise，避免重复 /auth/refresh 与重复登出。
 *
 * API 前缀与 services/api.ts 中 API_BASE_URL 保持一致。
 */
import { getToken, setToken, getTenantId } from './auth';
import { updateLastActivity } from './activityUtils';

const API_BASE_URL = '/api/v1';

export type SilentRefreshResult =
  | { ok: true }
  /** 无本地 token，或服务端明确拒绝续期（签名无效 / 超出刷新窗口 / 用户失效） */
  | { ok: false; reason: 'no_token' | 'rejected' }
  /** 网络或非鉴权类失败：不得据此清会话，否则操作中会被误踢 */
  | { ok: false; reason: 'network' };

let refreshPromise: Promise<SilentRefreshResult> | null = null;

/**
 * 静默续期。调用方须按 reason 决定是否登出：仅 rejected / no_token 可清会话。
 */
export async function refreshAccessTokenSilently(): Promise<boolean> {
  const result = await refreshAccessTokenDetailed();
  return result.ok;
}

export async function refreshAccessTokenDetailed(): Promise<SilentRefreshResult> {
  if (refreshPromise) {
    return refreshPromise;
  }
  refreshPromise = (async (): Promise<SilentRefreshResult> => {
    try {
      const token = getToken();
      if (!token) {
        return { ok: false, reason: 'no_token' };
      }
      const tenantId = getTenantId();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (tenantId != null) {
        headers['X-Tenant-ID'] = String(tenantId);
      }
      let res: Response;
      try {
        res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ token }),
        });
      } catch {
        return { ok: false, reason: 'network' };
      }

      const text = await res.text();
      let data: { access_token?: string } | null = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        // 非 JSON：网关/代理故障更常见，不当作鉴权拒绝
        return { ok: false, reason: 'network' };
      }

      // 仅 401 表示令牌本身被拒绝。403 可能是网关/WAF/路径权限，不得当成会话失效。
      if (res.status === 401) {
        return { ok: false, reason: 'rejected' };
      }
      if (!res.ok || !data?.access_token) {
        return { ok: false, reason: 'network' };
      }

      setToken(data.access_token);
      // 续期成功视为会话仍有效；不经过 apiRequest，需显式刷新活动时间
      updateLastActivity(true);
      return { ok: true };
    } catch {
      return { ok: false, reason: 'network' };
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}
