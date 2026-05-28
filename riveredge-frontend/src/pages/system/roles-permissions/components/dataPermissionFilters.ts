import type { MenuTree } from '../../../../services/menu';
import {
  extractAppCodeFromPath,
  getAppDisplayName,
  translateAppMenuItemName,
  translateMenuName,
} from '../../../../utils/menuTranslation';
import type { FunctionGrantFilterMode } from './functionGrantTreeFilters';

export type DataPermissionFilterMode = FunctionGrantFilterMode;

export interface DataFilterPickOption {
  value: string;
  label: string;
}

export interface ResourceOption {
  value: string;
  label: string;
}

function menuNodeTitle(
  menu: MenuTree,
  t: (key: string, opts?: { defaultValue?: string }) => string
): string {
  const path = menu.path;
  const isAppMenu = (path || '').startsWith('/apps/');
  if (isAppMenu) {
    const normalized = (path || '').replace(/\/$/, '');
    const isAppRoot = !path || /^\/apps\/[^/]+$/.test(normalized);
    if (isAppRoot) {
      const appCode = extractAppCodeFromPath(path);
      if (appCode) {
        const dn = getAppDisplayName(appCode, t, menu.name || appCode);
        if (dn) return dn;
      }
    }
    return translateAppMenuItemName(menu.name, path, t, menu.children);
  }
  return translateMenuName(menu.name, t, menu.path);
}

/** 菜单 permission_code → 数据权限资源键 app:resource */
export function permissionCodeToResourceKey(code: string): string | null {
  const norm = code.trim().toLowerCase();
  const parts = norm.split(':').filter(Boolean);
  if (parts.length < 2) return null;
  const app = parts[0];
  const resource = parts.length >= 3 ? parts.slice(1, -1).join(':') : parts[1];
  return `${app}:${resource}`;
}

export function collectResourceKeysFromMenus(nodes: MenuTree[]): Set<string> {
  const keys = new Set<string>();
  const walk = (list: MenuTree[]) => {
    for (const menu of list) {
      const code = menu.permission_code?.trim();
      if (code) {
        const key = permissionCodeToResourceKey(code);
        if (key) keys.add(key);
      }
      if (menu.children?.length) walk(menu.children);
    }
  };
  walk(nodes);
  return keys;
}

function findMenuNode(nodes: MenuTree[], menuUuid: string): MenuTree | null {
  for (const menu of nodes) {
    if (menu.uuid === menuUuid) return menu;
    if (menu.children?.length) {
      const hit = findMenuNode(menu.children, menuUuid);
      if (hit) return hit;
    }
  }
  return null;
}

/** 一级：应用（value 为 app 前缀，与资源键 app:resource 对齐） */
export function collectDataAppPickOptions(
  nodes: MenuTree[],
  t: (key: string, opts?: { defaultValue?: string }) => string
): DataFilterPickOption[] {
  const opts: DataFilterPickOption[] = [];
  for (const menu of nodes) {
    const path = menu.path || '';
    if (path.startsWith('/apps/')) {
      const app = extractAppCodeFromPath(path);
      if (app) {
        opts.push({ value: app, label: getAppDisplayName(app, t, menuNodeTitle(menu, t)) });
      }
    } else if (path.startsWith('/system')) {
      opts.push({
        value: 'system',
        label: getAppDisplayName('system', t, menuNodeTitle(menu, t)),
      });
    }
  }
  return opts.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
}

/** 二级：模块（value 为菜单 uuid，筛选该节点子树内资源） */
export function collectDataModulePickOptions(
  nodes: MenuTree[],
  t: (key: string, opts?: { defaultValue?: string }) => string
): DataFilterPickOption[] {
  const out: DataFilterPickOption[] = [];
  const walk = (list: MenuTree[], depth: number, parentLabel: string) => {
    for (const menu of list) {
      const title = menuNodeTitle(menu, t);
      const label = parentLabel ? `${parentLabel} / ${title}` : title;
      if (depth === 1) {
        out.push({ value: menu.uuid, label });
      }
      if (menu.children?.length) {
        walk(menu.children, depth + 1, depth === 0 ? title : label);
      }
    }
  };
  walk(nodes, 0, '');
  return out;
}

/** 按全部 / APP / 模块 / 搜索筛选数据权限资源列表 */
export function filterDataResourceOptions(
  options: ResourceOption[],
  menuTree: MenuTree[],
  mode: DataPermissionFilterMode,
  target: string,
  keyword: string
): ResourceOption[] {
  if (mode === 'all') return options;
  if (mode === 'app' && target) {
    const prefix = `${target}:`;
    return options.filter((o) => o.value.startsWith(prefix));
  }
  if (mode === 'module' && target) {
    const node = findMenuNode(menuTree, target);
    if (!node) return [];
    const keys = collectResourceKeysFromMenus([node]);
    return options.filter((o) => keys.has(o.value));
  }
  if (mode === 'search') {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return [];
    return options.filter(
      (o) => o.label.toLowerCase().includes(kw) || o.value.toLowerCase().includes(kw)
    );
  }
  return options;
}
