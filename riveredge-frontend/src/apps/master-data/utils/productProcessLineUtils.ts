import type { TFunction } from 'i18next';
import type { Operation } from '../types/process';
import type { ProductProcessLine } from '../types/productProcess';
import type { OperationItem } from '../components/OperationSequenceEditor';
import { parseOperationSequenceFromRoute } from './processRouteSequenceUtils';

function readIdList(...candidates: unknown[]): number[] {
  for (const c of candidates) {
    if (!Array.isArray(c)) continue;
    const ids = c.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
    if (ids.length) return ids;
  }
  return [];
}

function hasIdList(v?: number[]): boolean {
  return Array.isArray(v) && v.length > 0;
}

/** 从工序主数据读取默认车间/人员/小组/设备 */
export function resourcesFromOperation(
  op: Operation | undefined,
  userIdToUuid?: Map<number, string>,
): Pick<ProductProcessLine, 'workshopIds' | 'operatorIds' | 'teamIds' | 'equipmentIds'> {
  if (!op) {
    return { workshopIds: [], operatorIds: [], teamIds: [], equipmentIds: [] };
  }
  const o = op as Operation & Record<string, unknown>;
  const workshopIds = readIdList(o.defaultWorkshopIds, o.default_workshop_ids);
  const teamIds = readIdList(o.defaultTeamIds, o.default_team_ids);
  let operatorIds = readIdList(o.defaultOperatorIds, o.default_operator_ids);
  if (!operatorIds.length) {
    const uuids = (o.defaultOperatorUuids ?? o.default_operator_uuids ?? []) as string[];
    for (const uuid of uuids) {
      if (!uuid || !userIdToUuid) continue;
      for (const [id, u] of userIdToUuid.entries()) {
        if (u === uuid) {
          operatorIds.push(id);
          break;
        }
      }
    }
  }
  const equipmentIds = readIdList(o.defaultEquipmentIds, o.default_equipment_ids);
  return { workshopIds, operatorIds, teamIds, equipmentIds };
}

/** 从路线序列行或工序主数据合并资源（行优先，否则工序默认） */
export function resourcesFromRowAndOperation(
  row: Record<string, unknown> | undefined,
  op: Operation | undefined,
  userIdToUuid?: Map<number, string>,
): Pick<ProductProcessLine, 'workshopIds' | 'operatorIds' | 'teamIds' | 'equipmentIds'> {
  const fromOp = resourcesFromOperation(op, userIdToUuid);
  if (!row) return fromOp;

  const ws = readIdList(row.workshop_ids, row.workshopIds);
  const workshopIds = ws.length ? ws : readIdList(row.workshop_id, row.workshopId).length
    ? readIdList(row.workshop_id, row.workshopId)
    : fromOp.workshopIds;

  const opIds = readIdList(row.operator_ids, row.operatorIds);
  const operatorIds = opIds.length
    ? opIds
    : readIdList(row.assigned_worker_id, row.assignedWorkerId).length
      ? readIdList(row.assigned_worker_id, row.assignedWorkerId)
      : fromOp.operatorIds;

  const teamIds = readIdList(row.team_ids, row.teamIds).length
    ? readIdList(row.team_ids, row.teamIds)
    : readIdList(row.assigned_team_id, row.assignedTeamId).length
      ? readIdList(row.assigned_team_id, row.assignedTeamId)
      : fromOp.teamIds;

  const eq = readIdList(row.equipment_ids, row.equipmentIds);
  const equipmentIds = eq.length
    ? eq
    : readIdList(row.assigned_equipment_id, row.assignedEquipmentId).length
      ? readIdList(row.assigned_equipment_id, row.assignedEquipmentId)
      : fromOp.equipmentIds;

  return { workshopIds, operatorIds, teamIds, equipmentIds };
}

export function enrichLineFromOperation(
  line: ProductProcessLine,
  op: Operation | undefined,
  userIdToUuid?: Map<number, string>,
): ProductProcessLine {
  const fromOp = resourcesFromOperation(op, userIdToUuid);
  return {
    ...line,
    workshopIds: hasIdList(line.workshopIds) ? line.workshopIds : fromOp.workshopIds,
    operatorIds: hasIdList(line.operatorIds) ? line.operatorIds : fromOp.operatorIds,
    teamIds: hasIdList(line.teamIds) ? line.teamIds : fromOp.teamIds,
    equipmentIds: hasIdList(line.equipmentIds) ? line.equipmentIds : fromOp.equipmentIds,
  };
}

function parseSequenceToRowDicts(seq: unknown): Record<string, unknown>[] {
  if (!seq) return [];
  const result: Record<string, unknown>[] = [];

  if (Array.isArray(seq)) {
    for (const item of seq) {
      if (item && typeof item === 'object') {
        const u = (item as Record<string, unknown>).uuid ?? (item as Record<string, unknown>).operation_uuid;
        if (u) result.push({ ...(item as Record<string, unknown>) });
      } else if (typeof item === 'string') {
        result.push({ uuid: item });
      }
    }
    return result;
  }

  if (typeof seq !== 'object' || seq === null) return result;
  const seqObj = seq as Record<string, unknown>;
  const ops = seqObj.operations;
  const order = seqObj.sequence;

  if (Array.isArray(ops) && Array.isArray(order)) {
    const opByUuid: Record<string, Record<string, unknown>> = {};
    for (const o of ops) {
      if (o && typeof o === 'object') {
        const u = String((o as Record<string, unknown>).uuid ?? (o as Record<string, unknown>).operation_uuid ?? '');
        if (u) opByUuid[u] = o as Record<string, unknown>;
      }
    }
    for (const u of order) {
      const su = String(u);
      result.push(opByUuid[su] ? { ...opByUuid[su] } : { uuid: su });
    }
    return result;
  }

  if (Array.isArray(ops)) {
    for (const o of ops) {
      if (o && typeof o === 'object') {
        const u = (o as Record<string, unknown>).uuid ?? (o as Record<string, unknown>).operation_uuid;
        if (u) result.push({ ...(o as Record<string, unknown>) });
      }
    }
  }
  return result;
}

export function buildLineFromRowAndOperation(
  row: Record<string, unknown>,
  op: Operation | undefined,
  userIdToUuid?: Map<number, string>,
): ProductProcessLine {
  const uid = String(row.uuid ?? row.operation_uuid ?? '');
  const resources = resourcesFromRowAndOperation(row, op, userIdToUuid);
  return {
    operationUuid: uid,
    operationId: Number(row.operation_id ?? row.operationId ?? op?.id) || op?.id,
    code: String(row.code ?? op?.code ?? ''),
    name: String(row.name ?? op?.name ?? ''),
    standardTime: _floatOrUndef(row.standard_time ?? row.standardTime),
    setupTime: _floatOrUndef(row.setup_time ?? row.setupTime),
    ...resources,
    reportingType: String(row.reporting_type ?? row.reportingType ?? op?.reportingType ?? 'quantity'),
    isNodeOperation: Boolean(row.is_node_operation ?? row.isNodeOperation ?? false),
    overReportMode: String(row.over_report_mode ?? row.overReportMode ?? 'none'),
    overReportValue: Number(row.over_report_value ?? row.overReportValue ?? 0) || 0,
  };
}

function _floatOrUndef(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function snapshotProductProcessState(input: {
  processRouteUuid?: string;
  allowOperationJump: boolean;
  lines: ProductProcessLine[];
}): string {
  return JSON.stringify(input);
}

export function operationItemsToLines(
  items: OperationItem[],
  operationByUuid: Record<string, Operation>,
  userIdToUuid?: Map<number, string>,
): ProductProcessLine[] {
  return items.map((item) => {
    const op = operationByUuid[item.uuid];
    const base: ProductProcessLine = {
      operationUuid: item.uuid,
      operationId: op?.id ?? (op as { id?: number })?.id,
      code: item.code,
      name: item.name,
      standardTime: item.standardTime,
      setupTime: item.setupTime,
      reportingType: item.reportingType ?? 'quantity',
      isNodeOperation: item.isNodeOperation ?? false,
      overReportMode: item.overReportMode ?? 'none',
      overReportValue: item.overReportValue ?? 0,
    };
    return enrichLineFromOperation(base, op, userIdToUuid);
  });
}

export async function linesFromProcessRoute(
  operationSequence: unknown,
  allowOperationJump: boolean,
  t: TFunction,
  loadAllOperations: () => Promise<Operation[]>,
  userIdToUuid?: Map<number, string>,
): Promise<ProductProcessLine[]> {
  const all = await loadAllOperations();
  const byUuid: Record<string, Operation> = {};
  for (const o of all) byUuid[o.uuid] = o;

  const rowDicts = parseSequenceToRowDicts(operationSequence);
  let lines: ProductProcessLine[];
  if (rowDicts.length) {
    lines = rowDicts
      .map((row) => {
        const uid = String(row.uuid ?? row.operation_uuid ?? '');
        return buildLineFromRowAndOperation(row, byUuid[uid], userIdToUuid);
      })
      .filter((ln) => ln.operationUuid);
  } else {
    const items = await parseOperationSequenceFromRoute(operationSequence, t, async () => all);
    lines = operationItemsToLines(items, byUuid, userIdToUuid);
  }

  if (!allowOperationJump) {
    return lines.map((ln) => ({ ...ln, isNodeOperation: false }));
  }
  return lines;
}

/** 人员/小组选择值（与工序表单 defaultPersonnelConfigs 一致） */
export function lineToPersonnelConfigs(
  line: ProductProcessLine,
  userIdToUuid: Map<number, string>,
): string[] {
  const values: string[] = [];
  for (const id of line.operatorIds ?? []) {
    const uuid = userIdToUuid.get(id);
    if (uuid) values.push(`U_${uuid}`);
  }
  for (const id of line.teamIds ?? []) {
    values.push(`T_${id}`);
  }
  return values;
}

export function parsePersonnelConfigs(
  configs: string[],
  userUuidToId: Map<string, number>,
): { operatorIds: number[]; teamIds: number[] } {
  const operatorIds: number[] = [];
  const teamIds: number[] = [];
  for (const c of configs) {
    if (c.startsWith('U_')) {
      const id = userUuidToId.get(c.slice(2));
      if (id != null) operatorIds.push(id);
    } else if (c.startsWith('T_')) {
      const tid = Number(c.slice(2));
      if (Number.isFinite(tid)) teamIds.push(tid);
    }
  }
  return { operatorIds, teamIds };
}
