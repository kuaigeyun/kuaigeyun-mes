/**
 * 工位资源型甘特：每个工位一行，同工位多道工序在同一行按时间轴分段展示（可分别拖拽）。
 */


import dayjs from 'dayjs';

import type { WorkOrderForGantt, GanttTask, WorkstationResource } from './types';

import { operationToGanttTask, sortWorkOrdersForGantt } from './utils';



const DEFAULT_START_HOUR = 8;

const DEFAULT_END_HOUR = 17;

export const UNASSIGNED_STATION_ID = 0;

export const UNASSIGNED_STATION_LABEL = '未分配工位';



export function stationResourceId(stationId: number): string {

  return stationId === UNASSIGNED_STATION_ID ? 'st-0' : `st-${stationId}`;

}



export function isStationResourceTaskId(id: number | string): boolean {

  return String(id).startsWith('st-');

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



/** 同一工位上时间重叠的工序（资源已无法再并行排入） */

export function findOverlappingTaskIds(childTasks: GanttTask[]): Set<string> {

  const conflictIds = new Set<string>();

  for (let i = 0; i < childTasks.length; i++) {

    for (let j = i + 1; j < childTasks.length; j++) {

      const a = childTasks[i];

      const b = childTasks[j];

      if (a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime()) {

        conflictIds.add(String(a.id));

        conflictIds.add(String(b.id));

      }

    }

  }

  return conflictIds;

}



function buildEmptyStationResourceRow(
  stationId: number,
  name: string,
  code: string | undefined
): GanttTask {
  const { start, end } = defaultDayRange();
  const codePrefix = code ? `${code} ` : '';
  const label = `${codePrefix}${name}`.trim();
  return {
    id: stationResourceId(stationId),
    type: 'task',
    parent: 0,
    text: label,
    gantt_primary_label: label,
    gantt_work_order_code: '空闲',
    gantt_station_badge_count: 0,
    gantt_station_badge_tone: 'idle',
    start,
    end,
    duration: durationDays(start, end),
    progress: 0,
    lazy: false,
    unscheduled: true,
    assigned_station_name: name,
    assigned_station_id: stationId,
    css: 'gantt-station-resource gantt-station-idle',
    class: 'gantt-station-resource gantt-station-idle',
  };
}

function parseOperationIdFromTaskId(id: number | string): number | null {
  const m = String(id).match(/^op-(\d+)$/i);
  if (!m) return null;
  const opId = Number(m[1]);
  return Number.isInteger(opId) && opId > 0 ? opId : null;
}

/** 同工位多工序：单行 + 时间轴分段（splitTasks） */
function buildStationMergedTask(
  stationId: number,
  name: string,
  code: string | undefined,
  childTasks: GanttTask[],
  conflictCount: number
): GanttTask {
  const { start, end } = rangeFromTasks(childTasks);
  const duration = durationDays(start, end);
  const codePrefix = code ? `${code} ` : '';
  const label = `${codePrefix}${name}`.trim();
  const tone = conflictCount > 0 ? 'conflict' : 'busy';

  return {
    id: stationResourceId(stationId),
    type: 'task',
    parent: 0,
    text: label,
    gantt_primary_label: label,
    gantt_station_label: label,
    gantt_station_badge_count: childTasks.length,
    gantt_station_badge_tone: tone,
    start,
    end,
    duration,
    progress: 0,
    lazy: false,
    assigned_station_id: stationId,
    assigned_station_name: name,
    segments: childTasks.map((t) => {
      const operationId = parseOperationIdFromTaskId(t.id);
      return {
        start: t.start,
        end: t.end,
        duration: t.duration,
        text: [t.gantt_primary_label, t.gantt_work_order_code].filter(Boolean).join('\n'),
        gantt_primary_label: t.gantt_primary_label,
        gantt_work_order_code: t.gantt_work_order_code,
        operation_id: operationId ?? undefined,
        work_order_id: t.work_order_id,
        css: t.css,
        class: t.class,
        color: t.color,
        textColor: t.textColor,
      };
    }),
    css: ['gantt-station-merged', conflictCount > 0 ? 'gantt-station-overloaded' : '']
      .filter(Boolean)
      .join(' '),
    class: ['gantt-station-merged', conflictCount > 0 ? 'gantt-station-overloaded' : '']
      .filter(Boolean)
      .join(' '),
  };
}



/**
 * 工位资源甘特任务：每个工位一行；无工序为空闲行，有工序为单行多段（splitTasks）。
 */

export function workOrdersToStationResourceGanttTasks(

  workOrders: WorkOrderForGantt[] | null | undefined,

  stations: WorkstationResource[] | null | undefined

): GanttTask[] {

  const safeWorkOrders = workOrders ?? [];

  const safeStations = stations ?? [];

  const stationMeta = new Map<number, WorkstationResource>();

  for (const s of safeStations) {

    if (s.id > 0) stationMeta.set(s.id, s);

  }



  const opsByStation = new Map<number, Array<{ op: NonNullable<WorkOrderForGantt['operations']>[number]; wo: WorkOrderForGantt }>>();



  for (const wo of sortWorkOrdersForGantt(safeWorkOrders)) {

    const ops = (wo.operations || []).filter((o) => o.id != null);

    for (const op of ops) {
      const sid =
        op.assigned_station_id != null && Number(op.assigned_station_id) > 0
          ? Number(op.assigned_station_id)
          : null;
      if (sid == null) continue;

      if (!stationMeta.has(sid)) {

        stationMeta.set(sid, {

          id: sid,

          name: (op.assigned_station_name || '').trim() || `工位${sid}`,

          code: String(sid),

        });

      }

      if (!opsByStation.has(sid)) opsByStation.set(sid, []);

      opsByStation.get(sid)!.push({ op, wo });

    }

  }



  const orderedIds: number[] = [];

  const sortedMaster = [...safeStations]

    .filter((s) => s.id > 0)

    .sort((a, b) => String(a.code || a.name).localeCompare(String(b.code || b.name), 'zh-CN'));

  for (const s of sortedMaster) {

    if (!orderedIds.includes(s.id)) orderedIds.push(s.id);

  }

  for (const sid of opsByStation.keys()) {
    if (sid > 0 && !orderedIds.includes(sid)) orderedIds.push(sid);
  }

  const tasks: GanttTask[] = [];

  for (const sid of orderedIds) {
    if (sid === UNASSIGNED_STATION_ID) continue;

    const meta = stationMeta.get(sid) ?? { id: sid, name: `工位${sid}`, code: String(sid) };



    const childrenInput = opsByStation.get(sid) ?? [];

    let childTasks = childrenInput.map(({ op, wo }) => {

      const task = operationToGanttTask(op, wo, 'station_child');

      return {

        ...task,

        type: 'task' as const,

        parent: stationResourceId(sid),

        assigned_station_name: meta.name,

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
      tasks.push(buildEmptyStationResourceRow(sid, meta.name, meta.code));
      continue;
    }

    tasks.push(buildStationMergedTask(sid, meta.name, meta.code, childTasks, overlapIds.size));

  }



  return tasks;

}



export function collectStationResourceRowIds(tasks: GanttTask[]): string[] {
  return tasks
    .filter((t) => isStationResourceTaskId(t.id) && Boolean(t.unscheduled))
    .map((t) => String(t.id));
}


