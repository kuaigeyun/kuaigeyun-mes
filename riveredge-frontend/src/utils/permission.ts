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
import { getSessionCurrentUser } from './sessionCurrentUser';

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

/** 与后端 menu_resource_resolver 对齐：workspace 为分组占位；entry 为应用入口码（角色矩阵不拆模块），侧栏叶子持码仍可显示 */
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

/** 用户是否满足菜单项所需权限：与按钮门控一致，仅精确匹配权限码（禁止同 resource 任意 action 放宽）。 */
function userHasMenuPermission(user: CurrentUser, permissionCode: string): boolean {
  if (isGenericMenuPermissionCode(permissionCode)) return false;
  return hasPermission(user, permissionCode);
}

function hasAnyMenuPermission(user: CurrentUser | undefined, permissionCodes: string[]): boolean {
  if (isAdminBypass(user)) {
    return true;
  }
  if (!user) return false;
  return permissionCodes.some((code) => userHasMenuPermission(user, code));
}

/** 菜单权限判定用户：Query 真源，不再从 user_info 补丁合并 */
export function resolveUserForMenuPermission(user: CurrentUser | undefined): CurrentUser | undefined {
  return user ?? getSessionCurrentUser();
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
export function isAppGroupTitleItem(item: { key?: string; className?: string; path?: string }): boolean {
  const key = String(item.key ?? '');
  const cls = String(item.className ?? '');
  const path = String(item.path ?? '');
  return (
    key.startsWith('app-group-') ||
    path.startsWith('#app-group-') ||
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
 * 真源：菜单管理 / navigation-tree 同一棵库内菜单树；侧栏只是对该树做「当前用户 RBAC」过滤，
 * 不是第二套菜单配置。菜单管理展示全量（配置态），侧栏展示授权后可见子集（运行态）。
 *
 * 节点分类（唯一判定依据，禁止按 path 白名单补丁）：
 * - **可导航叶子**：有 `path`、非 `hideInMenu`、无可见子项 → 按本节点 permissionCodes 判定；
 *   仅挂 `entry`/`workspace` 时，用户**实际持有**该码则显示（如 KU-AI 以 entry 为应用门控）；
 *   **未声明权限码**时保留（如平台超管 `/infra/*`，由上游 `hasPlatformAdministrativeAuthority` 门控）。
 * - **可导航空壳**：有 `path` 且**声明了本应可见的子菜单**（非 hideInMenu），但过滤后无可见子项 → 一律隐藏
 *   （禁止靠 entry/workspace 撑开模具/巡查等空目录；昨日前端误伤 KU-AI 真叶子）。
 *   仅挂 `hideInMenu` 设计器子路由的列表页（审批流程/打印模板等）**不是**空壳，按本节点权限判定。
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
      /** 配置态声明过「侧栏应可见」的子项（不含设计器 hideInMenu） */
      const hasDeclaredNavigableChildren = (item.children ?? []).some(
        (child) => !child.hideInMenu && !isAppGroupPlaceholderItem(child),
      );
      const itemPath = String(item.path ?? '');
      const isNavigableMenuEntry =
        Boolean(item.path) && !item.hideInMenu && !itemPath.startsWith('#app-group-');

      // 占位子项：仅供 ProLayout 保留 SubMenu 壳，不参与权限过滤
      if (isAppGroupPlaceholderItem(item)) {
        return item;
      }

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

      const required = (permissionCodes ?? []).filter((c) => c && !isGenericMenuPermissionCode(c));
      if (isNavigableMenuEntry && !hasVisibleChildren) {
        // 声明了本应可见的子菜单却全部不可见：空目录，禁止靠 entry/workspace 撑开。
        // 仅挂 hideInMenu 设计器时 hasDeclaredNavigableChildren=false，按本节点权限保留。
        if (hasDeclaredNavigableChildren) {
          return null;
        }
        if (required.length > 0) {
          if (!hasAnyMenuPermission(user, required)) {
            return null;
          }
        } else {
          const raw = (permissionCodes ?? []).filter(Boolean);
          // 未声明权限码：保留（平台超管 infra 等由上游门控）；仅挂 entry/workspace 时须实际持有
          if (raw.length > 0) {
            if (!isAdminBypass(user) && !raw.some((code) => hasPermission(user, code))) {
              return null;
            }
          }
        }
      } else if (required.length > 0 && !hasAnyMenuPermission(user, required)) {
        return null;
      }

      if (!isNavigableMenuEntry && !hasVisibleChildren) {
        return null;
      }

      return { ...item, children: nextChildren };
    })
    .filter((m): m is T => m !== null);
}
