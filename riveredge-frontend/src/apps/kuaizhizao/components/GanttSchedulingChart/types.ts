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
  /** 设备名称（取自首工序或聚合） */
  assigned_equipment_name?: string | null;
  /** 模具名称（取自首工序或聚合） */
  assigned_mold_name?: string | null;
  /** 工装名称（取自首工序或聚合） */
  assigned_tool_name?: string | null;
  /** 工序列表（用于聚合设备/模具/工装，支持工序级派工） */
  operations?: Array<{
    id?: number;
    operation_name?: string | null;
    sequence?: number;
    planned_start_date?: string | null;
    planned_end_date?: string | null;
    assigned_equipment_name?: string | null;
    assigned_mold_name?: string | null;
    assigned_tool_name?: string | null;
  }>;
}

/** 任务层级：工单级 | 工序级 */
export type GanttTaskLevel = 'work_order' | 'operation';

export interface GanttTask {
  /** 工单任务为 number，工序任务为 string "op-{id}" */
  id: number | string;
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
  /** 设备/模具/工装（用于 tooltip 或副标题） */
  assigned_equipment_name?: string;
  assigned_mold_name?: string;
  assigned_tool_name?: string;
  /** 任务层级（工单级/工序级） */
  level?: GanttTaskLevel;
  /** 工序所属工单 ID（工序级时有值） */
  work_order_id?: number;
}

export type ViewMode = 'day' | 'week' | 'month';
