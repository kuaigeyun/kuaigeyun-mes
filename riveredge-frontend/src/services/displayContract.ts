import { apiRequest } from './api';
import { getNavigationMenuTree, type MenuTree } from './menu';
import { resolvePermissionResourceFromMenus } from '../utils/permissionResource';
import { isPlatformInfraPath } from '../utils/platformScope';

export class ReferenceDisplayAccessError extends Error {
  readonly status: number;
  readonly required?: string[];

  constructor(message: string, status = 403, required?: string[]) {
    super(message);
    this.name = 'ReferenceDisplayAccessError';
    this.status = status;
    this.required = required;
  }
}

export function mapReferenceDisplayError(
  err: unknown,
  fallbackMessage = '引用资源加载失败',
): ReferenceDisplayAccessError {
  if (err && typeof err === 'object') {
    const e = err as { status?: number; message?: string; data?: { details?: { required?: string[] } } };
    if (e.status === 403) {
      return new ReferenceDisplayAccessError(
        e.message || '无权引用该资源，请联系管理员配置宿主单据或引用资源权限',
        403,
        e.data?.details?.required,
      );
    }
  }
  return new ReferenceDisplayAccessError(
    err instanceof Error ? err.message : fallbackMessage,
    500,
  );
}

let cachedNavigationMenus: MenuTree[] | null = null;
let cachedNavigationMenusPromise: Promise<MenuTree[] | null> | null = null;
let cachedNavigationMenusKey = '';

function resolveNavigationMenusCacheKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    const tenantId = localStorage.getItem('tenant_id') || '';
    const userInfoRaw = localStorage.getItem('user_info') || '';
    const userInfo = userInfoRaw ? JSON.parse(userInfoRaw) : {};
    const permissionVersion = String(userInfo?.permission_version ?? userInfo?.permissionVersion ?? '');
    return `${tenantId}::${permissionVersion}`;
  } catch {
    return '';
  }
}

async function getNavigationMenusCached(): Promise<MenuTree[] | null> {
  const cacheKey = resolveNavigationMenusCacheKey();
  if (cacheKey !== cachedNavigationMenusKey) {
    cachedNavigationMenus = null;
    cachedNavigationMenusPromise = null;
    cachedNavigationMenusKey = cacheKey;
  }
  if (cachedNavigationMenus) return cachedNavigationMenus;
  if (cachedNavigationMenusPromise) return cachedNavigationMenusPromise;
  cachedNavigationMenusPromise = (async () => {
    try {
      const menus = await getNavigationMenuTree();
      cachedNavigationMenus = Array.isArray(menus) ? menus : [];
      return cachedNavigationMenus;
    } catch {
      return null;
    } finally {
      cachedNavigationMenusPromise = null;
    }
  })();
  return cachedNavigationMenusPromise;
}

async function resolveAutoHostResource(): Promise<string | undefined> {
  if (typeof window === 'undefined') return undefined;
  const path = window.location?.pathname || '';
  if (!path || isPlatformInfraPath(path)) return undefined;
  const menus = await getNavigationMenusCached();
  const resource = resolvePermissionResourceFromMenus(menus || undefined, path);
  const host = (resource || '').trim();
  return host || undefined;
}

export async function resolveDisplayHostResource(explicitHostResource?: string): Promise<string | undefined> {
  const explicit = (explicitHostResource || '').trim();
  if (explicit) return explicit;
  return resolveAutoHostResource();
}

async function withAutoHostResource(
  source: Record<string, unknown>,
  enabled: boolean,
): Promise<Record<string, unknown>> {
  if (!enabled) return source;
  const current = source.host_resource;
  const host = await resolveDisplayHostResource(typeof current === 'string' ? current : undefined);
  if (!host) return source;
  return { ...source, host_resource: host };
}

export async function requestDisplaySearch<T>(
  endpoint: string,
  params: Record<string, unknown>,
  fallbackMessage?: string,
  options?: { headers?: Record<string, string>; autoHostResource?: boolean },
): Promise<T> {
  try {
    const mergedParams = await withAutoHostResource(params, options?.autoHostResource !== false);
    return await apiRequest<T>(endpoint, { params: mergedParams, headers: options?.headers });
  } catch (err: unknown) {
    throw mapReferenceDisplayError(err, fallbackMessage);
  }
}

export async function requestDisplayResolve<T>(
  endpoint: string,
  payload: Record<string, unknown>,
  fallbackMessage?: string,
  options?: { headers?: Record<string, string>; autoHostResource?: boolean },
): Promise<T> {
  try {
    const mergedPayload = await withAutoHostResource(payload, options?.autoHostResource !== false);
    return await apiRequest<T>(endpoint, {
      method: 'POST',
      data: mergedPayload,
      headers: options?.headers,
    });
  } catch (err: unknown) {
    throw mapReferenceDisplayError(err, fallbackMessage);
  }
}

