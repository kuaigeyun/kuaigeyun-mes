/**
 * 权限工具函数
 * 
 * 提供权限检查相关的工具函数
 * 
 * @author Luigi Lu
 * @date 2026-01-27
 */

import { CurrentUser } from '../types/api';
import { hasPlatformAdministrativeAuthority } from './auth';

export const SYSTEM_ADMIN_ROLE_CODES = ['ADMIN', 'SYSTEM_ADMIN', 'SUPER_ADMIN'] as const;
const SYSTEM_ADMIN_ROLE_NAME = '系统管理员';

/** 与后端 UserPermissionService.is_admin_bypass / permission-responsibility 三路径合一 */
export function isSystemAdminRole(user: CurrentUser | undefined): boolean {
  if (!user?.roles?.length) return false;
  return user.roles.some(
    (r) =>
      SYSTEM_ADMIN_ROLE_CODES.includes((r.code || '').trim().toUpperCase() as (typeof SYSTEM_ADMIN_ROLE_CODES)[number]) ||
      (r.name || '').trim() === SYSTEM_ADMIN_ROLE_NAME
  );
}

/** 平台/组织管理员 + 系统管理员角色：关闭按钮级 RBAC 过滤（与后端 is_admin_bypass 一致） */
export function isAdminBypass(user: CurrentUser | undefined): boolean {
  if (hasPlatformAdministrativeAuthority(user)) return true;
  if (!user) return false;
  return Boolean(user.is_tenant_admin) || isSystemAdminRole(user);
}
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
 * 检查用户是否具有指定权限
 * 
 * @param user - 当前用户
 * @param permissionCode - 权限代码（格式：resource:action）
 * @returns 是否具有权限
 */
export function hasPermission(user: CurrentUser | undefined, permissionCode: string): boolean {
  if (isAdminBypass(user)) {
    return true;
  }
  if (!user) {
    return false;
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
  if (isAdminBypass(user)) {
    return true;
  }
  if (!user) {
    return false;
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
  if (isAdminBypass(user)) {
    return true;
  }
  if (!user) {
    return false;
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
  if (isAdminBypass(user)) {
    return true;
  }
  if (!user) return false;
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
    if (!merged.user_type && saved?.user_type) {
      merged.user_type = saved.user_type;
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
 * 按权限过滤菜单树。
 *
 * 节点分类（唯一判定依据，禁止按 path 白名单补丁）：
 * - **可导航项**：自身有 `path` 且非 `hideInMenu` → 是否展示只看本节点 permissionCodes
 * - **分组壳**：无 `path`（或自身 hideInMenu）→ 仅当有可见子节点时保留
 *
 * `hideInMenu` 子路由（设计器等）不参与「可见子节点」计数，但可挂在可导航项下供面包屑/路由树使用。
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
      const isNavigableMenuEntry = Boolean(item.path) && !item.hideInMenu;

      // 应用分组标题不参与权限/path 剔除（子项为占位符，真实菜单项为同级兄弟节点）
      if (isAppGroupTitleItem(item)) {
        return { ...item, children: nextChildren };
      }

      if (item.children?.length) {
        if (hasVisibleChildren) {
          return { ...item, children: nextChildren };
        }
        // 无可见子节点：分组壳剔除；可导航列表页（含仅挂 hideInMenu 设计器子路由）继续按本节点权限判定
        if (!isNavigableMenuEntry) {
          return null;
        }
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

      if (!isNavigableMenuEntry && !hasVisibleChildren) {
        return null;
      }

      return { ...item, children: nextChildren };
    })
    .filter((m): m is T => m !== null);
}
