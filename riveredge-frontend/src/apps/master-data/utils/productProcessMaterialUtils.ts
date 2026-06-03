import type { Material } from '../types/material';
import type { ProcessRoute } from '../types/process';

/** 物料是否已有效指派工艺路线（路线存在且仍在主数据列表中） */
export function materialHasEffectiveProcessRoute(
  material: Material,
  processRoutes: ProcessRoute[],
): boolean {
  return resolveEffectiveProcessRouteUuid(material, processRoutes) != null;
}

/** 物料仍存有 process_route 引用，但对应路线已不存在（待保存清空） */
export function materialHasStaleProcessRouteReference(
  material: Material,
  processRoutes: ProcessRoute[],
): boolean {
  if (!processRoutes.length) return false;
  if (resolveEffectiveProcessRouteUuid(material, processRoutes)) return false;

  const prId = material.processRouteId ?? (material as { process_route_id?: number }).process_route_id;
  if (prId != null) return true;

  const defaults = (material.defaults ?? {}) as Record<string, unknown>;
  const rawUuid = defaults.defaultProcessRouteUuid ?? defaults.default_process_route_uuid;
  return Boolean(rawUuid && String(rawUuid).trim());
}

/**
 * 解析物料当前有效的工艺路线 UUID。
 * 仅当 FK/defaults 能对应到 processRoutes 中的记录时返回；已删除或无效的引用视为未指派。
 */
export function resolveEffectiveProcessRouteUuid(
  material: Material,
  processRoutes: ProcessRoute[],
): string | undefined {
  if (!processRoutes.length) return undefined;

  const prId = material.processRouteId ?? (material as { process_route_id?: number }).process_route_id;
  if (prId != null) {
    const route = processRoutes.find((r) => r.id === prId || (r as { id?: number }).id === prId);
    if (route?.uuid) return route.uuid;
  }

  const defaults = (material.defaults ?? {}) as Record<string, unknown>;
  const rawUuid = defaults.defaultProcessRouteUuid ?? defaults.default_process_route_uuid;
  const uuid = rawUuid ? String(rawUuid).trim() : '';
  if (uuid && processRoutes.some((r) => r.uuid === uuid)) return uuid;

  return undefined;
}

export function effectiveProcessRouteLabel(
  material: Material,
  processRoutes: ProcessRoute[],
  notSetText: string,
): string {
  const uuid = resolveEffectiveProcessRouteUuid(material, processRoutes);
  if (!uuid) return notSetText;
  const route = processRoutes.find((r) => r.uuid === uuid);
  if (route) return `${route.code} - ${route.name}`;
  return notSetText;
}
