/**
 * 同工单工序间的甘特依赖连线（库内贝塞尔曲线渲染，类型 e2s：前序结束 → 后序开始）
 */

import type { WorkOrderForGantt } from './types';
import type { GanttTask } from './types';

export type GanttProcessLink = {
  id: string;
  source: string;
  target: string;
  type: 'e2s';
};

export function operationTaskId(operationId: number): string {
  return `op-${operationId}`;
}

export function isOperationTaskId(id: number | string): boolean {
  return /^op-\d+$/i.test(String(id));
}

/** 按工艺序号排序的工序甘特 id */
export function getWorkOrderOperationTaskIds(
  workOrderId: number,
  workOrders: WorkOrderForGantt[]
): string[] {
  const wo = workOrders.find((w) => w.id === workOrderId);
  if (!wo) return [];
  return (wo.operations || [])
    .filter((o) => o.id != null)
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    .map((o) => operationTaskId(Number(o.id)));
}

/** 同工单内相邻工序的工序流线 */
export function buildWorkOrderOperationLinks(
  workOrderId: number,
  workOrders: WorkOrderForGantt[]
): GanttProcessLink[] {
  const ids = getWorkOrderOperationTaskIds(workOrderId, workOrders);
  const links: GanttProcessLink[] = [];
  for (let i = 0; i < ids.length - 1; i++) {
    links.push({
      id: `wo-${workOrderId}-flow-${i}`,
      source: ids[i],
      target: ids[i + 1],
      type: 'e2s',
    });
  }
  return links;
}

export function resolveWorkOrderIdFromTask(
  taskId: number | string,
  tasks: GanttTask[],
  workOrders: WorkOrderForGantt[]
): number | null {
  const task = tasks.find((t) => String(t.id) === String(taskId));
  if (task?.work_order_id != null) return task.work_order_id;

  const text = String(taskId);
  const m = text.match(/^op-(\d+)$/i);
  if (!m) return null;
  const opId = Number(m[1]);
  for (const t of tasks) {
    const seg = t.segments?.find((s) => s.operation_id === opId);
    if (seg?.work_order_id != null) return seg.work_order_id;
  }
  for (const wo of workOrders) {
    if ((wo.operations || []).some((o) => o.id === opId)) return wo.id;
  }
  return null;
}

/** 工位分段行内工序 id → 工位行 task id（st-*） */
export function resolveStationRowIdForOperation(
  operationId: number,
  tasks: GanttTask[]
): string | null {
  for (const t of tasks) {
    if (!t.segments?.some((s) => s.operation_id === operationId)) continue;
    return String(t.id);
  }
  return null;
}
