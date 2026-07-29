/**
 * 组织域名访问解析（路径前缀 / 二级域名 / 查询参数）
 *
 * 总入口（无 URL 租户信号）须展示平台登录页，不得用本地缓存 tenant_domain 推断。
 * 退出登录时可在 URL 无租户前缀的情况下，回退到当前会话的站点配置 tenant_domain。
 */

import { getPersistedConfigs, useConfigStore } from '../stores/configStore';

/** 路径首段保留字：不作为组织域名 */
export const TENANT_PATH_RESERVED_SEGMENTS = new Set([
  'login',
  'infra',
  'apps',
  'system',
  'personal',
  'init',
  'lock-screen',
  'docs',
  'debug',
  'qrcode',
  'm',
]);

/** 二级域名首段保留字：不作为组织域名 */
const TENANT_HOSTNAME_RESERVED_LABELS = new Set([
  'www',
  'api',
  'admin',
  'infra',
  'mail',
  'smtp',
  'ftp',
  'cdn',
  'static',
  'app',
  'm',
  'mobile',
]);

export type TenantLocationParts = {
  pathname?: string;
  search?: string;
  hostname?: string;
};

function normalizeTenantDomain(value: string | null | undefined): string | null {
  const normalized = (value || '').trim().toLowerCase();
  return normalized || null;
}

/**
 * 从 hostname 解析二级域名组织代码。
 * 例：default.localhost、default.example.com
 */
export function resolveTenantDomainFromHostname(hostname?: string): string | null {
  const host = normalizeTenantDomain((hostname || '').split(':')[0]);
  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return null;
  }

  const labels = host.split('.').filter(Boolean);
  if (labels.length < 2) {
    return null;
  }

  const first = labels[0];
  if (!first || TENANT_HOSTNAME_RESERVED_LABELS.has(first)) {
    return null;
  }

  // 开发：{tenant}.localhost
  if (labels.length === 2 && labels[1] === 'localhost') {
    return first;
  }

  // 生产：{tenant}.example.com（至少 3 段）
  if (labels.length >= 3) {
    return first;
  }

  return null;
}

export function resolveTenantDomainFromPathname(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (!segments.length) return null;

  if (!TENANT_PATH_RESERVED_SEGMENTS.has(segments[0])) {
    return segments[0].toLowerCase();
  }
  if (segments[0] === 'login' && segments[1] && !TENANT_PATH_RESERVED_SEGMENTS.has(segments[1])) {
    return segments[1].toLowerCase();
  }
  return null;
}

export function resolveTenantDomainFromSearch(search: string): string | null {
  try {
    return normalizeTenantDomain(new URLSearchParams(search).get('tenant_domain'));
  } catch {
    return null;
  }
}

/** 仅从 URL 解析组织域名（总入口 / 登录页展示须用此函数，禁止读本地 tenant_domain 缓存） */
export function resolveTenantDomainFromUrl(parts: TenantLocationParts = {}): string | null {
  const pathname = parts.pathname ?? window.location.pathname;
  const search = parts.search ?? window.location.search;
  const hostname = parts.hostname ?? window.location.hostname;

  return (
    resolveTenantDomainFromSearch(search)
    ?? resolveTenantDomainFromHostname(hostname)
    ?? resolveTenantDomainFromPathname(pathname)
  );
}

/** @deprecated 使用 resolveTenantDomainFromUrl；保留别名避免遗漏引用 */
export const resolveTenantDomainFromLocation = resolveTenantDomainFromUrl;

/**
 * 退出登录前解析组织域名（须在 clearAuth 之前调用）。
 * 登录后主路由不含 /{domain} 前缀时，可回退到当前会话站点配置里的 tenant_domain。
 */
export function resolveTenantDomainForLogout(): string | null {
  const fromUrl = resolveTenantDomainFromUrl();
  if (fromUrl) {
    return fromUrl;
  }

  const fromStore = normalizeTenantDomain(useConfigStore.getState().configs?.tenant_domain as string | undefined);
  if (fromStore) {
    return fromStore;
  }

  return normalizeTenantDomain(getPersistedConfigs()?.tenant_domain as string | undefined);
}

/** 鉴权重定向：仅 URL 有租户信号时带 tenant_domain，否则平台总入口 /login */
export function buildLoginRedirectPath(): string {
  const domain = resolveTenantDomainFromUrl();
  if (!domain) {
    return '/login';
  }
  return `/login?tenant_domain=${encodeURIComponent(domain)}`;
}

/** 退出 / 401：尽量回到当前组织的登录页（含会话内 tenant_domain 回退） */
export function buildTenantLoginPath(tenantDomain?: string | null): string {
  const domain = normalizeTenantDomain(tenantDomain) ?? resolveTenantDomainForLogout();
  if (!domain) {
    return '/login';
  }
  return `/login?tenant_domain=${encodeURIComponent(domain)}`;
}

/** OAuth / 社交登录回调后清理 URL，保留 URL 上的组织上下文 */
export function buildTenantLoginPathForHistoryReplace(extraSearch?: Record<string, string>): string {
  const domain = resolveTenantDomainFromUrl();
  const params = new URLSearchParams();
  if (domain) {
    params.set('tenant_domain', domain);
  }
  if (extraSearch) {
    for (const [key, value] of Object.entries(extraSearch)) {
      if (value) params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `/login?${query}` : '/login';
}
