import dayjs from 'dayjs';
import type { WorkOrderForGantt } from '../../../components/GanttSchedulingChart/types';

export type WorkOrderSchedulingMissingField = 'planned_start_date' | 'planned_end_date';

export interface OperationNeedingStation {
  operationId: number;
  operationName: string;
  sequence: number;
  workCenterId?: number | null;
  workCenterName?: string | null;
  assignedStationId?: number | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
}

export interface WorkOrderSchedulingPrepContext {
  missingFields: WorkOrderSchedulingMissingField[];
  operationsNeedingStation: OperationNeedingStation[];
}

export function getOperationsNeedingStation(wo: WorkOrderForGantt): OperationNeedingStation[] {
  return getOperationsForStationPrep(wo).filter(
    (op) => op.assignedStationId == null || Number(op.assignedStationId) <= 0
  );
}

/** 排产补充弹窗：列出全部工序供工位指派（不仅限于尚未分配工位的工序） */
export function getOperationsForStationPrep(wo: WorkOrderForGantt): OperationNeedingStation[] {
  return [...(wo.operations ?? [])]
    .filter((op) => op.id != null)
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    .map((op) => ({
      operationId: Number(op.id),
      operationName: op.operation_name || `工序${op.sequence ?? ''}`,
      sequence: op.sequence ?? 0,
      workCenterId: op.work_center_id ?? null,
      workCenterName: op.work_center_name ?? null,
      assignedStationId:
        op.assigned_station_id != null && Number(op.assigned_station_id) > 0
          ? Number(op.assigned_station_id)
          : null,
      plannedStartDate: op.planned_start_date ?? null,
      plannedEndDate: op.planned_end_date ?? null,
    }));
}

export const DEFAULT_OP_SCHEDULE_HOURS = 8;

export function operationPrepStartFieldName(operationId: number): string {
  return `op_start_${operationId}`;
}

export function operationPrepEndFieldName(operationId: number): string {
  return `op_end_${operationId}`;
}

function parseOptionalDayjs(value: unknown): dayjs.Dayjs | null {
  if (value == null || value === '') return null;
  if (dayjs.isDayjs(value)) return value;
  const parsed = dayjs(String(value));
  return parsed.isValid() ? parsed : null;
}

export interface OperationPrepScheduleResult {
  dates: Array<{ operation_id: number; planned_start_date: string; planned_end_date: string }>;
  adjustedOperationNames: string[];
}

function resolveSequentialOperationSlot(
  op: OperationNeedingStation,
  formValues: Record<string, unknown>,
  prevEnd: dayjs.Dayjs | null,
  hours: number,
  workOrderStart?: dayjs.Dayjs | null
): {
  start: dayjs.Dayjs;
  end: dayjs.Dayjs;
  adjusted: boolean;
  nextPrevEnd: dayjs.Dayjs;
} {
  const startRaw = parseOptionalDayjs(formValues[operationPrepStartFieldName(op.operationId)]);
  const endRaw = parseOptionalDayjs(formValues[operationPrepEndFieldName(op.operationId)]);

  let adjusted = false;
  let start: dayjs.Dayjs;
  if (startRaw) {
    start = startRaw;
  } else if (prevEnd) {
    start = prevEnd;
  } else {
    start = dayjs().startOf('hour').add(1, 'hour');
  }

  if (workOrderStart?.isValid() && start.isBefore(workOrderStart)) {
    start = workOrderStart;
    adjusted = true;
  }
  if (prevEnd && start.isBefore(prevEnd)) {
    start = prevEnd;
    adjusted = true;
  }

  let end: dayjs.Dayjs;
  if (endRaw) {
    end = endRaw;
  } else {
    end = start.add(hours, 'hour');
  }

  if (!end.isAfter(start)) {
    end = start.add(hours, 'hour');
    adjusted = true;
  }

  return { start, end, adjusted, nextPrevEnd: end };
}

/** 补充排产弹窗：按工序顺序解析计划时间（未填开始则接上道工序结束；乱序则自动顺延） */
export function resolveOperationPrepScheduleDates(
  operations: OperationNeedingStation[],
  formValues: Record<string, unknown>,
  options?: { workOrderStart?: string | null; defaultDurationHours?: number }
): OperationPrepScheduleResult {
  const hours = options?.defaultDurationHours ?? DEFAULT_OP_SCHEDULE_HOURS;
  const sorted = [...operations].sort((a, b) => a.sequence - b.sequence);
  const workOrderStart = options?.workOrderStart ? dayjs(options.workOrderStart) : null;
  const validWorkOrderStart = workOrderStart?.isValid() ? workOrderStart : null;

  let prevEnd: dayjs.Dayjs | null = validWorkOrderStart;
  const dates: OperationPrepScheduleResult['dates'] = [];
  const adjustedOperationNames: string[] = [];

  for (const op of sorted) {
    const slot = resolveSequentialOperationSlot(op, formValues, prevEnd, hours, validWorkOrderStart);
    if (slot.adjusted) {
      adjustedOperationNames.push(op.operationName);
    }
    dates.push({
      operation_id: op.operationId,
      planned_start_date: slot.start.toISOString(),
      planned_end_date: slot.end.toISOString(),
    });
    prevEnd = slot.nextPrevEnd;
  }

  return { dates, adjustedOperationNames };
}

/** 将工序计划时间转为表单字段（打开弹窗时归一化乱序时间线） */
export function operationPrepScheduleDatesToFormValues(
  result: OperationPrepScheduleResult
): Record<string, dayjs.Dayjs> {
  return Object.fromEntries(
    result.dates.flatMap(({ operation_id, planned_start_date, planned_end_date }) => [
      [operationPrepStartFieldName(operation_id), dayjs(planned_start_date)],
      [operationPrepEndFieldName(operation_id), dayjs(planned_end_date)],
    ])
  );
}

/** 编辑某一工序时间后，自该工序起向下游顺延，保持顺序时间线 */
export function cascadeOperationPrepScheduleFromIndex(
  operations: OperationNeedingStation[],
  formValues: Record<string, unknown>,
  fromIndex: number,
  options?: { workOrderStart?: string | null; defaultDurationHours?: number }
): Record<string, dayjs.Dayjs> {
  const hours = options?.defaultDurationHours ?? DEFAULT_OP_SCHEDULE_HOURS;
  const sorted = [...operations].sort((a, b) => a.sequence - b.sequence);
  const workOrderStart = options?.workOrderStart ? dayjs(options.workOrderStart) : null;
  const validWorkOrderStart = workOrderStart?.isValid() ? workOrderStart : null;

  let prevEnd: dayjs.Dayjs | null = validWorkOrderStart;
  const patches: Record<string, dayjs.Dayjs> = {};

  for (let index = 0; index < sorted.length; index += 1) {
    const op = sorted[index];
    const slot = resolveSequentialOperationSlot(op, formValues, prevEnd, hours, validWorkOrderStart);
    if (index >= fromIndex) {
      patches[operationPrepStartFieldName(op.operationId)] = slot.start;
      patches[operationPrepEndFieldName(op.operationId)] = slot.end;
    }
    prevEnd = slot.nextPrevEnd;
  }

  return patches;
}

export function mapOperationForGantt(
  op: Record<string, unknown>
): NonNullable<WorkOrderForGantt['operations']>[number] {
  const id = Number(op.id);
  return {
    id: Number.isInteger(id) && id > 0 ? id : undefined,
    operation_name: (op.operation_name as string | null | undefined) ?? null,
    sequence: op.sequence != null ? Number(op.sequence) : undefined,
    work_center_id:
      op.work_center_id != null && Number(op.work_center_id) > 0 ? Number(op.work_center_id) : null,
    work_center_name: (op.work_center_name as string | null | undefined) ?? null,
    planned_start_date: (op.planned_start_date as string | null | undefined) ?? null,
    planned_end_date: (op.planned_end_date as string | null | undefined) ?? null,
    assigned_station_id:
      op.assigned_station_id != null && Number(op.assigned_station_id) > 0
        ? Number(op.assigned_station_id)
        : null,
    assigned_station_name: (op.assigned_station_name as string | null | undefined) ?? null,
    assigned_equipment_id:
      op.assigned_equipment_id != null && Number(op.assigned_equipment_id) > 0
        ? Number(op.assigned_equipment_id)
        : null,
    assigned_equipment_name: (op.assigned_equipment_name as string | null | undefined) ?? null,
    assigned_mold_name: (op.assigned_mold_name as string | null | undefined) ?? null,
    assigned_tool_name: (op.assigned_tool_name as string | null | undefined) ?? null,
  };
}

export function getWorkOrderSchedulingMissingFields(
  wo: Pick<WorkOrderForGantt, 'planned_start_date' | 'planned_end_date'>
): WorkOrderSchedulingMissingField[] {
  const missing: WorkOrderSchedulingMissingField[] = [];
  if (!wo.planned_start_date) missing.push('planned_start_date');
  if (!wo.planned_end_date) missing.push('planned_end_date');
  return missing;
}

export function getWorkOrderSchedulingPrepContext(wo: WorkOrderForGantt): WorkOrderSchedulingPrepContext {
  return {
    missingFields: getWorkOrderSchedulingMissingFields(wo),
    operationsNeedingStation: getOperationsForStationPrep(wo),
  };
}

export function workOrderNeedsSchedulingPrep(wo: WorkOrderForGantt): boolean {
  const ctx = getWorkOrderSchedulingPrepContext(wo);
  if (ctx.missingFields.length > 0) return true;
  return getOperationsNeedingStation(wo).length > 0;
}

export const SCHEDULING_DRAG_WORK_ORDER = 'application/x-kuaizhizao-scheduling-work-order';
export const SCHEDULING_DRAG_OPERATION = 'application/x-kuaizhizao-scheduling-operation';

export interface PendingSchedulingOperation {
  operationId: number;
  workOrderId: number;
  operationName: string;
  workOrderCode: string;
  sequence: number;
}

export interface ScheduleWorkOrderDropResult {
  operationDateUpdates: Array<{ operation_id: number; planned_start_date: string; planned_end_date: string }>;
  operationStationUpdates: Array<{ operation_id: number; assigned_station_id: number }>;
  pendingOperations: PendingSchedulingOperation[];
}

const DEFAULT_OP_HOURS = 8;

export function isWorkOrderScheduledOnBoard(wo: WorkOrderForGantt): boolean {
  if (wo.planned_start_date && wo.planned_end_date) return true;
  return (wo.operations ?? []).some(
    (op) => op.id != null && op.planned_start_date && op.planned_end_date
  );
}

/** 已排工序：已指派工位且具备计划起止时间（与甘特工位视图一致） */
export function isOperationScheduledOnBoard(
  op: NonNullable<WorkOrderForGantt['operations']>[number]
): boolean {
  if (op.id == null) return false;
  if (!op.planned_start_date || !op.planned_end_date) return false;
  return op.assigned_station_id != null && Number(op.assigned_station_id) > 0;
}

export function countScheduledOperations(wo: WorkOrderForGantt): number {
  return (wo.operations ?? []).filter(isOperationScheduledOnBoard).length;
}

export function countWorkOrderOperations(wo: WorkOrderForGantt): number {
  return (wo.operations ?? []).filter((op) => op.id != null).length;
}

export function getUnscheduledWorkOrders(workOrders: WorkOrderForGantt[]): WorkOrderForGantt[] {
  return workOrders.filter((wo) => !isWorkOrderScheduledOnBoard(wo));
}

function defaultOpDurationHours(_op: NonNullable<WorkOrderForGantt['operations']>[number]): number {
  return DEFAULT_OP_HOURS;
}

function stationLastEnd(
  stationId: number,
  boardOrders: WorkOrderForGantt[],
  pendingUpdates: Array<{ operation_id: number; planned_start_date: string; planned_end_date: string }>,
  scheduleAnchor?: dayjs.Dayjs
): dayjs.Dayjs {
  let cursor = dayjs().startOf('hour');
  if (scheduleAnchor?.isAfter(cursor)) {
    cursor = scheduleAnchor;
  }
  const pendingEndByOp = new Map(
    pendingUpdates.map((u) => [u.operation_id, dayjs(u.planned_end_date)])
  );

  for (const wo of boardOrders) {
    for (const op of wo.operations ?? []) {
      if (op.id == null || Number(op.assigned_station_id) !== stationId) continue;
      const endFromPending = pendingEndByOp.get(op.id);
      const end = endFromPending ?? (op.planned_end_date ? dayjs(op.planned_end_date) : null);
      if (end && end.isAfter(cursor)) cursor = end;
    }
  }
  for (const u of pendingUpdates) {
    const end = dayjs(u.planned_end_date);
    if (end.isAfter(cursor)) cursor = end;
  }
  return cursor;
}

function resolveWorkOrderScheduleAnchor(wo: WorkOrderForGantt): dayjs.Dayjs | undefined {
  if (!wo.planned_start_date) return undefined;
  const anchor = dayjs(wo.planned_start_date).startOf('hour');
  const now = dayjs().startOf('hour');
  return anchor.isAfter(now) ? anchor : undefined;
}

/** 将排产结果合并进工单（工位 + 工序计划时间），供甘特图即时展示 */
export function mergeScheduledWorkOrderIntoBoard(
  wo: WorkOrderForGantt,
  result: ScheduleWorkOrderDropResult,
  stationNameById?: Map<number, string>
): WorkOrderForGantt {
  const dateByOp = new Map(result.operationDateUpdates.map((item) => [item.operation_id, item]));
  const stationByOp = new Map(
    result.operationStationUpdates.map((item) => [item.operation_id, item.assigned_station_id])
  );
  const operations = (wo.operations ?? []).map((op) => {
    if (op.id == null) return op;
    const datePatch = dateByOp.get(op.id);
    const stationId = stationByOp.get(op.id) ?? op.assigned_station_id;
    return {
      ...op,
      assigned_station_id: stationId ?? op.assigned_station_id,
      assigned_station_name:
        stationId != null && stationId > 0
          ? stationNameById?.get(stationId) ?? op.assigned_station_name
          : op.assigned_station_name,
      planned_start_date: datePatch?.planned_start_date ?? op.planned_start_date,
      planned_end_date: datePatch?.planned_end_date ?? op.planned_end_date,
    };
  });
  return { ...wo, operations };
}

/** 刷新列表后保留刚排产工单的工位/工序时间（避免接口延迟导致甘特条消失） */
export function mergeApiWorkOrderWithScheduled(
  apiWo: WorkOrderForGantt,
  scheduledWo: WorkOrderForGantt
): WorkOrderForGantt {
  const scheduledOpsById = new Map(
    (scheduledWo.operations ?? [])
      .filter((op) => op.id != null)
      .map((op) => [Number(op.id), op])
  );
  const apiOps = apiWo.operations ?? [];
  const baseOps = apiOps.length > 0 ? apiOps : scheduledWo.operations ?? [];
  return {
    ...apiWo,
    planned_start_date: scheduledWo.planned_start_date ?? apiWo.planned_start_date,
    planned_end_date: scheduledWo.planned_end_date ?? apiWo.planned_end_date,
    operations: baseOps.map((op) => {
      if (op.id == null) return op;
      const scheduled = scheduledOpsById.get(op.id);
      if (!scheduled) return op;
      return {
        ...op,
        assigned_station_id: scheduled.assigned_station_id ?? op.assigned_station_id,
        assigned_station_name: scheduled.assigned_station_name ?? op.assigned_station_name,
        planned_start_date: scheduled.planned_start_date ?? op.planned_start_date,
        planned_end_date: scheduled.planned_end_date ?? op.planned_end_date,
      };
    }),
  };
}

export function pickFocusOperationTaskId(wo: WorkOrderForGantt): string | null {
  const op = (wo.operations ?? [])
    .filter((item) => item.id != null && item.assigned_station_id != null && Number(item.assigned_station_id) > 0)
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))[0];
  return op?.id != null ? `op-${op.id}` : null;
}

export function buildScheduleWorkOrderDrop(
  wo: WorkOrderForGantt,
  boardOrders: WorkOrderForGantt[]
): ScheduleWorkOrderDropResult {
  const operationDateUpdates: ScheduleWorkOrderDropResult['operationDateUpdates'] = [];
  const operationStationUpdates: ScheduleWorkOrderDropResult['operationStationUpdates'] = [];
  const pendingOperations: PendingSchedulingOperation[] = [];

  const sortedOps = [...(wo.operations ?? [])]
    .filter((op) => op.id != null)
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

  const scheduleAnchor = resolveWorkOrderScheduleAnchor(wo);

  for (const op of sortedOps) {
    const opId = Number(op.id);
    const stationId =
      op.assigned_station_id != null && Number(op.assigned_station_id) > 0
        ? Number(op.assigned_station_id)
        : null;

    if (stationId == null) {
      pendingOperations.push({
        operationId: opId,
        workOrderId: wo.id,
        operationName: op.operation_name || `工序${op.sequence ?? ''}`,
        workOrderCode: wo.code || String(wo.id),
        sequence: op.sequence ?? 0,
      });
      continue;
    }

    if (op.planned_start_date && op.planned_end_date) {
      operationStationUpdates.push({
        operation_id: opId,
        assigned_station_id: stationId,
      });
      continue;
    }

    const slotStart = stationLastEnd(stationId, boardOrders, operationDateUpdates, scheduleAnchor);
    const hours = defaultOpDurationHours(op);
    const slotEnd = slotStart.add(hours, 'hour');

    operationDateUpdates.push({
      operation_id: opId,
      planned_start_date: slotStart.toISOString(),
      planned_end_date: slotEnd.toISOString(),
    });
    operationStationUpdates.push({
      operation_id: opId,
      assigned_station_id: stationId,
    });
  }

  return { operationDateUpdates, operationStationUpdates, pendingOperations };
}

export function buildAssignPendingOperationToStation(
  pendingOp: PendingSchedulingOperation,
  stationId: number,
  boardOrders: WorkOrderForGantt[],
  existingUpdates: Array<{ operation_id: number; planned_start_date: string; planned_end_date: string }> = []
): {
  operationDateUpdates: Array<{ operation_id: number; planned_start_date: string; planned_end_date: string }>;
  operationStationUpdates: Array<{ operation_id: number; assigned_station_id: number }>;
} {
  const slotStart = stationLastEnd(stationId, boardOrders, existingUpdates);
  const slotEnd = slotStart.add(DEFAULT_OP_HOURS, 'hour');
  return {
    operationDateUpdates: [
      {
        operation_id: pendingOp.operationId,
        planned_start_date: slotStart.toISOString(),
        planned_end_date: slotEnd.toISOString(),
      },
    ],
    operationStationUpdates: [{ operation_id: pendingOp.operationId, assigned_station_id: stationId }],
  };
}

export function parseWorkOrderDragId(dataTransfer: DataTransfer): number | null {
  const raw = dataTransfer.getData(SCHEDULING_DRAG_WORK_ORDER);
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function parseOperationDragId(dataTransfer: DataTransfer): number | null {
  const raw = dataTransfer.getData(SCHEDULING_DRAG_OPERATION);
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}
