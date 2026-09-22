import dayjs from 'dayjs';
import type {
  GanttTaskLevel,
  WorkOrderForGantt,
  WorkstationResource,
} from '../../../components/GanttSchedulingChart/types';
import { toApiDateTimeString } from '../../../../../utils/formDate';
import { isOutsourceGanttOperation } from '../../../components/GanttSchedulingChart/stationResourceUtils';
import { resolveWorkerIdsForOperation } from '../../../components/GanttSchedulingChart/workerResourceUtils';
import type { SchedulingEquipmentResource, SchedulingWorkerResource } from './schedulingResourceFilters';
import type { SchedulingLoadTableRow } from './schedulingLoadTableUtils';
import type { VisualSchedulingBoardScan } from '../../../services/production';
import { buildSchedulingLoadTableRows } from './schedulingLoadTableUtils';

export interface SchedulingCardOperationItem {
  kind: 'operation';
  operationId: number;
  workOrderId: number;
  workOrderCode: string;
  productName: string;
  operationName: string;
  plannedStart: string;
  plannedEnd: string;
  progress: number;
  machineSessionState?: 'none' | 'on_machine' | 'off_machine' | null;
  /** 工单状态（如 draft / released / in_progress） */
  workOrderStatus?: string;
  hasMaterialIssue: boolean;
  isFrozen: boolean;
  isOverdue: boolean;
  focusTaskId: string;
}

/** 卡片框线场景：严重度靠前，用于单一边框色 */
export type SchedulingCardBorderScenario =
  | 'overdue'
  | 'material'
  | 'frozen'
  | 'draft'
  | 'on_machine'
  | 'off_machine'
  | 'normal';

export function resolveSchedulingCardBorderScenario(
  item: Pick<
    SchedulingCardOperationItem,
    'isOverdue' | 'hasMaterialIssue' | 'isFrozen' | 'workOrderStatus' | 'machineSessionState'
  >,
): SchedulingCardBorderScenario {
  if (item.isOverdue) return 'overdue';
  if (item.hasMaterialIssue) return 'material';
  if (item.isFrozen) return 'frozen';
  if (String(item.workOrderStatus || '').toLowerCase() === 'draft') return 'draft';
  if (item.machineSessionState === 'on_machine') return 'on_machine';
  if (item.machineSessionState === 'off_machine') return 'off_machine';
  return 'normal';
}

export interface SchedulingCardIdleItem {
  kind: 'idle';
  idleMinutes: number;
  gapStartMs: number;
  gapEndMs: number;
}

export type SchedulingCardTimelineItem = SchedulingCardOperationItem | SchedulingCardIdleItem;

export function listSchedulingCardOperations(
  items: SchedulingCardTimelineItem[]
): SchedulingCardOperationItem[] {
  return items.filter((item): item is SchedulingCardOperationItem => item.kind === 'operation');
}

export type SchedulingCardOperationDateUpdate = {
  operation_id: number;
  planned_start_date: string;
  planned_end_date: string;
};

function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }
  const next = items.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export type SchedulingCardResourceMove = {
  operationId: number;
  fromResourceId: number;
  toResourceId: number;
};

export function cardLaneDroppableId(resourceId: number): string {
  return `lane:${resourceId}`;
}

export function parseCardLaneDroppableId(id: string | number): number | null {
  if (typeof id !== 'string' || !id.startsWith('lane:')) return null;
  const resourceId = Number(id.slice(5));
  return Number.isInteger(resourceId) ? resourceId : null;
}

/** 泳道内拖拽改序：以当前最早开工时刻为锚点，按新顺序首尾相接重排各工序时段。 */
export function buildCardLaneReorderUpdates(
  operations: SchedulingCardOperationItem[],
  fromIndex: number,
  toIndex: number
): SchedulingCardOperationDateUpdate[] {
  if (operations.length < 2 || fromIndex === toIndex) return [];
  const ordered = moveArrayItem(operations, fromIndex, toIndex);
  const anchorMs = Math.min(...operations.map((op) => dayjs(op.plannedStart).valueOf()));
  let cursor = dayjs(anchorMs);
  const updates: SchedulingCardOperationDateUpdate[] = [];

  for (const op of ordered) {
    const durationMs = Math.max(60_000, dayjs(op.plannedEnd).valueOf() - dayjs(op.plannedStart).valueOf());
    const newEnd = cursor.add(durationMs, 'millisecond');
    const planned_start_date = toApiDateTimeString(cursor);
    const planned_end_date = toApiDateTimeString(newEnd);
    if (!planned_start_date || !planned_end_date) {
      cursor = newEnd;
      continue;
    }
    if (planned_start_date !== op.plannedStart || planned_end_date !== op.plannedEnd) {
      updates.push({
        operation_id: op.operationId,
        planned_start_date,
        planned_end_date,
      });
    }
    cursor = newEnd;
  }

  return updates;
}

export interface SchedulingCardResourceRow {
  resourceId: number;
  resourceName: string;
  resourceCode?: string;
  scheduledHours: number;
  operationCount: number;
  workOrderCount: number;
  loadRate: number;
  overloaded: boolean;
  items: SchedulingCardTimelineItem[];
}

type ScheduledOp = {
  operationId: number;
  workOrder: WorkOrderForGantt;
  operation: NonNullable<WorkOrderForGantt['operations']>[number];
  startMs: number;
  endMs: number;
};

const IDLE_GAP_MINUTES = 5;

function operationProgress(wo: WorkOrderForGantt): number {
  const qty = Number(wo.quantity) || 1;
  const completed = Number(wo.completed_quantity) || 0;
  return qty > 0 ? Math.min(100, Math.round((completed / qty) * 100)) : 0;
}

function resolveResourceKeys(
  taskLevel: GanttTaskLevel,
  op: NonNullable<WorkOrderForGantt['operations']>[number]
): number[] {
  if (taskLevel === 'station') {
    if (isOutsourceGanttOperation(op)) return [-1];
    const stationId = Number(op.assigned_station_id ?? 0);
    return [stationId > 0 ? stationId : 0];
  }
  if (taskLevel === 'equipment') {
    const equipmentId = Number(op.assigned_equipment_id ?? 0);
    return equipmentId > 0 ? [equipmentId] : [];
  }
  if (taskLevel === 'worker') {
    return resolveWorkerIdsForOperation(op);
  }
  return [];
}

function collectScheduledOps(
  workOrders: WorkOrderForGantt[],
  taskLevel: GanttTaskLevel,
  materialIssueWorkOrderIds: Set<number>
): Map<number, ScheduledOp[]> {
  const byResource = new Map<number, ScheduledOp[]>();
  for (const wo of workOrders) {
    for (const op of wo.operations ?? []) {
      if (op.id == null || !op.planned_start_date || !op.planned_end_date) continue;
      const resourceKeys = resolveResourceKeys(taskLevel, op);
      if (resourceKeys.length === 0) continue;
      const startMs = dayjs(op.planned_start_date).valueOf();
      const endMs = dayjs(op.planned_end_date).valueOf();
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;
      for (const resourceKey of resourceKeys) {
        const bucket = byResource.get(resourceKey) ?? [];
        bucket.push({
          operationId: op.id,
          workOrder: wo,
          operation: op,
          startMs,
          endMs,
        });
        byResource.set(resourceKey, bucket);
      }
    }
  }
  for (const [key, list] of byResource) {
    list.sort((a, b) => a.startMs - b.startMs || a.operationId - b.operationId);
    byResource.set(key, list);
  }
  return byResource;
}

function buildTimelineItems(
  scheduled: ScheduledOp[],
  materialIssueWorkOrderIds: Set<number>
): SchedulingCardTimelineItem[] {
  const items: SchedulingCardTimelineItem[] = [];
  let prevEndMs: number | null = null;
  for (const entry of scheduled) {
    if (prevEndMs != null && entry.startMs > prevEndMs) {
      const gapMinutes = Math.round((entry.startMs - prevEndMs) / 60000);
      if (gapMinutes >= IDLE_GAP_MINUTES) {
        items.push({
          kind: 'idle',
          idleMinutes: gapMinutes,
          gapStartMs: prevEndMs,
          gapEndMs: entry.startMs,
        });
      }
    }
    const wo = entry.workOrder;
    const op = entry.operation;
    const end = dayjs(op.planned_end_date);
    items.push({
      kind: 'operation',
      operationId: entry.operationId,
      workOrderId: wo.id,
      workOrderCode: wo.code || String(wo.id),
      productName: wo.product_name || wo.name || '',
      operationName: op.operation_name || '',
      plannedStart: op.planned_start_date!,
      plannedEnd: op.planned_end_date!,
      progress: operationProgress(wo),
      machineSessionState: op.machine_session_state ?? 'none',
      workOrderStatus: wo.status,
      hasMaterialIssue: materialIssueWorkOrderIds.has(wo.id),
      isFrozen: Boolean(wo.is_frozen),
      isOverdue: end.isBefore(dayjs()) && wo.status !== 'completed',
      focusTaskId: `op-${entry.operationId}`,
    });
    prevEndMs = Math.max(prevEndMs ?? entry.endMs, entry.endMs);
  }
  return items;
}

function sumScheduledHours(items: SchedulingCardTimelineItem[]): number {
  let totalMs = 0;
  for (const item of items) {
    if (item.kind !== 'operation') continue;
    const start = dayjs(item.plannedStart);
    const end = dayjs(item.plannedEnd);
    totalMs += Math.max(0, end.valueOf() - start.valueOf());
  }
  return Math.round((totalMs / 3600000) * 10) / 10;
}

function loadMetaByResourceId(
  boardScan: VisualSchedulingBoardScan | null | undefined,
  taskLevel: GanttTaskLevel,
  horizonDays: number,
  workOrders: WorkOrderForGantt[]
): Map<number, SchedulingLoadTableRow> {
  const rows = buildSchedulingLoadTableRows(boardScan, taskLevel, horizonDays, workOrders);
  return new Map(rows.map((row) => [row.resourceId, row]));
}

function resourceCatalog(
  taskLevel: GanttTaskLevel,
  stations: WorkstationResource[],
  equipments: SchedulingEquipmentResource[],
  workers: SchedulingWorkerResource[]
): Array<{ id: number; name: string; code?: string }> {
  if (taskLevel === 'station') {
    return stations.map((s) => ({ id: s.id, name: s.name, code: s.code }));
  }
  if (taskLevel === 'equipment') {
    return equipments.map((e) => ({ id: e.id, name: e.name, code: e.code }));
  }
  if (taskLevel === 'worker') {
    return workers.map((w) => ({
      id: w.id,
      name: w.name || w.username || String(w.id),
      code: w.username,
    }));
  }
  return [];
}

export function buildSchedulingCardResourceRows(params: {
  workOrders: WorkOrderForGantt[];
  taskLevel: GanttTaskLevel;
  stations: WorkstationResource[];
  equipments: SchedulingEquipmentResource[];
  workers: SchedulingWorkerResource[];
  boardScan: VisualSchedulingBoardScan | null | undefined;
  horizonDays: number;
  materialIssueWorkOrderIds?: number[];
}): SchedulingCardResourceRow[] {
  const {
    workOrders,
    taskLevel,
    stations,
    equipments,
    workers,
    boardScan,
    horizonDays,
    materialIssueWorkOrderIds = [],
  } = params;

  if (taskLevel === 'work_order' || taskLevel === 'operation') return [];

  const materialSet = new Set(materialIssueWorkOrderIds);
  const scheduledByResource = collectScheduledOps(workOrders, taskLevel, materialSet);
  const loadMap = loadMetaByResourceId(boardScan, taskLevel, horizonDays, workOrders);
  const catalog = resourceCatalog(taskLevel, stations, equipments, workers);

  const rows: SchedulingCardResourceRow[] = catalog.map((resource) => {
    const scheduled = scheduledByResource.get(resource.id) ?? [];
    const items = buildTimelineItems(scheduled, materialSet);
    const workOrderIds = new Set(items.filter((i) => i.kind === 'operation').map((i) => i.workOrderId));
    const load = loadMap.get(resource.id);
    return {
      resourceId: resource.id,
      resourceName: resource.name,
      resourceCode: resource.code,
      scheduledHours: load?.scheduledHours ?? sumScheduledHours(items),
      operationCount: scheduled.length,
      workOrderCount: workOrderIds.size,
      loadRate: load?.loadRate ?? 0,
      overloaded: load?.overloaded ?? false,
      items,
    };
  });

  return rows.sort((a, b) => {
    if (a.overloaded !== b.overloaded) return a.overloaded ? -1 : 1;
    if (b.loadRate !== a.loadRate) return b.loadRate - a.loadRate;
    return a.resourceName.localeCompare(b.resourceName);
  });
}

export interface SchedulingPoolCardItem {
  workOrderId: number;
  workOrderCode: string;
  productName: string;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  readinessRate?: number | null;
  status?: string;
  priority?: string;
  isOverdue: boolean;
  hasMaterialIssue: boolean;
  diagnosticLabels: string[];
  aiRank?: number;
}

export function buildSchedulingPoolCardItems(
  workOrders: WorkOrderForGantt[],
  materialIssueWorkOrderIds: Set<number>,
  diagnosticLabelsById: Map<number, string[]>,
  aiRankById: Map<number, number>
): SchedulingPoolCardItem[] {
  return workOrders.map((wo) => ({
    workOrderId: wo.id,
    workOrderCode: wo.code || String(wo.id),
    productName: wo.product_name || wo.name || '',
    plannedStart: wo.planned_start_date,
    plannedEnd: wo.planned_end_date,
    readinessRate: wo.readiness_rate,
    status: wo.status,
    priority: wo.priority,
    isOverdue: Boolean(wo.planned_end_date && dayjs(wo.planned_end_date).isBefore(dayjs())),
    hasMaterialIssue: materialIssueWorkOrderIds.has(wo.id),
    diagnosticLabels: diagnosticLabelsById.get(wo.id) ?? [],
    aiRank: aiRankById.get(wo.id),
  }));
}
