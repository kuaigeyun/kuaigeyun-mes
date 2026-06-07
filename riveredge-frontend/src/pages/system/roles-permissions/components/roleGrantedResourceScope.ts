/**
 * 角色「功能权限树 → 数据/字段权限」资源范围（唯一推导入口）。
 * 仅功能权限 TAB 中已勾选操作的菜单页进入数据/字段 TAB；禁止从 grantedCodes 扁平推导或菜单全量兜底。
 */

import type { FunctionGrantMenuNode } from '../../../../services/role';
import { codesFromAction, isActionGranted } from './FunctionGrantTree';
import { translateGrantMenuTitle } from './functionGrantTreeFilters';
import { permissionCodeToResourceKey, type ResourceOption } from './dataPermissionFilters';

export function normalizeResourceKey(resource: string): string {
  return resource.trim().toLowerCase();
}

/** 与后端 menu_resource_resolver.is_generic_menu_permission_code 对齐 */
export function isGenericPolicyResourceCode(norm: string): boolean {
  if (!norm) return true;
  const parts = norm.split(':').filter(Boolean);
  if (parts.length >= 3 && parts[parts.length - 1] === 'read') {
    const resource = parts.slice(1, -1).join(':');
    if (resource === 'workspace' || resource === parts[0]) return true;
  }
  return false;
}

/**
 * 功能权限矩阵树 + 当前勾选 code → 数据/字段权限可配置资源（唯一真源）。
 * 仅当菜单节点上至少有一项操作已勾选时，该页才进入第二、三 TAB。
 */
export function collectGrantedResourceOptionsFromGrantTree(
  tree: FunctionGrantMenuNode[],
  grantedCodes: string[],
  t: (key: string, opts?: { defaultValue?: string }) => string
): ResourceOption[] {
  const granted = new Set(
    grantedCodes.map((c) => String(c ?? '').trim().toLowerCase()).filter(Boolean)
  );
  if (granted.size === 0 || tree.length === 0) return [];

  const byKey = new Map<string, ResourceOption>();

  const walk = (nodes: FunctionGrantMenuNode[]) => {
    for (const node of nodes) {
      const hasGrantedAction = node.actions.some((a) => isActionGranted(a, granted));
      if (hasGrantedAction) {
        const label = translateGrantMenuTitle(node, t);
        for (const action of node.actions) {
          if (!isActionGranted(action, granted)) continue;
          for (const code of codesFromAction(action)) {
            const norm = String(code ?? '').trim().toLowerCase();
            if (!norm || isGenericPolicyResourceCode(norm)) continue;
            const key = permissionCodeToResourceKey(code);
            if (!key) continue;
            const nk = normalizeResourceKey(key);
            if (!byKey.has(nk)) {
              byKey.set(nk, { value: nk, label });
            }
          }
        }
      }
      if (node.children?.length) walk(node.children);
    }
  };

  walk(tree);
  return Array.from(byKey.values()).sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
}

/** 由功能权限树推导出的 app:resource 键集合 */
export function collectGrantedResourceKeysFromGrantTree(
  tree: FunctionGrantMenuNode[],
  grantedCodes: string[]
): Set<string> {
  const keys = new Set<string>();
  for (const opt of collectGrantedResourceOptionsFromGrantTree(tree, grantedCodes, (k, o) =>
    o?.defaultValue ?? k
  )) {
    keys.add(normalizeResourceKey(opt.value));
  }
  return keys;
}
