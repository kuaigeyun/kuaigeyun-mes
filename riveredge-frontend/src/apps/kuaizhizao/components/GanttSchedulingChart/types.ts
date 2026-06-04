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
  work_center_id?: number | null;
  work_center_name?: string | null;
  readiness_rate?: number | null;
  workshop_name?: string | null;
  status?: string;
  priority?: string;
  scheduling_score?: number | null;
  scheduling_rank_band?: string | null;
  is_frozen?: boolean;
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
    work_center_id?: number | null;
    work_center_name?: string | null;
    planned_start_date?: string | null;
    planned_end_date?: string | null;
    assigned_station_id?: number | null;
    assigned_station_name?: string | null;
    assigned_equipment_id?: number | null;
    assigned_equipment_name?: string | null;
    assigned_mold_name?: string | null;
    assigned_tool_name?: string | null;
  }>;
}

/** 任务层级：工单级 | 工位资源 | 设备资源 | 工序平铺 */
export type GanttTaskLevel = 'work_order' | 'station' | 'equipment' | 'operation';

/** 甘特图工位资源行（来自主数据工位） */
export interface WorkstationResource {
  id: number;
  name: string;
  code?: string;
}

export type GanttTaskType = 'task' | 'summary';

export interface GanttTask {
  /** 工单 number；工序 op-{id}；工位资源 st-{id} */
  id: number | string;
  text: string;
  start: Date;
  end: Date;
  duration: number;
  progress: number;
  type: GanttTaskType;
  lazy: false;
  /** 工位 summary 为 0；工序父级为 st-{stationId} */
  parent?: number | string;
  /** summary 行默认展开 */
  open?: boolean;
  /** 无计划时间的占位资源行（甘特库） */
  unscheduled?: boolean;
  work_center_name?: string;
  assigned_station_name?: string;
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
  /** 任务条颜色（库支持时生效） */
  color?: string;
  /** 任务条文本色（库支持时生效） */
  textColor?: string;
  /** 甘特库样式类（库支持时生效） */
  css?: string;
  /** 兼容部分库字段命名 */
  class?: string;
  /** 标签主行（产品名等） */
  gantt_primary_label?: string;
  /** 标签副行（工单号） */
  gantt_work_order_code?: string;
  /** 工位视图：左侧网格展示的工位名称（工序条合并到工位行时使用） */
  gantt_station_label?: string;
  /** 工位行右侧数字角标：已排工序数 */
  gantt_station_badge_count?: number;
  /** 工位角标配色 */
  gantt_station_badge_tone?: 'idle' | 'busy' | 'conflict';
  /** 工位主数据 ID（工位合并行） */
  assigned_station_id?: number;
  /** 同工位多工序合并为单行时的分段条 */
  segments?: GanttTaskSegment[];
}

/** 工位合并行内单道工序分段 */
export interface GanttTaskSegment {
  start: Date;
  end: Date;
  duration?: number;
  text?: string;
  gantt_primary_label?: string;
  gantt_work_order_code?: string;
  operation_id?: number;
  work_order_id?: number;
  css?: string;
  class?: string;
  color?: string;
  textColor?: string;
}

export type ViewMode = 'day' | 'week' | 'month';
