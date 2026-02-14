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

  const text = [wo.code, wo.product_name].filter(Boolean).join(' - ') || `工单 ${wo.id}`;

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
  };
}

/**
 * 按工作中心分组排序
 */
export function sortTasksByWorkCenter(tasks: GanttTask[]): GanttTask[] {
  return [...tasks].sort((a, b) => {
    const wa = a.work_center_name || '';
    const wb = b.work_center_name || '';
    return wa.localeCompare(wb) || a.id - b.id;
  });
}

/**
 * 根据状态获取任务条颜色
 */
export function getTaskColorByStatus(status?: string): string {
  const map: Record<string, string> = {
    draft: '#8c8c8c',
    released: '#1677ff',
    in_progress: '#fa8c16',
    completed: '#52c41a',
    cancelled: '#ff4d4f',
  };
  return map[status || ''] || '#1677ff';
}

/**
 * 根据优先级获取任务条颜色（当无状态时备用）
 */
export function getTaskColorByPriority(priority?: string): string {
  const map: Record<string, string> = {
    urgent: '#ff4d4f',
    high: '#fa8c16',
    normal: '#1677ff',
    low: '#8c8c8c',
  };
  return map[priority || ''] || '#1677ff';
}
