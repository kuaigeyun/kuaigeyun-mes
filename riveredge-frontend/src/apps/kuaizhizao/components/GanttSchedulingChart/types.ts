/**
 * 甘特图排产组件类型定义
 */

export interface WorkOrderForGantt {
  id: number;
  code?: string;
  name?: string;
  product_name?: string;
  quantity?: number;
  completed_quantity?: number;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  work_center_name?: string | null;
  workshop_name?: string | null;
  status?: string;
  priority?: string;
}

export interface GanttTask {
  id: number;
  text: string;
  start: Date;
  end: Date;
  duration: number;
  progress: number;
  type: 'task';
  lazy: false;
  work_center_name?: string;
  status?: string;
  priority?: string;
}

export type ViewMode = 'day' | 'week' | 'month';
