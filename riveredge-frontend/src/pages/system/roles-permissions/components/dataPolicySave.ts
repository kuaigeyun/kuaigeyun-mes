import type { DataPermissionPolicy } from '../../../../services/role';
import { normalizeResourceKey } from './roleGrantedResourceScope';

export function defaultCustomPayloadForResource(
  resource: string
): Record<string, unknown> | undefined {
  if (/outsource-maintenance|outsource-complete/.test(resource)) {
    return { resolver: 'outsourced_unit' };
  }
  if (/molds-documents-trial|molds-reports-trial-record/.test(resource)) {
    return { resolver: 'partner', dimension: 'supplier', code_field: 'supplier_code' };
  }
  if (/equipment-documents-acceptance|injection-documents-acceptance/.test(resource)) {
    return { resolver: 'partner', dimension: 'manufacturer', code_field: 'manufacturer_code' };
  }
  if (/finance-equipment-contracts|finance-equipment-payables|finance-reports-equipment-payable/.test(resource)) {
    return { resolver: 'partner', dimension: 'manufacturer', code_field: 'manufacturer_code' };
  }
  return undefined;
}

export type DataPolicySaveItem = Pick<
  DataPermissionPolicy,
  'resource' | 'scope_type' | 'scope_payload'
>;

/**
 * 组装数据权限保存载荷：
 * - 保留已有显式策略（功能权限范围内，含 scope_all）
 * - 已勾选行应用 batchScope
 * - 未勾选时，对当前可见资源应用 batchScope（无需再点「全选」）
 */
export function buildDataPolicySavePayload(params: {
  dataPolicies: DataPermissionPolicy[];
  selectedResources: string[];
  visibleResources: string[];
  batchScope: DataPermissionPolicy['scope_type'];
  grantedKeys: Set<string>;
}): DataPolicySaveItem[] {
  const { dataPolicies, selectedResources, visibleResources, batchScope, grantedKeys } = params;
  const map = new Map<string, DataPolicySaveItem>();

  for (const p of dataPolicies) {
    const nk = normalizeResourceKey(p.resource);
    if (!nk || !grantedKeys.has(nk)) continue;
    if (p.scope_type === 'scope_all') {
      // 「全部」须进 payload 并落库：外协角色的默认范围是「按绑定合作方」，
      // 缺这一行后端会当成「未配置」继续收敛。
      map.set(nk, {
        resource: nk,
        scope_type: 'scope_all',
        scope_payload: undefined,
      });
      continue;
    }
    map.set(nk, {
      resource: nk,
      scope_type: p.scope_type,
      scope_payload: p.scope_payload,
    });
  }

  const scopeTargets =
    selectedResources.length > 0
      ? selectedResources
      : batchScope === 'scope_all' ||
          batchScope === 'scope_self' ||
          batchScope === 'scope_department' ||
          batchScope === 'scope_custom'
        ? visibleResources
        : [];

  for (const r of scopeTargets) {
    const nk = normalizeResourceKey(r);
    if (!grantedKeys.has(nk)) continue;
    const prev = map.get(nk);
    map.set(nk, {
      resource: nk,
      scope_type: batchScope,
      scope_payload:
        batchScope === 'scope_custom'
          ? prev?.scope_payload ?? defaultCustomPayloadForResource(nk)
          : undefined,
    });
  }

  return Array.from(map.values());
}
