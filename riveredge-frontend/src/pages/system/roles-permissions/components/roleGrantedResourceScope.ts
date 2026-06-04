/**
 * 角色「功能权限 → 数据/字段权限」资源范围（唯一前端推导入口）。
 * 数据权限页、字段权限页共用；字段策略行本身仅来自 GET .../field API（后端 list_field_policies）。
 */

import { getAppDisplayName } from '../../../../utils/menuTranslation';
import {
  permissionCodeToResourceKey,
  type ResourceOption,
} from './dataPermissionFilters';

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

/** 功能权限码列表 → 已授权 app:resource 键集合 */
export function collectGrantedResourceKeys(grantedCodes: string[]): Set<string> {
  const keys = new Set<string>();
  for (const code of grantedCodes) {
    const norm = String(code ?? '').trim().toLowerCase();
    if (!norm || isGenericPolicyResourceCode(norm)) continue;
    const key = permissionCodeToResourceKey(code);
    if (key) keys.add(normalizeResourceKey(key));
  }
  return keys;
}

/** 已授权资源 → 带菜单文案的选项（数据/字段权限筛选用） */
export function buildFunctionScopedResourceOptions(
  grantedResourceKeys: Set<string>,
  menuResourceOptions: ResourceOption[],
  t: (key: string, opts?: { defaultValue?: string }) => string
): ResourceOption[] {
  if (grantedResourceKeys.size === 0) return [];
  const byKey = new Map<string, ResourceOption>();
  for (const opt of menuResourceOptions) {
    const nk = normalizeResourceKey(opt.value);
    if (grantedResourceKeys.has(nk)) {
      byKey.set(nk, opt);
    }
  }
  for (const key of grantedResourceKeys) {
    const nk = normalizeResourceKey(key);
    if (byKey.has(nk)) continue;
    const [app, ...rest] = nk.split(':');
    const resource = rest.join(':');
    const appName = getAppDisplayName(app, t, app);
    byKey.set(nk, {
      value: nk,
      label: `${appName} / ${resource}`,
    });
  }
  return Array.from(byKey.values()).sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
}
