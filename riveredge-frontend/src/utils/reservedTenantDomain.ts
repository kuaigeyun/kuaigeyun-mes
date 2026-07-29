/**
 * 组织域名保留字（与后端 infra/domain/tenant/reserved_tenant_domain.py 保持一致）
 */

export const RESERVED_TENANT_DOMAINS = new Set([
  'admin',
  'login',
  'infra',
  'system',
  'apps',
  'api',
  'docs',
  'debug',
  'qrcode',
  'init',
  'personal',
  'lock',
]);

export function isReservedTenantDomain(domain: string | null | undefined): boolean {
  const normalized = (domain || '').trim().toLowerCase();
  return normalized.length > 0 && RESERVED_TENANT_DOMAINS.has(normalized);
}

/** 平台超管专用入口域名 */
export const PLATFORM_ADMIN_TENANT_DOMAIN = 'infra';

/** 平台超管路径入口（IP 直连或域名根路径访问） */
export const PLATFORM_ADMIN_ENTRY_PATH = '/infra';

export function isPlatformAdminEntryPathname(pathname: string): boolean {
  const path = (pathname || '').replace(/\/+$/, '') || '/';
  return path === PLATFORM_ADMIN_ENTRY_PATH;
}

export function isPlatformAdminTenantDomain(domain: string | null | undefined): boolean {
  return (domain || '').trim().toLowerCase() === PLATFORM_ADMIN_TENANT_DOMAIN;
}
