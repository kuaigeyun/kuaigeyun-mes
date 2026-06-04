import type { FieldPermissionPolicy } from '../../../../services/role';
import type { MenuTree } from '../../../../services/menu';
import { canonicalizeFieldName } from '../../../../utils/fieldMaskPermission';
import {
  filterDataResourceOptions,
  type DataPermissionFilterMode,
  type ResourceOption,
} from './dataPermissionFilters';
import { normalizeResourceKey } from './roleGrantedResourceScope';

function policyRowKey(resource: string, fieldName: string): string {
  return `${normalizeResourceKey(resource)}::${canonicalizeFieldName(fieldName)}`;
}

export function upsertFieldPolicyMask(
  policies: FieldPermissionPolicy[],
  item: FieldPermissionPolicy,
  maskLevel: FieldPermissionPolicy['mask_level']
): FieldPermissionPolicy[] {
  const targetKey = policyRowKey(item.resource, item.field_name);
  let found = false;
  const next = policies.map((p) => {
    if (policyRowKey(p.resource, p.field_name) !== targetKey) return p;
    found = true;
    return { ...p, mask_level: maskLevel };
  });
  if (found) return next;
  return [...next, { ...item, mask_level: maskLevel }];
}

/**
 * 按功能已授权资源 + 全部/APP/模块/搜索，筛选字段策略行索引。
 * policies 须来自后端 GET /permission-policies/roles/{uuid}/field（含内置合成行）。
 */
export function filterVisibleFieldPolicyIndexes(
  policies: FieldPermissionPolicy[],
  grantedResourceKeys: Set<string>,
  resourceLabelsByKey: Map<string, string>,
  menuTree: MenuTree[],
  mode: DataPermissionFilterMode,
  target: string,
  keyword: string,
  fieldLabelResolver: (item: FieldPermissionPolicy) => string
): number[] {
  if (grantedResourceKeys.size === 0) return [];

  const resourceOpts: ResourceOption[] = [];
  const seen = new Set<string>();
  for (const key of grantedResourceKeys) {
    const nk = normalizeResourceKey(key);
    if (!nk || seen.has(nk)) continue;
    seen.add(nk);
    resourceOpts.push({
      value: nk,
      label: resourceLabelsByKey.get(nk) || nk,
    });
  }

  const filteredResources = filterDataResourceOptions(resourceOpts, menuTree, mode, target, keyword);
  const allowedResources = new Set(filteredResources.map((o) => normalizeResourceKey(o.value)));

  if (mode === 'search') {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return [];
    const indexes: number[] = [];
    policies.forEach((item, idx) => {
      const nk = normalizeResourceKey(item.resource || '');
      if (!grantedResourceKeys.has(nk)) return;
      const resourceHit = allowedResources.has(nk);
      const label = fieldLabelResolver(item).toLowerCase();
      const fieldName = (item.field_name || '').toLowerCase();
      const fieldHit = label.includes(kw) || fieldName.includes(kw);
      if (resourceHit || fieldHit) indexes.push(idx);
    });
    return indexes;
  }

  const indexes: number[] = [];
  policies.forEach((item, idx) => {
    const nk = normalizeResourceKey(item.resource || '');
    if (grantedResourceKeys.has(nk) && allowedResources.has(nk)) indexes.push(idx);
  });
  return indexes;
}
