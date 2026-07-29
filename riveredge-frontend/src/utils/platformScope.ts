/**
 * 平台级路由作用域（/infra/*）。
 * 此类页面不走租户 manifest permission_code，由平台会话 + 后端 infra API 鉴权。
 *
 * URL 路径大小写不敏感：/INFRA、/Infra 与 /infra 等价。
 */

export const PLATFORM_INFRA_PREFIX = '/infra';

function normalizePathOnly(pathname: string): string {
  return (pathname || '').replace(/\/+$/, '') || '/';
}

/** pathname 是否为平台入口 /infra（大小写不敏感） */
export function isPlatformAdminEntryPathname(pathname: string): boolean {
  return normalizePathOnly(pathname).toLowerCase() === PLATFORM_INFRA_PREFIX;
}

/** pathname 是否为平台超管登录页（大小写不敏感） */
export function isPlatformAdminLoginPathname(pathname: string): boolean {
  return normalizePathOnly(pathname).toLowerCase() === `${PLATFORM_INFRA_PREFIX}/login`;
}

/** pathname 是否属于平台作用域 /infra 或 /infra/*（大小写不敏感） */
export function isPlatformInfraPath(pathname: string): boolean {
  const lower = normalizePathOnly(pathname).toLowerCase();
  return lower === PLATFORM_INFRA_PREFIX || lower.startsWith(`${PLATFORM_INFRA_PREFIX}/`);
}

/**
 * 若 pathname 属于平台作用域但大小写不规范，返回规范小写路径；否则 null。
 */
export function canonicalizePlatformInfraPathname(pathname: string): string | null {
  const normalized = normalizePathOnly(pathname);
  const lower = normalized.toLowerCase();
  if (lower === PLATFORM_INFRA_PREFIX || lower.startsWith(`${PLATFORM_INFRA_PREFIX}/`)) {
    return lower;
  }
  return null;
}

/** 无需 BasicLayout / 鉴权的平台公开路径：/infra 入口与 /infra/login */
export function isPlatformInfraPublicPath(pathname: string): boolean {
  return isPlatformAdminEntryPathname(pathname) || isPlatformAdminLoginPathname(pathname);
}
