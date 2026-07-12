/** 企业微信 OAuth 前端辅助（state 与后端 wecom_oauth_service 对齐） */

const WECOM_OAUTH_STATE_KEY = 'wecom_oauth_state';

export function isWeComBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/wxwork/i.test(ua) || /wecom/i.test(ua)) return true;
  if (typeof window !== 'undefined') {
    const w = window as Window & { ww?: unknown; WeixinJSBridge?: unknown };
    if (w.ww || w.WeixinJSBridge) return true;
  }
  return false;
}

export function shouldAutoWecomOAuth(pathname: string): boolean {
  // /m/ 为企微 H5 专用入口；不依赖 UA（PC 企微内置浏览器可能不含 wxwork）
  return pathname.startsWith('/m/');
}

/** 企微 H5 OAuth 回调地址（不含 query，tenant 写入 state） */
export function buildWecomMobileOAuthRedirectUri(pathname: string): string {
  return `${window.location.origin}${pathname}`;
}

export function saveWecomOAuthState(state: string): void {
  sessionStorage.setItem(WECOM_OAUTH_STATE_KEY, state);
}

export function consumeWecomOAuthState(expected: string): boolean {
  const saved = sessionStorage.getItem(WECOM_OAUTH_STATE_KEY);
  sessionStorage.removeItem(WECOM_OAUTH_STATE_KEY);
  return Boolean(saved && saved === expected);
}

export function decodeWecomOAuthState(state: string): { tenant_id: number; redirect: string } | null {
  try {
    const padded = state + '='.repeat((4 - (state.length % 4)) % 4);
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const payload = JSON.parse(json) as { t?: unknown; r?: unknown };
    const tenantId = Number(payload.t);
    if (!Number.isFinite(tenantId) || tenantId < 1) return null;
    return {
      tenant_id: tenantId,
      redirect: typeof payload.r === 'string' ? payload.r : '',
    };
  } catch {
    return null;
  }
}

export function stripOAuthQueryFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  url.searchParams.delete('provider');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}
