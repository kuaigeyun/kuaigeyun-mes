/**
 * RiverGantt：自建、可控的甘特图引擎类型定义。
 *
 * 数据形状与既有 GanttSchedulingChart 的 GanttTask 对齐，便于零成本接入：
 * - 顶层任务：id/start/end/type/parent/segments[] 等
 * - 同一行分段：segments[]（每段独立 start/end，可独立拖拽/拉伸/改派）
 */

import type { ReactNode } from 'react';

export type RiverScaleUnit = 'year' | 'month' | 'week' | 'day' | 'hour';

export interface RiverGanttScale {
  unit: RiverScaleUnit;
  step: number;
  format: string | ((date: Date, next?: Date) => string);
  css?: (date: Date) => string;
}

export interface RiverGanttSegment {
  start: Date;
  end: Date;
  duration?: number;
  text?: string;
  operation_id?: number;
  work_order_id?: number;
  css?: string;
  class?: string;
  color?: string;
  textColor?: string;
  gantt_primary_label?: string;
  gantt_work_order_code?: string;
}

export interface RiverGanttTask {
  /** 工单 number；工序 op-{id}；工位资源 st-{id}；设备资源 eq-{id} */
  id: number | string;
  text?: string;
  start: Date;
  end: Date;
  duration?: number;
  progress?: number;
  type?: 'task' | 'summary' | string;
  parent?: number | string;
  open?: boolean;
  /** 无计划时间的占位资源行（不渲染时间条） */
  unscheduled?: boolean;
  css?: string;
  class?: string;
  color?: string;
  textColor?: string;
  /** 同一行多段（splitTasks 模式渲染） */
  segments?: RiverGanttSegment[];
  /** 标签主行（产品名/工序名等，供默认标签渲染） */
  gantt_primary_label?: string;
  /** 标签副行（工单号等） */
  gantt_work_order_code?: string;
}

export interface RiverGanttColumnHeader {
  text?: string;
  css?: string;
}

export interface RiverGanttColumn {
  id: string;
  header?: string | RiverGanttColumnHeader;
  width?: number;
  align?: 'left' | 'center' | 'right';
  cell?: (props: { row: RiverGanttTask }) => ReactNode;
}

export type RiverLinkType = 'e2s' | 's2s' | 'e2e' | 's2e';

export interface RiverGanttLink {
  id: number | string;
  source: number | string;
  target: number | string;
  type: RiverLinkType;
}

export interface RiverUpdateTaskEvent {
  id: number | string;
  segmentIndex?: number;
  inProgress?: boolean;
  task: { start?: Date; end?: Date; duration?: number };
}

export interface RiverSelectTaskEvent {
  id: number | string;
  segmentIndex?: number;
  toggle?: boolean;
}

export interface RiverMoveTaskEvent {
  id: number | string;
  target?: number | string;
  mode: string;
  inProgress?: boolean;
}

export interface RiverGanttState {
  start: Date;
  end: Date;
  cellWidth: number;
  /** 像素/毫秒（由 cellWidth 与最小刻度单位推导） */
  pxPerMs: number;
  /** 最小刻度单位的标称毫秒数 */
  unitMs: number;
  scrollLeft: number;
  scrollTop: number;
}

export interface RiverGanttApi {
  getTask: (id: number | string) => RiverGanttTask | undefined;
  getState: () => RiverGanttState;
  selectTask: (params: { id: number | string; show?: boolean }) => void;
  scrollChart: (params: { left?: number; top?: number }) => void;
  /** 兼容既有调用风格：exec('select-task'|'scroll-chart', params) */
  exec: (action: string, params?: unknown) => Promise<unknown>;
  /** 目前仅支持 'move-task' */
  on: (event: string, cb: (ev: RiverMoveTaskEvent) => void) => void;
}

export type RiverTaskTemplate = (props: { data: RiverGanttTask }) => ReactNode;
