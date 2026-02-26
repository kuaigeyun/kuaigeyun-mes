/**
 * 甘特图排产数据转换工具
 */

import type { WorkOrderForGantt, GanttTask } from './types';
import dayjs from 'dayjs';

const DEFAULT_START = 8; // 08:00
const DEFAULT_END = 17; // 17:00

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

  const baseText = [wo.code, wo.product_name].filter(Boolean).join(' - ') || `工单 ${wo.id}`;
  const eq = _aggregateResourceNames(wo, 'assigned_equipment_name');
  const mold = _aggregateResourceNames(wo, 'assigned_mold_name');
  const tool = _aggregateResourceNames(wo, 'assigned_tool_name');
  const resourceParts = [eq && `设备: ${eq}`, mold && `模具: ${mold}`, tool && `工装: ${tool}`].filter(Boolean);
  const subtitle = resourceParts.length > 0 ? resourceParts.join(' | ') : undefined;
  const text = subtitle ? `${baseText}\n${subtitle}` : baseText;

  return {
    id: wo.id,
    text,
    start,
    end,
    duration,
    progress,
    type: 'task',
    lazy: false,
    work_center_name: wo.work_center_name || undefined,
    status: wo.status,
    priority: wo.priority,
    assigned_equipment_name: eq,
    assigned_mold_name: mold,
    assigned_tool_name: tool,
  };
}

/**
 * 工序转换为 Gantt Task（工序级派工）
 */
export function operationToGanttTask(
  op: { id?: number; operation_name?: string; sequence?: number; planned_start_date?: string | null; planned_end_date?: string | null; assigned_equipment_name?: string; assigned_mold_name?: string; assigned_tool_name?: string },
  wo: WorkOrderForGantt
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
  const baseText = `${wo.code || ''} - ${opName}`.trim() || `工序 ${op.id}`;
  const resourceParts = [
    op.assigned_equipment_name && `设备: ${op.assigned_equipment_name}`,
    op.assigned_mold_name && `模具: ${op.assigned_mold_name}`,
    op.assigned_tool_name && `工装: ${op.assigned_tool_name}`,
  ].filter(Boolean) as string[];
  const subtitle = resourceParts.length > 0 ? resourceParts.join(' | ') : undefined;
  const text = subtitle ? `${baseText}\n${subtitle}` : baseText;

  return {
    id: `op-${op.id}`,
    text,
    start,
    end,
    duration,
    progress,
    type: 'task',
    lazy: false,
    work_center_name: wo.work_center_name || undefined,
    status: wo.status,
    priority: wo.priority,
    assigned_equipment_name: op.assigned_equipment_name || undefined,
    assigned_mold_name: op.assigned_mold_name || undefined,
    assigned_tool_name: op.assigned_tool_name || undefined,
    level: 'operation',
    work_order_id: wo.id,
  };
}

/**
 * 工单列表转为 Gantt 任务（支持工单级或工序级）
 */
export function workOrdersToGanttTasks(
  workOrders: WorkOrderForGantt[],
  level: 'work_order' | 'operation' = 'work_order'
): GanttTask[] {
  if (level === 'operation') {
    const tasks: GanttTask[] = [];
    for (const wo of workOrders) {
      const ops = (wo.operations || []).filter((o) => o.id != null);
      if (ops.length > 0) {
        for (const op of ops) {
          tasks.push(operationToGanttTask(op, wo));
        }
      } else {
        tasks.push(workOrderToGanttTask(wo));
      }
    }
    return sortTasksByWorkCenter(tasks);
  }
  return sortTasksByWorkCenter(workOrders.map(workOrderToGanttTask));
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
