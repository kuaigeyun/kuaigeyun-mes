import type { FieldPermissionPolicy } from '../../../../services/role';
import type { MenuTree } from '../../../../services/menu';
import {
  filterDataResourceOptions,
  type DataPermissionFilterMode,
  type ResourceOption,
} from './dataPermissionFilters';

function normalizeResourceKey(resource: string): string {
  return resource.trim().toLowerCase();
}

/** 按功能已授权资源 + 全部/APP/模块/搜索，筛选可见的字段策略行索引 */
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
  for (const p of policies) {
    const resource = (p.resource || '').trim();
    const nk = normalizeResourceKey(resource);
    if (!nk || !grantedResourceKeys.has(nk) || seen.has(nk)) continue;
    seen.add(nk);
    resourceOpts.push({
      value: resource,
      label: resourceLabelsByKey.get(nk) || resource,
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
