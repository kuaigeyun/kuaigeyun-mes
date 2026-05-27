/**
 * 从菜单 permission_code / 标准权限码解析功能资源前缀（app:module）。
 */

import type { MenuTree } from '../services/menu';

export type ParsedPermissionCode = {
  app: string;
  resource: string;
  action: string;
};

const parseCache = new Map<string, ParsedPermissionCode | null>();

export function parseResourceAndAction(code: string): ParsedPermissionCode | null {
  if (!code) return null;
  let cached = parseCache.get(code);
  if (cached !== undefined) return cached;
  const parts = String(code).trim().split(':').filter(Boolean);
  if (parts.length < 3) {
    parseCache.set(code, null);
    return null;
  }
  const parsed: ParsedPermissionCode = {
    app: parts[0],
    resource: parts.slice(1, -1).join(':'),
    action: parts[parts.length - 1].toLowerCase(),
  };
  parseCache.set(code, parsed);
  return parsed;
}

/** 菜单 permission_code → 功能资源前缀，如 haoligo:molds-documents-outsource-maintenance */
export function resourcePrefixFromPermissionCode(code: string | null | undefined): string | null {
  const parsed = parseResourceAndAction(code || '');
  if (!parsed) return null;
  return `${parsed.app}:${parsed.resource}`;
}

export function buildPermissionCode(resource: string, action: string): string {
  return `${resource}:${action}`;
}

function normalizePath(path: string): string {
  const p = path.trim();
  if (!p) return '/';
  return p.endsWith('/') && p.length > 1 ? p.slice(0, -1) : p;
}

/** 在导航树中按 path 找叶子菜单（优先最长精确匹配） */
export function findMenuByPath(menus: MenuTree[], pathname: string): MenuTree | null {
  const target = normalizePath(pathname);
  let exact: MenuTree | null = null;
  let bestPrefix: MenuTree | null = null;
  let bestLen = -1;

  const walk = (nodes: MenuTree[]) => {
    for (const node of nodes) {
      const raw = node.path?.trim();
      if (raw) {
        const p = normalizePath(raw);
        if (p === target) {
          exact = node;
        } else if (target.startsWith(`${p}/`) && p.length > bestLen) {
          bestPrefix = node;
          bestLen = p.length;
        }
      }
      if (node.children?.length) walk(node.children);
    }
  };

  walk(menus);
  return exact ?? bestPrefix;
}

/** 由当前路由解析功能资源前缀；无菜单或未配置 permission_code 时返回 null */
export function resolvePermissionResourceFromMenus(
  menus: MenuTree[] | undefined,
  pathname: string,
): string | null {
  if (!menus?.length || !pathname) return null;
  const menu = findMenuByPath(menus, pathname);
  if (!menu?.permission_code) return null;
  return resourcePrefixFromPermissionCode(menu.permission_code);
}
