/**
 * 组织域名访问解析（路径前缀 / 查询参数）
 *
 * 唯一约定：`example.com/{tenant}` 或 `/login?tenant_domain={tenant}`。
 * 不解析二级域名（避免内网穿透隧道 ID、临时子域被误判为组织域名）。
 *
 * 总入口（无 URL 租户信号）须展示平台登录页，不得用本地缓存 tenant_domain 推断。
 * 退出登录时可在 URL 无租户前缀的情况下，回退到当前会话的站点配置 tenant_domain。
 */

import { getPersistedConfigs, useConfigStore } from '../stores/configStore';
import { isPlatformAdminTenantDomain, isPlatformAdminEntryPathname, isReservedTenantDomain } from './reservedTenantDomain';

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

/**
 * 根路径域名校验文件（微信业务域名、各类 *.txt 校验）：不得当作组织域名。
 * 例：/6UYpYZscD0.txt、/MP_verify_xxx.txt
 */
export function isDomainVerificationPathSegment(segment: string): boolean {
  const s = (segment || '').trim().toLowerCase();
  if (!s) return false;
  if (s.endsWith('.txt')) return true;
  if (s.startsWith('mp_verify')) return true;
  return false;
}

export type TenantLocationParts = {
  pathname?: string;
  search?: string;
};

function normalizeTenantDomain(value: string | null | undefined): string | null {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return null;
  // 校验文件名不得进入组织域名（含 ?tenant_domain=xxx.txt 历史误跳转）
  if (isDomainVerificationPathSegment(normalized)) return null;
  return normalized;
}

export function resolveTenantDomainFromPathname(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (!segments.length) return null;

  const firstLower = segments[0].toLowerCase();
  if (isDomainVerificationPathSegment(firstLower)) {
    return null;
  }
  if (!TENANT_PATH_RESERVED_SEGMENTS.has(firstLower)) {
    const domain = normalizeTenantDomain(firstLower);
    return domain && !isReservedTenantDomain(domain) ? domain : null;
  }
  if (
    firstLower === 'login' &&
    segments[1] &&
    !TENANT_PATH_RESERVED_SEGMENTS.has(segments[1].toLowerCase())
  ) {
    const domain = normalizeTenantDomain(segments[1]);
    return domain && !isReservedTenantDomain(domain) ? domain : null;
  }
  return null;
}

export function resolveTenantDomainFromSearch(search: string): string | null {
  try {
    const domain = normalizeTenantDomain(new URLSearchParams(search).get('tenant_domain'));
    if (!domain || isReservedTenantDomain(domain)) {
      return null;
    }
    return domain;
  } catch {
    return null;
  }
}

/** 仅从 URL 解析组织域名（总入口 / 登录页展示须用此函数，禁止读本地 tenant_domain 缓存） */
export function resolveTenantDomainFromUrl(parts: TenantLocationParts = {}): string | null {
  const pathname = parts.pathname ?? window.location.pathname;
  const search = parts.search ?? window.location.search;

  const fromSearch = resolveTenantDomainFromSearch(search);
  if (fromSearch) {
    return fromSearch;
  }

  return resolveTenantDomainFromPathname(pathname);
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
  if (fromStore && !isReservedTenantDomain(fromStore)) {
    return fromStore;
  }

  const fromPersisted = normalizeTenantDomain(getPersistedConfigs()?.tenant_domain as string | undefined);
  if (fromPersisted && !isReservedTenantDomain(fromPersisted)) {
    return fromPersisted;
  }

  return null;
}

/** 鉴权重定向：租户走 /login；平台超管入口 /infra → /infra/login */
export function buildLoginRedirectPath(parts: TenantLocationParts = {}): string {
  const pathname = parts.pathname ?? window.location.pathname;
  if (isPlatformAdminEntryPathname(pathname)) {
    return '/infra/login';
  }
  const domain = resolveTenantDomainFromUrl(parts);
  if (!domain) {
    return '/login';
  }
  return `/login?tenant_domain=${encodeURIComponent(domain)}`;
}

/** 平台超管登录页路径（/infra 路径入口或 tenant_domain=infra） */
export function resolvePlatformAdminLoginPathFromUrl(parts: TenantLocationParts = {}): string | null {
  const pathname = parts.pathname ?? window.location.pathname;
  if (isPlatformAdminEntryPathname(pathname)) {
    return '/infra/login';
  }
  const search = parts.search ?? window.location.search;
  try {
    const domain = (new URLSearchParams(search).get('tenant_domain') || '').trim().toLowerCase();
    if (isPlatformAdminTenantDomain(domain)) {
      return '/infra/login';
    }
  } catch {
    /* ignore */
  }
  return null;
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
