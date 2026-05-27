/**
 * 权限工具函数
 * 
 * 提供权限检查相关的工具函数
 * 
 * @author Luigi Lu
 * @date 2026-01-27
 */

import { CurrentUser } from '../types/api';

const SYSTEM_ADMIN_ROLE_CODES = ['ADMIN', 'SYSTEM_ADMIN', 'SUPER_ADMIN'];
const SYSTEM_ADMIN_ROLE_NAME = '系统管理员';
/** 与后端权限码规范一致：仅做大小写与空白统一。 */
export function normalizePermissionCode(code: string): string {
  return String(code ?? '').trim().toLowerCase();
}

function buildUserPermissionSet(user: CurrentUser): Set<string> {
  if (!user.permissions?.length) return new Set();
  return new Set(user.permissions.map(normalizePermissionCode));
}

/** 菜单/页面权限命中：与后端统一为标准权限码的精确匹配。 */
function matchesRequiredPermission(userPerms: Set<string>, required: string): boolean {
  const normalized = normalizePermissionCode(required);
  if (!normalized) return false;
  return userPerms.has(normalized);
}

/**
 * 判断用户是否拥有「系统管理员」角色（与后端判定一致，用于菜单等前端权限展示）
 */
function isSystemAdminRole(user: CurrentUser | undefined): boolean {
  if (!user?.roles?.length) return false;
  return user.roles.some(
    (r) =>
      SYSTEM_ADMIN_ROLE_CODES.includes((r.code || '').trim().toUpperCase()) ||
      (r.name || '').trim() === SYSTEM_ADMIN_ROLE_NAME
  );
}

/**
 * 检查用户是否具有指定权限
 * 
 * @param user - 当前用户
 * @param permissionCode - 权限代码（格式：resource:action）
 * @returns 是否具有权限
 */
export function hasPermission(user: CurrentUser | undefined, permissionCode: string): boolean {
  if (!user) {
    return false;
  }

  // 组织管理员、平台管理员或系统管理员角色默认拥有所有权限
  if (user.is_tenant_admin || user.is_infra_admin || isSystemAdminRole(user)) {
    return true;
  }

  const userPerms = buildUserPermissionSet(user);
  return matchesRequiredPermission(userPerms, permissionCode);
}

/**
 * 检查用户是否具有任意一个权限
 * 
 * @param user - 当前用户
 * @param permissionCodes - 权限代码列表
 * @returns 是否具有任意一个权限
 */
export function hasAnyPermission(
  user: CurrentUser | undefined,
  permissionCodes: string[]
): boolean {
  if (!user) {
    return false;
  }

  // 组织管理员、平台管理员或系统管理员角色默认拥有所有权限
  if (user.is_tenant_admin || user.is_infra_admin || isSystemAdminRole(user)) {
    return true;
  }

  const userPerms = buildUserPermissionSet(user);
  return permissionCodes.some(code => matchesRequiredPermission(userPerms, code));
}

/**
 * 检查用户是否具有所有权限
 * 
 * @param user - 当前用户
 * @param permissionCodes - 权限代码列表
 * @returns 是否具有所有权限
 */
export function hasAllPermissions(
  user: CurrentUser | undefined,
  permissionCodes: string[]
): boolean {
  if (!user) {
    return false;
  }

  // 组织管理员、平台管理员或系统管理员角色默认拥有所有权限
  if (user.is_tenant_admin || user.is_infra_admin || isSystemAdminRole(user)) {
    return true;
  }

  const userPerms = buildUserPermissionSet(user);
  return permissionCodes.every(code => matchesRequiredPermission(userPerms, code));
}

/**
 * 检查用户是否具有指定资源的指定操作权限
 * 
 * @param user - 当前用户
 * @param resource - 资源名称（如：user、role）
 * @param action - 操作名称（如：create、read、update、delete）
 * @returns 是否具有权限
 */
export function hasResourceAction(
  user: CurrentUser | undefined,
  resource: string,
  action: string
): boolean {
  const permissionCode = `${resource}:${action}`;
  return hasPermission(user, permissionCode);
}

/** 与后端 menu_resource_resolver 一致：分组占位权限不参与菜单可见性拦截 */
const GENERIC_MENU_RESOURCES = new Set(['workspace', 'entry']);

function isGenericMenuPermissionCode(code: string): boolean {
  const norm = normalizePermissionCode(code);
  if (!norm) return true;
  const parts = norm.split(':').filter(Boolean);
  if (parts.length < 3) return true;
  const app = parts[0];
  const resource = parts.slice(1, -1).join(':');
  return GENERIC_MENU_RESOURCES.has(resource) || resource === app;
}

/** 用户是否满足菜单项所需权限（精确匹配 + 同 resource 任意 action） */
function userHasMenuPermission(user: CurrentUser, permissionCode: string): boolean {
  if (hasPermission(user, permissionCode)) return true;
  if (isGenericMenuPermissionCode(permissionCode)) return false;
  const norm = normalizePermissionCode(permissionCode);
  const parts = norm.split(':').filter(Boolean);
  if (parts.length < 3) return false;
  const resourcePrefix = parts.slice(0, -1).join(':');
  const userPerms = buildUserPermissionSet(user);
  for (const p of userPerms) {
    if (p.startsWith(`${resourcePrefix}:`)) return true;
  }
  return false;
}

function hasAnyMenuPermission(user: CurrentUser | undefined, permissionCodes: string[]): boolean {
  if (!user) return false;
  if (user.is_tenant_admin || user.is_infra_admin || isSystemAdminRole(user)) return true;
  return permissionCodes.some((code) => userHasMenuPermission(user, code));
}

/** 合并 store 与 localStorage 中的权限/管理员标志，避免 /auth/me 竞态导致误判 */
export function resolveUserForMenuPermission(user: CurrentUser | undefined): CurrentUser | undefined {
  if (!user) return undefined;
  if (typeof window === 'undefined') return user;
  try {
    const raw = localStorage.getItem('user_info');
    if (!raw) return user;
    const saved = JSON.parse(raw);
    const savedPerms = Array.isArray(saved?.permissions) ? saved.permissions : [];
    const merged: CurrentUser = { ...user };
    if (!merged.permissions?.length && savedPerms.length) {
      merged.permissions = savedPerms;
    }
    if (!merged.is_tenant_admin && saved?.is_tenant_admin) {
      merged.is_tenant_admin = true;
    }
    if (!merged.is_infra_admin && saved?.is_infra_admin) {
      merged.is_infra_admin = true;
    }
    if (!merged.roles?.length && Array.isArray(saved?.roles) && saved.roles.length) {
      merged.roles = saved.roles;
    }
    return merged;
  } catch {
    // ignore
  }
  return user;
}

type PermissionMenuItem = {
  path?: string;
  key?: string;
  className?: string;
  children?: PermissionMenuItem[];
  permissionCodes?: string[];
  hideInMenu?: boolean;
};

/** 应用侧栏分组标题（快制造 / 主数据等），无 path，仅作视觉分组 */
export function isAppGroupTitleItem(item: { key?: string; className?: string }): boolean {
  const key = String(item.key ?? '');
  const cls = String(item.className ?? '');
  return (
    key.startsWith('app-group-') ||
    cls.includes('menu-group-title-app') ||
    cls.includes('app-menu-container-start')
  );
}

function isAppGroupPlaceholderItem(item: PermissionMenuItem): boolean {
  const key = String(item.key ?? '');
  return key.startsWith('app-group-placeholder-');
}

/**
 * 按权限过滤菜单树：先筛子节点；分组占位权限不阻断子树；有可见子节点则保留父节点。
 * hideInMenu 的隐藏路由不参与「可见子节点」判定，避免父菜单被误保留。
 */
export function filterMenuItemsByPermission<T extends PermissionMenuItem>(
  items: T[],
  user: CurrentUser | undefined,
): T[] {
  if (!user) return [];
  return items
    .map((item) => {
      let nextChildren: T[] | undefined;
      if (item.children?.length) {
        nextChildren = filterMenuItemsByPermission(item.children as T[], user);
      }

      const permissionCodes = item.permissionCodes;
      const hasVisibleChildren = (nextChildren ?? []).some(
        (child) => !child.hideInMenu && !isAppGroupPlaceholderItem(child),
      );

      // 应用分组标题不参与权限/path 剔除（子项为占位符，真实菜单项为同级兄弟节点）
      if (isAppGroupTitleItem(item)) {
        return { ...item, children: nextChildren };
      }

      if (hasVisibleChildren) {
        return { ...item, children: nextChildren };
      }

      // 隐藏路由（设计器等）仅作路由注册，不应单独撑开侧栏/系统配置父菜单
      if (item.hideInMenu) {
        return null;
      }

      if (permissionCodes?.length) {
        const required = permissionCodes.filter((c) => c && !isGenericMenuPermissionCode(c));
        if (required.length > 0 && !hasAnyMenuPermission(user, required)) {
          return null;
        }
      }

      if (!item.path && !hasVisibleChildren) {
        return null;
      }

      return { ...item, children: nextChildren };
    })
    .filter((m): m is T => m !== null);
}
