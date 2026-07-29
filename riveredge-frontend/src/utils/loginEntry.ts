/**
 * 登录入口快照：登录时写入本地，退出时回到同一入口（含二级域名、路径前缀、查询参数）。
 */

import { navigateTo } from './navigation';
import { buildLoginRedirectPath } from './tenantDomainAccess';

const LOGIN_ENTRY_STORAGE_KEY = 'riveredge-login-entry';

const OAUTH_QUERY_KEYS = ['code', 'state', 'provider'] as const;

export type LoginEntryKind = 'tenant' | 'infra';

export type LoginEntrySnapshot = {
  origin: string;
  pathname: string;
  search: string;
  kind: LoginEntryKind;
};

export type PostLogoutLoginTarget = {
  /** 同 origin 时用 SPA 路由 */
  path: string;
  /** 跨 origin（如二级域名登录）时整页跳转 */
  fullUrl?: string;
};

function normalizeSearch(search: string): string {
  if (!search) return '';
  return search.startsWith('?') ? search : `?${search}`;
}

function sanitizeLoginUrl(url: URL, kind: LoginEntryKind): LoginEntrySnapshot {
  for (const key of OAUTH_QUERY_KEYS) {
    url.searchParams.delete(key);
  }
  url.searchParams.delete('redirect');

  if (kind === 'infra') {
    return {
      origin: url.origin,
      pathname: '/infra/login',
      search: '',
      kind,
    };
  }

  return {
    origin: url.origin,
    pathname: url.pathname,
    search: normalizeSearch(url.search),
    kind,
  };
}

/** 登录页加载 / 登录成功时调用，记录当前登录入口 */
export function captureLoginEntryFromCurrentUrl(kind: LoginEntryKind = 'tenant'): void {
  if (typeof window === 'undefined') return;
  try {
    const snapshot = sanitizeLoginUrl(new URL(window.location.href), kind);
    localStorage.setItem(LOGIN_ENTRY_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}

export function getSavedLoginEntry(): LoginEntrySnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOGIN_ENTRY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LoginEntrySnapshot>;
    if (
      parsed.kind !== 'tenant'
      && parsed.kind !== 'infra'
    ) {
      return null;
    }
    const origin = typeof parsed.origin === 'string' ? parsed.origin.trim() : '';
    const pathname = typeof parsed.pathname === 'string' ? parsed.pathname.trim() : '';
    if (!origin || !pathname) return null;
    return {
      origin,
      pathname,
      search: typeof parsed.search === 'string' ? normalizeSearch(parsed.search) : '',
      kind: parsed.kind,
    };
  } catch {
    return null;
  }
}

/** 退出 / 401 时解析应回到的登录入口 */
export function resolvePostLogoutLoginTarget(): PostLogoutLoginTarget {
  const saved = getSavedLoginEntry();
  if (saved) {
    const path = `${saved.pathname}${saved.search}`;
    if (saved.origin === window.location.origin) {
      return { path };
    }
    return { path, fullUrl: `${saved.origin}${path}` };
  }

  if (window.location.pathname.startsWith('/infra')) {
    return { path: '/infra/login' };
  }

  return { path: buildLoginRedirectPath() };
}

export function redirectAfterLogout(
  navigate?: (path: string, options?: { replace?: boolean }) => void,
): void {
  const target = resolvePostLogoutLoginTarget();
  if (target.fullUrl) {
    window.location.replace(target.fullUrl);
    return;
  }
  if (navigate) {
    navigate(target.path, { replace: true });
    return;
  }
  navigateTo(target.path, { replace: true });
}
