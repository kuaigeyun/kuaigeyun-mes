/**
 * 甘特图排产数据转换工具
 */

import type { WorkOrderForGantt, GanttTask, GanttTaskLevel, WorkstationResource } from './types';
import { workOrdersToEquipmentResourceGanttTasks } from './equipmentResourceUtils';
import { workOrdersToStationResourceGanttTasks } from './stationResourceUtils';
import dayjs from 'dayjs';

const DEFAULT_START = 8; // 08:00
const DEFAULT_END = 17; // 17:00

function buildGanttLabel(wo: WorkOrderForGantt, fallbackName?: string) {
  const productName = (wo.product_name || wo.name || fallbackName || `工单 ${wo.id}`).trim();
  const workOrderCode = (wo.code || String(wo.id)).trim();
  const frozenPrefix = wo.is_frozen ? '🔒 ' : '';
  return {
    gantt_primary_label: `${frozenPrefix}${productName}`,
    gantt_work_order_code: workOrderCode,
    text: `${frozenPrefix}${productName}\n${workOrderCode}`,
  };
}

function resolveTaskVisual(wo: WorkOrderForGantt, end: Date): { css: string; color: string; textColor: string } {
  if (wo.is_frozen) {
    return { css: 'gantt-task-gray', color: '#bfbfbf', textColor: '#1f1f1f' };
  }
  const isOverdue = end.getTime() < Date.now() && wo.status !== 'completed';
  if (isOverdue || wo.priority === 'urgent') {
    return { css: 'gantt-task-red', color: '#ff4d4f', textColor: '#ffffff' };
  }
  if (wo.status === 'in_progress') {
    return { css: 'gantt-task-blue', color: '#1677ff', textColor: '#ffffff' };
  }
  return { css: 'gantt-task-yellow', color: '#fadb14', textColor: '#1f1f1f' };
}

/**
 * 工单转换为 Gantt Task
 */
function _aggregateResourceNames(wo: WorkOrderForGantt, key: 'assigned_equipment_name' | 'assigned_mold_name' | 'assigned_tool_name'): string | undefined {
  if (wo[key]) return wo[key] || undefined;
  const ops = wo.operations || [];
  const names = ops.map((op) => op[key]).filter(Boolean) as string[];
  if (names.length === 0) return undefined;
  return [...new Set(names)].join(', ');
}

export function workOrderToGanttTask(wo: WorkOrderForGantt): GanttTask {
  const qty = Number(wo.quantity) || 1;
  const completed = Number(wo.completed_quantity) || 0;
  const progress = qty > 0 ? Math.min(100, Math.round((completed / qty) * 100)) : 0;

  let start: Date;
  let end: Date;

  if (wo.planned_start_date && wo.planned_end_date) {
    start = dayjs(wo.planned_start_date).toDate();
    end = dayjs(wo.planned_end_date).toDate();
  } else {
    const today = dayjs().startOf('day');
    start = today.hour(DEFAULT_START).minute(0).toDate();
    end = today.hour(DEFAULT_END).minute(0).toDate();
  }

  const durationMs = end.getTime() - start.getTime();
  const durationDays = durationMs / (24 * 60 * 60 * 1000);
  const duration = Math.max(1, Math.ceil(durationDays));

  const label = buildGanttLabel(wo);
  const eq = _aggregateResourceNames(wo, 'assigned_equipment_name');
  const mold = _aggregateResourceNames(wo, 'assigned_mold_name');
  const tool = _aggregateResourceNames(wo, 'assigned_tool_name');
  const visual = resolveTaskVisual(wo, end);

  return {
    id: wo.id,
    text: label.text,
    gantt_primary_label: label.gantt_primary_label,
    gantt_work_order_code: label.gantt_work_order_code,
    start,
    end,
    duration,
    progress,
    type: 'task',
    lazy: false,
    parent: 0,
    work_center_name: wo.work_center_name || undefined,
    status: wo.status,
    priority: wo.priority,
    assigned_equipment_name: eq,
    assigned_mold_name: mold,
    assigned_tool_name: tool,
    css: visual.css,
    class: visual.css,
    color: visual.color,
    textColor: visual.textColor,
  };
}

/**
 * 工序转换为 Gantt Task（工序级派工）
 */
const UNASSIGNED_STATION_LABEL = '未分配工位';

export function operationToGanttTask(
  op: {
    id?: number;
    operation_name?: string | null;
    sequence?: number;
    planned_start_date?: string | null;
    planned_end_date?: string | null;
    assigned_station_id?: number | null;
    assigned_station_name?: string | null;
    assigned_equipment_name?: string | null;
    assigned_mold_name?: string | null;
    assigned_tool_name?: string | null;
  },
  wo: WorkOrderForGantt,
  viewLevel: 'station_child' | 'legacy' = 'legacy'
): GanttTask {
  const DEFAULT_START = 8;
  const DEFAULT_END = 17;
  let start: Date;
  let end: Date;

  if (op.planned_start_date && op.planned_end_date) {
    start = dayjs(op.planned_start_date).toDate();
    end = dayjs(op.planned_end_date).toDate();
  } else if (wo.planned_start_date && wo.planned_end_date) {
    start = dayjs(wo.planned_start_date).toDate();
    end = dayjs(wo.planned_end_date).toDate();
  } else {
    const today = dayjs().startOf('day');
    start = today.hour(DEFAULT_START).minute(0).toDate();
    end = today.hour(DEFAULT_END).minute(0).toDate();
  }

  const durationMs = end.getTime() - start.getTime();
  const durationDays = durationMs / (24 * 60 * 60 * 1000);
  const duration = Math.max(1, Math.ceil(durationDays));

  const qty = Number(wo.quantity) || 1;
  const completed = Number(wo.completed_quantity) || 0;
  const progress = qty > 0 ? Math.min(100, Math.round((completed / qty) * 100)) : 0;

  const opName = op.operation_name || `工序${op.sequence ?? ''}`;
  const stationName = (op.assigned_station_name || '').trim() || UNASSIGNED_STATION_LABEL;
  const productName = (wo.product_name || wo.name || `工单 ${wo.id}`).trim();
  const workOrderCode = (wo.code || String(wo.id)).trim();
  const frozenPrefix = wo.is_frozen ? '🔒 ' : '';
  const label =
    viewLevel === 'station_child'
      ? {
          gantt_primary_label: `${frozenPrefix}${opName}`,
          gantt_work_order_code: `${workOrderCode} · ${productName}`,
          text: `${frozenPrefix}${opName}\n${workOrderCode} · ${productName}`,
        }
      : buildGanttLabel(wo, opName);
  const visual = resolveTaskVisual(wo, end);

  return {
    id: `op-${op.id}`,
    text: label.text,
    gantt_primary_label: label.gantt_primary_label,
    gantt_work_order_code: label.gantt_work_order_code,
    start,
    end,
    duration,
    progress,
    type: 'task',
    lazy: false,
    parent: 0,
    work_center_name: wo.work_center_name || undefined,
    assigned_station_name: stationName,
    assigned_station_id:
      op.assigned_station_id != null && Number(op.assigned_station_id) > 0
        ? Number(op.assigned_station_id)
        : undefined,
    status: wo.status,
    priority: wo.priority,
    assigned_equipment_name: op.assigned_equipment_name || undefined,
    assigned_mold_name: op.assigned_mold_name || undefined,
    assigned_tool_name: op.assigned_tool_name || undefined,
    work_order_id: wo.id,
    css: visual.css,
    class: visual.css,
    color: visual.color,
    textColor: visual.textColor,
  };
}

/**
 * 按 APS-Lite 综合分排序（同分按工单编码）
 */
export function sortWorkOrdersForGantt(workOrders: WorkOrderForGantt[] | null | undefined): WorkOrderForGantt[] {
  return [...(workOrders ?? [])].sort((a, b) => {
    const sa = Number(a.scheduling_score ?? -1);
    const sb = Number(b.scheduling_score ?? -1);
    if (sb !== sa) return sb - sa;
    return String(a.code || a.id).localeCompare(String(b.code || b.id));
  });
}

/**
 * 工序平铺甘特：每道工序一行，左侧显示工序名与所属工单。
 */
export function workOrdersToOperationGanttTasks(workOrders: WorkOrderForGantt[] | null | undefined): GanttTask[] {
  const items: Array<{ task: GanttTask; score: number; sequence: number }> = [];
  for (const wo of sortWorkOrdersForGantt(workOrders)) {
    const score = Number(wo.scheduling_score ?? -1);
    for (const op of (wo.operations || []).filter((o) => o.id != null)) {
      items.push({
        task: { ...operationToGanttTask(op, wo, 'station_child'), level: 'operation' },
        score,
        sequence: op.sequence ?? 0,
      });
    }
  }
  items.sort(
    (a, b) =>
      a.task.start.getTime() - b.task.start.getTime() ||
      b.score - a.score ||
      a.sequence - b.sequence ||
      String(a.task.id).localeCompare(String(b.task.id))
  );
  return items.map((item) => item.task);
}

/**
 * 工单列表转为 Gantt 任务（支持工单级或工序级）
 */
export function workOrdersToGanttTasks(
  workOrders: WorkOrderForGantt[] | null | undefined,
  level: GanttTaskLevel = 'work_order',
  stations: WorkstationResource[] | null | undefined = []
): GanttTask[] {
  const sorted = sortWorkOrdersForGantt(workOrders);
  const safeStations = stations ?? [];
  if (level === 'operation') {
    return workOrdersToOperationGanttTasks(sorted);
  }
  if (level === 'station') {
    return workOrdersToStationResourceGanttTasks(sorted, safeStations);
  }
  if (level === 'equipment') {
    return workOrdersToEquipmentResourceGanttTasks(sorted);
  }
  return sortTasksByWorkCenter(sorted.map(workOrderToGanttTask));
}

/**
 * 按工作中心分组排序
 */
export function sortTasksByWorkCenter(tasks: GanttTask[]): GanttTask[] {
  return [...tasks].sort((a, b) => {
    const wa = a.work_center_name || '';
    const wb = b.work_center_name || '';
    const idA = typeof a.id === 'string' ? a.id : String(a.id);
    const idB = typeof b.id === 'string' ? b.id : String(b.id);
    return wa.localeCompare(wb) || idA.localeCompare(idB);
  });
}
