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

/** 与后端 PermissionRegistryService._clean_code 一致 */
export function normalizePermissionCode(code: string): string {
  return String(code ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
}

function buildUserPermissionSet(user: CurrentUser): Set<string> {
  if (!user.permissions?.length) return new Set();
  return new Set(user.permissions.map(normalizePermissionCode));
}

/**
 * 菜单所需权限是否被用户持有（含连字符/下划线归一化及好力 GO 应用入口兼容）
 */
function matchesRequiredPermission(userPerms: Set<string>, required: string): boolean {
  const normalized = normalizePermissionCode(required);
  if (!normalized) return false;
  if (userPerms.has(normalized)) return true;

  const parts = normalized.split(':').filter(Boolean);
  if (parts.length < 3) return false;
  const app = parts[0];
  const action = parts[parts.length - 1];
  const resource = parts.slice(1, -1).join(':');

  if (app === 'haoligo') {
    return haoligoPermissionMatches(userPerms, normalized, resource, action);
  }

  return false;
}

/** 好力 GO：按资源精确匹配，禁止 molds: 误匹配 molds-ledger: 等子资源 */
function haoligoPermissionMatches(
  userPerms: Set<string>,
  normalizedRequired: string,
  resource: string,
  action: string,
): boolean {
  const exactRead = `haoligo:${resource}:read`;
  const exactAction = `haoligo:${resource}:${action}`;

  if (userPerms.has(normalizedRequired) || userPerms.has(exactAction)) {
    return true;
  }

  const resourcePrefix = `haoligo:${resource}:`;
  for (const p of userPerms) {
    if (!p.startsWith(resourcePrefix)) continue;
    const parts = p.split(':').filter(Boolean);
    if (parts.length < 3) continue;
    const permResource = parts.slice(1, -1).join(':');
    if (permResource !== resource) continue;

    if (p === exactRead || p === exactAction) return true;
    if (action === 'read' && (p.endsWith(':read') || p.endsWith(':create') || p.endsWith(':update'))) {
      return true;
    }
  }

  return false;
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
