/** Gitee OAuth state 本地校验与解码（与后端 encode_gitee_oauth_state 对齐）。 */

const STORAGE_KEY = 'gitee_oauth_state';

export function saveGiteeOAuthState(state: string): void {
  sessionStorage.setItem(STORAGE_KEY, state);
}

/** 未 consume 时窥探是否为本页发起的 Gitee 回调（Gitee 可能丢掉 redirect_uri 上的 provider）。 */
export function peekGiteeOAuthState(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function consumeGiteeOAuthState(expected: string): boolean {
  const saved = sessionStorage.getItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  return !!saved && saved === expected;
}

export function decodeGiteeOAuthState(
  state: string,
): { tenant_id: number; redirect: string; redirect_uri: string } | null {
  if (!state) {
    return null;
  }
  try {
    const body = state.split('.')[0];
    const padded = body + '='.repeat((4 - (body.length % 4)) % 4);
    const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(raw) as { t?: unknown; r?: unknown; u?: unknown };
    const tenantId = Number(payload.t);
    if (!Number.isFinite(tenantId) || tenantId <= 0) {
      return null;
    }
    const redirectUri = typeof payload.u === 'string' ? payload.u.trim() : '';
    if (!redirectUri) {
      return null;
    }
    return {
      tenant_id: tenantId,
      redirect: typeof payload.r === 'string' ? payload.r.trim() : '',
      redirect_uri: redirectUri,
    };
  } catch {
    return null;
  }
}
