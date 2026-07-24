import type { SOP } from '../types/process';

export type SopBindingConflict = {
  sop: SOP;
  kind: 'material' | 'material_group';
  scopeUuid: string;
};

function normalizeUuidList(values?: string[] | null): string[] {
  if (!values?.length) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const uuid = String(value ?? '').trim();
    if (!uuid || seen.has(uuid)) continue;
    seen.add(uuid);
    result.push(uuid);
  }
  return result;
}

function readSopBindingLists(sop: SOP & { material_uuids?: string[]; material_group_uuids?: string[] }) {
  return {
    materialUuids: normalizeUuidList(sop.materialUuids ?? sop.material_uuids),
    materialGroupUuids: normalizeUuidList(sop.materialGroupUuids ?? sop.material_group_uuids),
  };
}

export function findSopBindingConflicts(
  existingSops: SOP[],
  params: {
    operationId?: number | null;
    materialUuids?: string[] | null;
    materialGroupUuids?: string[] | null;
    excludeUuid?: string | null;
  },
): SopBindingConflict[] {
  const operationId = params.operationId ?? null;
  if (!operationId) return [];

  const materialUuids = normalizeUuidList(params.materialUuids);
  const materialGroupUuids = normalizeUuidList(params.materialGroupUuids);
  if (materialUuids.length === 0 && materialGroupUuids.length === 0) return [];

  const conflicts: SopBindingConflict[] = [];
  const seen = new Set<string>();

  for (const sop of existingSops) {
    if (params.excludeUuid && sop.uuid === params.excludeUuid) continue;
    const sopOperationId = sop.operationId ?? (sop as { operation_id?: number }).operation_id;
    if (sopOperationId !== operationId) continue;

    const { materialUuids: sopMaterials, materialGroupUuids: sopGroups } = readSopBindingLists(sop);

    for (const scopeUuid of materialUuids) {
      if (!sopMaterials.includes(scopeUuid)) continue;
      const key = `material:${scopeUuid}:${sop.uuid}`;
      if (seen.has(key)) continue;
      seen.add(key);
      conflicts.push({ sop, kind: 'material', scopeUuid });
    }

    for (const scopeUuid of materialGroupUuids) {
      if (!sopGroups.includes(scopeUuid)) continue;
      const key = `group:${scopeUuid}:${sop.uuid}`;
      if (seen.has(key)) continue;
      seen.add(key);
      conflicts.push({ sop, kind: 'material_group', scopeUuid });
    }
  }

  return conflicts;
}

export function getBoundOperationIds(
  existingSops: SOP[],
  params: {
    materialUuids?: string[] | null;
    materialGroupUuids?: string[] | null;
    excludeUuid?: string | null;
  },
): Set<number> {
  const materialUuids = normalizeUuidList(params.materialUuids);
  const materialGroupUuids = normalizeUuidList(params.materialGroupUuids);
  if (materialUuids.length === 0 && materialGroupUuids.length === 0) {
    return new Set();
  }

  const bound = new Set<number>();
  for (const sop of existingSops) {
    if (params.excludeUuid && sop.uuid === params.excludeUuid) continue;
    const operationId = sop.operationId ?? (sop as { operation_id?: number }).operation_id;
    if (!operationId) continue;

    const { materialUuids: sopMaterials, materialGroupUuids: sopGroups } = readSopBindingLists(sop);
    const materialHit = materialUuids.some((uuid) => sopMaterials.includes(uuid));
    const groupHit = materialGroupUuids.some((uuid) => sopGroups.includes(uuid));
    if (materialHit || groupHit) {
      bound.add(operationId);
    }
  }
  return bound;
}

export function formatSopBindingConflictLabels(
  conflicts: SopBindingConflict[],
  lookup: {
    getMaterialLabel: (uuid: string) => string;
    getMaterialGroupLabel: (uuid: string) => string;
    getOperationLabel: (operationId: number) => string;
  },
): string[] {
  return conflicts.map(({ sop, kind, scopeUuid }) => {
    const operationId = sop.operationId ?? (sop as { operation_id?: number }).operation_id;
    const scopeLabel =
      kind === 'material'
        ? lookup.getMaterialLabel(scopeUuid)
        : lookup.getMaterialGroupLabel(scopeUuid);
    const operationLabel = operationId ? lookup.getOperationLabel(operationId) : '-';
    return `${scopeLabel} + ${operationLabel} → ${sop.code}`;
  });
}
