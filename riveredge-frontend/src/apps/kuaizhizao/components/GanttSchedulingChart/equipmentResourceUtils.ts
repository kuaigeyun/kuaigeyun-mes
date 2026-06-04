/**
 * 设备资源型甘特：设备为资源行，工序为子任务。
 */

import dayjs from 'dayjs';
import type { WorkOrderForGantt, GanttTask } from './types';
import { operationToGanttTask, sortWorkOrdersForGantt } from './utils';
import { findOverlappingTaskIds } from './stationResourceUtils';

const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 17;

export interface EquipmentResource {
  id: number;
  name: string;
}

export const UNASSIGNED_EQUIPMENT_ID = 0;
export const UNASSIGNED_EQUIPMENT_LABEL = '未分配设备';

export function equipmentResourceId(equipmentId: number): string {
  return equipmentId === UNASSIGNED_EQUIPMENT_ID ? 'eq-0' : `eq-${equipmentId}`;
}

export function isEquipmentResourceTaskId(id: number | string): boolean {
  return String(id).startsWith('eq-');
}

function defaultDayRange(): { start: Date; end: Date } {
  const today = dayjs().startOf('day');
  return {
    start: today.hour(DEFAULT_START_HOUR).minute(0).toDate(),
    end: today.hour(DEFAULT_END_HOUR).minute(0).toDate(),
  };
}

function rangeFromTasks(childTasks: GanttTask[]): { start: Date; end: Date } {
  if (childTasks.length === 0) return defaultDayRange();
  const starts = childTasks.map((t) => t.start.getTime());
  const ends = childTasks.map((t) => t.end.getTime());
  return {
    start: new Date(Math.min(...starts)),
    end: new Date(Math.max(...ends)),
  };
}

function durationDays(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function buildEmptyEquipmentRow(equipmentId: number, name: string): GanttTask {
  const { start, end } = defaultDayRange();
  const label = name.trim();
  return {
    id: equipmentResourceId(equipmentId),
    type: 'task',
    parent: 0,
    text: label,
    gantt_primary_label: label,
    gantt_work_order_code: '空闲',
    start,
    end,
    duration: durationDays(start, end),
    progress: 0,
    lazy: false,
    unscheduled: true,
    css: 'gantt-equipment-resource gantt-equipment-idle',
    class: 'gantt-equipment-resource gantt-equipment-idle',
  };
}

function buildSummaryTask(
  equipmentId: number,
  name: string,
  childTasks: GanttTask[],
  conflictCount: number
): GanttTask {
  const { start, end } = rangeFromTasks(childTasks);
  const loadHint =
    childTasks.length === 0
      ? '空闲'
      : conflictCount > 0
        ? `${childTasks.length} 道工序 · 冲突 ${conflictCount}`
        : `${childTasks.length} 道工序`;
  const label = name.trim();
  return {
    id: equipmentResourceId(equipmentId),
    type: 'summary',
    parent: 0,
    open: true,
    text: label,
    gantt_primary_label: label,
    gantt_work_order_code: loadHint,
    start,
    end,
    duration: durationDays(start, end),
    progress: 0,
    lazy: false,
    css: conflictCount > 0 ? 'gantt-equipment-resource gantt-equipment-overloaded' : 'gantt-equipment-resource',
    class: conflictCount > 0 ? 'gantt-equipment-resource gantt-equipment-overloaded' : 'gantt-equipment-resource',
  };
}

export function workOrdersToEquipmentResourceGanttTasks(
  workOrders: WorkOrderForGantt[] | null | undefined
): GanttTask[] {
  const safeWorkOrders = workOrders ?? [];
  const equipmentMeta = new Map<number, EquipmentResource>();
  const opsByEquipment = new Map<
    number,
    Array<{ op: NonNullable<WorkOrderForGantt['operations']>[number]; wo: WorkOrderForGantt }>
  >();

  for (const wo of sortWorkOrdersForGantt(safeWorkOrders)) {
    for (const op of (wo.operations || []).filter((o) => o.id != null)) {
      const rawName = (op.assigned_equipment_name || '').trim();
      const eid =
        op.assigned_equipment_id != null && Number(op.assigned_equipment_id) > 0
          ? Number(op.assigned_equipment_id)
          : rawName
            ? -Math.abs(rawName.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0))
            : UNASSIGNED_EQUIPMENT_ID;
      const ename = rawName || (eid > 0 ? `设备${eid}` : UNASSIGNED_EQUIPMENT_LABEL);
      if (!equipmentMeta.has(eid) && eid > 0) {
        equipmentMeta.set(eid, { id: eid, name: ename });
      }
      if (!opsByEquipment.has(eid)) opsByEquipment.set(eid, []);
      opsByEquipment.get(eid)!.push({ op, wo });
    }
  }

  const orderedIds: number[] = [];
  const sortedIds = [...equipmentMeta.keys()].sort((a, b) =>
    String(equipmentMeta.get(a)?.name).localeCompare(String(equipmentMeta.get(b)?.name), 'zh-CN')
  );
  for (const id of sortedIds) orderedIds.push(id);
  for (const eid of opsByEquipment.keys()) {
    if (eid > 0 && !orderedIds.includes(eid)) orderedIds.push(eid);
  }
  if (opsByEquipment.has(UNASSIGNED_EQUIPMENT_ID) && !orderedIds.includes(UNASSIGNED_EQUIPMENT_ID)) {
    orderedIds.push(UNASSIGNED_EQUIPMENT_ID);
  }

  const tasks: GanttTask[] = [];
  for (const eid of orderedIds) {
    const meta =
      eid === UNASSIGNED_EQUIPMENT_ID
        ? { id: UNASSIGNED_EQUIPMENT_ID, name: UNASSIGNED_EQUIPMENT_LABEL }
        : equipmentMeta.get(eid) ?? { id: eid, name: `设备${eid}` };

    let childTasks = (opsByEquipment.get(eid) ?? []).map(({ op, wo }) => {
      const task = operationToGanttTask(op, wo, 'station_child');
      return {
        ...task,
        type: 'task' as const,
        parent: equipmentResourceId(eid),
      };
    });
    childTasks.sort((a, b) => a.start.getTime() - b.start.getTime() || String(a.id).localeCompare(String(b.id)));
    const overlapIds = findOverlappingTaskIds(childTasks);
    if (overlapIds.size > 0) {
      childTasks = childTasks.map((t) => {
        if (!overlapIds.has(String(t.id))) return t;
        return {
          ...t,
          css: 'gantt-task-red gantt-station-conflict',
          class: 'gantt-task-red gantt-station-conflict',
          color: '#ff4d4f',
          textColor: '#ffffff',
        };
      });
    }
    if (childTasks.length === 0) {
      tasks.push(buildEmptyEquipmentRow(eid, meta.name));
      continue;
    }
    tasks.push(buildSummaryTask(eid, meta.name, childTasks, overlapIds.size));
    tasks.push(...childTasks);
  }
  return tasks;
}
