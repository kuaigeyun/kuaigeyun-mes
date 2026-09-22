/**
 * 组织域名访问解析（路径唯一真源）
 *
 * 唯一约定：`example.com/{tenant}`。
 * 不解析二级域名；不以 `?tenant_domain=` 作为组织入口。
 * 平台超管入口：`/infra`（保留字，不当组织）。
 * 根路径静态样（含 `.` / mp_verify*）：不当组织。
 */

import { getPersistedConfigs, useConfigStore } from '../stores/configStore';
import { isPlatformAdminEntryPathname, isReservedTenantDomain } from './reservedTenantDomain';

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
 * 根路径静态样首段（校验文件、资源名）：不得当作组织域名。
 * 例：/6UYpYZscD0.txt、/MP_verify_xxx.txt、/favicon.ico
 */
export function isStaticLikePathSegment(segment: string): boolean {
  const s = (segment || '').trim().toLowerCase();
  if (!s) return false;
  if (s.includes('.')) return true;
  if (s.startsWith('mp_verify')) return true;
  return false;
}

/** @deprecated 使用 isStaticLikePathSegment */
export const isDomainVerificationPathSegment = isStaticLikePathSegment;

export type TenantLocationParts = {
  pathname?: string;
  search?: string;
};

function normalizeTenantDomain(value: string | null | undefined): string | null {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (isStaticLikePathSegment(normalized)) return null;
  return normalized;
}

/** 单段静态样路径（如 /xxx.txt） */
export function isStaticLikePathname(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length !== 1) return false;
  return isStaticLikePathSegment(segments[0]);
}

/** @deprecated 使用 isStaticLikePathname */
export const isDomainVerificationPathname = isStaticLikePathname;

export function resolveTenantDomainFromPathname(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  // 组织入口仅为单段 /{tenant}；多段业务路径不含组织前缀
  if (segments.length !== 1) return null;

  const firstLower = segments[0].toLowerCase();
  if (isStaticLikePathSegment(firstLower)) return null;
  if (TENANT_PATH_RESERVED_SEGMENTS.has(firstLower)) return null;

  const domain = normalizeTenantDomain(firstLower);
  return domain && !isReservedTenantDomain(domain) ? domain : null;
}

/** 当前 URL 是否为组织入口路径（未登录应同路径出登录） */
export function isTenantEntryPathname(pathname: string): boolean {
  return resolveTenantDomainFromPathname(pathname) != null;
}

/**
 * 仅从 pathname 解析组织域名（入口唯一真源）。
 * 禁止读 ?tenant_domain=；禁止读本地缓存作入口推断。
 */
export function resolveTenantDomainFromUrl(parts: TenantLocationParts = {}): string | null {
  const pathname = parts.pathname ?? window.location.pathname;
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

/** 鉴权重定向：组织 → /{domain}；平台超管 → /infra/login；否则 /login */
export function buildLoginRedirectPath(parts: TenantLocationParts = {}): string {
  const pathname = parts.pathname ?? window.location.pathname;
  if (isPlatformAdminEntryPathname(pathname)) {
    return '/infra/login';
  }
  const domain = resolveTenantDomainFromUrl(parts);
  if (!domain) {
    return '/login';
  }
  return `/${domain}`;
}

/** 平台超管登录页路径（仅 /infra 路径入口） */
export function resolvePlatformAdminLoginPathFromUrl(parts: TenantLocationParts = {}): string | null {
  const pathname = parts.pathname ?? window.location.pathname;
  if (isPlatformAdminEntryPathname(pathname)) {
    return '/infra/login';
  }
  return null;
}

/** 退出 / 401：回到当前组织入口 /{domain}，无组织则 /login */
export function buildTenantLoginPath(tenantDomain?: string | null): string {
  const domain = normalizeTenantDomain(tenantDomain) ?? resolveTenantDomainForLogout();
  if (!domain) {
    return '/login';
  }
  return `/${domain}`;
}

/**
 * OAuth / 社交登录回调后清理 URL，保留路径上的组织上下文。
 * 额外 query（非 tenant_domain）可挂在 /{domain}?… 或 /login?…
 */
export function buildTenantLoginPathForHistoryReplace(extraSearch?: Record<string, string>): string {
  const domain = resolveTenantDomainFromUrl();
  const params = new URLSearchParams();
  if (extraSearch) {
    for (const [key, value] of Object.entries(extraSearch)) {
      if (!value || key === 'tenant_domain') continue;
      params.set(key, value);
    }
  }
  const query = params.toString();
  const base = domain ? `/${domain}` : '/login';
  return query ? `${base}?${query}` : base;
}
