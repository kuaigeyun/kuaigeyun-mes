/**
 * 甘特图排产组件
 *
 * 基于自建、可控的 RiverGantt 引擎。
 * 工位视图：splitTasks + segments[]，由 RiverGantt 原生渲染同一行分段（可按段拖拽/拉伸/改派）。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Empty, Spin, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { RiverGantt } from '../../../../components/river-gantt';
import type {
  RiverGanttApi,
  RiverGanttColumn,
  RiverGanttScale,
  RiverGanttTask,
} from '../../../../components/river-gantt';
import '../gantt-scrollbar.less';
import type { WorkOrderForGantt, WorkstationResource } from './types';
import { workOrdersToGanttTasks } from './utils';
import type { ViewMode, GanttTaskLevel, GanttTask } from './types';
import { isStationResourceTaskId, stationResourceId, findOverlappingTaskIds } from './stationResourceUtils';
import { isEquipmentResourceTaskId } from './equipmentResourceUtils';
import {
  buildWorkOrderOperationLinks,
  getWorkOrderOperationTaskIds,
  isOperationTaskId,
  resolveWorkOrderIdFromTask,
  resolveStationRowIdForOperation,
} from './workOrderOperationLinks';
import dayjs from 'dayjs';
import { ensureGanttIconsCssLoaded } from '../../../../utils/loadGanttIconsCss';
import { GanttTaskLabel } from './GanttTaskLabel';
import { scrollGanttToToday } from './scrollGanttToToday';

const GANTT_ROW_HEIGHT = 36;
const RESOURCE_LEVELS: GanttTaskLevel[] = ['station', 'equipment', 'operation'];

function isResourceRowTaskId(id: number | string): boolean {
  return isStationResourceTaskId(id) || isEquipmentResourceTaskId(id);
}

function parseStationIdFromResourceRow(id: number | string): number | null {
  const text = String(id);
  const m = text.match(/^st-(\d+)$/i);
  if (!m) return null;
  return Number(m[1]);
}

function isStationMergedTask(row: Pick<GanttTask, 'id' | 'segments'>): boolean {
  return isStationResourceTaskId(row.id) && Array.isArray(row.segments) && row.segments.length > 0;
}

function operationTaskIdFromSegment(segment: { operation_id?: number }, index: number): string {
  if (segment.operation_id != null) return `op-${segment.operation_id}`;
  return `seg-${index}`;
}

function expandStationTimelineTasks(task: GanttTask): GanttTask[] {
  if (task.segments?.length) {
    return task.segments.map((seg, index) => ({
      ...task,
      id: operationTaskIdFromSegment(seg, index),
      start: seg.start,
      end: seg.end,
      work_order_id: seg.work_order_id,
    }));
  }
  if (isOperationTaskId(task.id)) return [task];
  return [];
}

function resolveStationConflictGroupKey(
  task: GanttTask,
  taskLevel: GanttTaskLevel,
  unassignedStationLabel: string,
): string {
  if (taskLevel === 'operation') {
    return (task.assigned_station_name || unassignedStationLabel).trim();
  }
  if (taskLevel === 'station') {
    if (isStationResourceTaskId(task.id)) return String(task.id);
    if (task.assigned_station_id != null) return stationResourceId(task.assigned_station_id);
    return (task.assigned_station_name || '').trim();
  }
  return task.parent == null ? '' : String(task.parent);
}

function isStationTimelineBar(
  row: Pick<GanttTask, 'id' | 'type' | 'css' | 'segments' | 'unscheduled'>
): boolean {
  if (row.type === 'summary') return true;
  if (isStationResourceTaskId(row.id)) {
    return !isStationMergedTask(row) && Boolean(row.unscheduled);
  }
  if (isEquipmentResourceTaskId(row.id)) return true;
  return String(row.css || '').includes('gantt-station-resource') || String(row.css || '').includes('gantt-equipment-resource');
}

function renderStationResourceRowLabel(
  row: Pick<
    GanttTask,
    | 'gantt_primary_label'
    | 'gantt_work_order_code'
    | 'gantt_station_label'
    | 'gantt_station_badge_count'
    | 'gantt_station_badge_tone'
  >
) {
  return (
    <GanttTaskLabel
      productName={row.gantt_station_label ?? row.gantt_primary_label}
      badgeCount={row.gantt_station_badge_count}
      badgeTone={row.gantt_station_badge_tone}
      badgeTitle={row.gantt_work_order_code}
      primaryClassName="gantt-station-resource-label"
    />
  );
}

function renderGanttGridLabel(
  row: Pick<
    GanttTask,
    | 'gantt_primary_label'
    | 'gantt_work_order_code'
    | 'gantt_station_label'
    | 'gantt_station_badge_count'
    | 'gantt_station_badge_tone'
    | 'type'
    | 'css'
    | 'id'
    | 'parent'
  >,
  taskLevel: GanttTaskLevel
) {
  if (taskLevel === 'station') {
    if (isOperationTaskId(row.id) && row.gantt_station_label) {
      return renderStationResourceRowLabel(row);
    }
    if (isStationResourceTaskId(row.id) || row.gantt_station_label) {
      return renderStationResourceRowLabel(row);
    }
    return null;
  }
  if (isStationTimelineBar(row)) {
    return renderStationResourceRowLabel(row);
  }
  return (
    <GanttTaskLabel
      productName={row.gantt_primary_label}
      workOrderCode={row.gantt_work_order_code}
    />
  );
}

function renderGanttTimelineLabel(
  row: Pick<
    GanttTask,
    | 'gantt_primary_label'
    | 'gantt_work_order_code'
    | 'gantt_station_label'
    | 'gantt_station_badge_count'
    | 'gantt_station_badge_tone'
    | 'type'
    | 'css'
    | 'id'
    | 'assigned_station_name'
    | 'assigned_equipment_name'
    | 'assigned_mold_name'
  >,
  taskLevel: GanttTaskLevel
) {
  if (taskLevel === 'station') {
    if (!isOperationTaskId(row.id)) return null;
    const tooltip = [row.gantt_primary_label, row.gantt_work_order_code, row.assigned_station_name, row.assigned_equipment_name]
      .filter(Boolean)
      .join(' · ');
    return (
      <GanttTaskLabel
        productName={row.gantt_primary_label}
        workOrderCode={row.gantt_work_order_code}
        title={tooltip}
      />
    );
  }
  if (isStationTimelineBar(row)) {
    return renderStationResourceRowLabel(row);
  }
  const tooltip = [row.gantt_primary_label, row.gantt_work_order_code, row.assigned_equipment_name, row.assigned_mold_name]
    .filter(Boolean)
    .join(' · ');
  return (
    <GanttTaskLabel
      productName={row.gantt_primary_label}
      workOrderCode={row.gantt_work_order_code}
      title={tooltip}
    />
  );
}

const GANTT_I18N = 'app.kuaizhizao.scheduling.gantt';

function buildSchedulingGanttScales(t: TFunction, viewMode: ViewMode): RiverGanttScale[] {
  const monthYear = t(`${GANTT_I18N}.scale.monthYear`);
  const week = t(`${GANTT_I18N}.scale.week`);
  const year = t(`${GANTT_I18N}.scale.year`);
  const monthShort = t(`${GANTT_I18N}.scale.monthShort`);
  if (viewMode === 'day') {
    return [
      { unit: 'month', step: 1, format: monthYear },
      { unit: 'day', step: 1, format: '%d' },
    ];
  }
  if (viewMode === 'month') {
    return [
      { unit: 'year', step: 1, format: year },
      { unit: 'month', step: 1, format: monthShort },
      { unit: 'week', step: 1, format: '%W' },
    ];
  }
  return [
    { unit: 'month', step: 1, format: monthYear },
    { unit: 'week', step: 1, format: week },
    { unit: 'day', step: 1, format: '%d' },
  ];
}

function resolveGanttColumnHeader(t: TFunction, taskLevel: GanttTaskLevel): string {
  if (taskLevel === 'station') return t(`${GANTT_I18N}.col.station`);
  if (taskLevel === 'operation') return t(`${GANTT_I18N}.col.operation`);
  if (taskLevel === 'equipment') return t(`${GANTT_I18N}.col.equipment`);
  return t(`${GANTT_I18N}.col.workOrder`);
}

function resolveGanttEmptyCopy(
  t: TFunction,
  taskLevel: GanttTaskLevel,
): { title: string; description: string } {
  const title = t(`${GANTT_I18N}.empty.title.${taskLevel}`);
  const description =
    taskLevel === 'operation'
      ? t(`${GANTT_I18N}.empty.hint.operation`)
      : taskLevel === 'work_order'
        ? t(`${GANTT_I18N}.empty.hint.work_order`)
        : t(`${GANTT_I18N}.empty.hint.resource`);
  return { title, description };
}

function parseTaskId(rawId: number | string): { kind: 'operation' | 'work_order'; id: number } | null {
  if (typeof rawId === 'number') {
    return Number.isInteger(rawId) && rawId > 0 ? { kind: 'work_order', id: rawId } : null;
  }
  const text = String(rawId).trim();
  const opMatch = text.match(/^op-(\d+)$/i);
  if (opMatch) {
    const id = Number(opMatch[1]);
    return Number.isInteger(id) && id > 0 ? { kind: 'operation', id } : null;
  }
  const woId = Number(text);
  if (Number.isInteger(woId) && woId > 0) {
    return { kind: 'work_order', id: woId };
  }
  return null;
}

export interface GanttDateUpdate {
  work_order_id: number;
  planned_start_date: string;
  planned_end_date: string;
}

export interface GanttOperationDateUpdate {
  operation_id: number;
  planned_start_date: string;
  planned_end_date: string;
}

export interface GanttOperationStationUpdate {
  operation_id: number;
  assigned_station_id: number;
}

export interface GanttSchedulingChartProps {
  workOrders: WorkOrderForGantt[];
  workstations?: WorkstationResource[];
  loading?: boolean;
  viewMode?: ViewMode;
  taskLevel?: GanttTaskLevel;
  freezeHorizonDays?: number;
  focusTaskId?: string | null;
  scrollToTodayToken?: number;
  onFocusTaskConsumed?: () => void;
  bottleneckWorkCenterIds?: number[];
  onViewModeChange?: (mode: ViewMode) => void;
  onBatchUpdate?: (updates: GanttDateUpdate[]) => void | Promise<void>;
  onBatchUpdateOperations?: (updates: GanttOperationDateUpdate[]) => void | Promise<void>;
  onBatchUpdateOperationStations?: (updates: GanttOperationStationUpdate[]) => void | Promise<void>;
  onWorkOrderSelect?: (workOrderId: number | null) => void;
  onRefresh?: () => void;
  nonDraggableTaskIds?: Array<number | string>;
  onBlockedDragAttempt?: (taskId: number | string) => void;
  canUpdate?: boolean;
}

const GanttSchedulingChart: React.FC<GanttSchedulingChartProps> = ({
  workOrders,
  workstations = [],
  loading = false,
  viewMode = 'week',
  taskLevel = 'station',
  freezeHorizonDays = 0,
  focusTaskId = null,
  scrollToTodayToken = 0,
  onFocusTaskConsumed,
  bottleneckWorkCenterIds = [],
  onBatchUpdate,
  onBatchUpdateOperations,
  onBatchUpdateOperationStations,
  onWorkOrderSelect,
  onRefresh,
  nonDraggableTaskIds = [],
  onBlockedDragAttempt,
  canUpdate = true,
}) => {
  const { t } = useTranslation();
  const unassignedStationLabel = t(`${GANTT_I18N}.unassignedStation`);

  useEffect(() => {
    ensureGanttIconsCssLoaded();
  }, []);

  const pendingUpdatesRef = useRef<Map<number | string, { start: Date; end: Date }>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const ganttApiRef = useRef<RiverGanttApi | null>(null);
  const tasksRef = useRef<GanttTask[]>([]);
  const safeWorkOrdersRef = useRef<WorkOrderForGantt[]>([]);
  const appliedFocusTaskRef = useRef<string | null>(null);
  const lockedTaskIds = useMemo(() => new Set(nonDraggableTaskIds.map((id) => String(id))), [nonDraggableTaskIds]);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<number | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Array<number | string>>([]);
  const [dragConflictIds, setDragConflictIds] = useState<Set<string>>(new Set());

  const safeWorkOrders = workOrders ?? [];
  const bottleneckSet = useMemo(() => new Set(bottleneckWorkCenterIds), [bottleneckWorkCenterIds]);

  const tasks = useMemo(() => {
    const base = workOrdersToGanttTasks(safeWorkOrders, taskLevel, workstations ?? []);
    if (bottleneckSet.size === 0) return base;
    return base.map((t) => {
      const wcId = safeWorkOrders.find((w) => w.id === t.work_order_id)?.work_center_id;
      if (wcId == null || !bottleneckSet.has(Number(wcId))) return t;
      const tag = 'gantt-bottleneck-wo';
      return {
        ...t,
        css: [t.css, tag].filter(Boolean).join(' '),
        class: [t.class, tag].filter(Boolean).join(' '),
      };
    });
  }, [safeWorkOrders, taskLevel, workstations, bottleneckSet]);

  tasksRef.current = tasks;
  safeWorkOrdersRef.current = safeWorkOrders;

  const computeDragConflicts = useCallback(
    (pending: Map<number | string, { start: Date; end: Date }>) => {
      if (!RESOURCE_LEVELS.includes(taskLevel)) {
        setDragConflictIds(new Set());
        return;
      }
      const byGroup = new Map<string, GanttTask[]>();
      for (const t of tasks) {
        const expanded = expandStationTimelineTasks(t);
        for (const slice of expanded) {
          const key = resolveStationConflictGroupKey(t, taskLevel, unassignedStationLabel);
          if (!key) continue;
          if (!byGroup.has(key)) byGroup.set(key, []);
          const patch = pending.get(slice.id) ?? pending.get(t.id);
          byGroup.get(key)!.push(patch ? { ...slice, start: patch.start, end: patch.end } : slice);
        }
      }
      const conflictIds = new Set<string>();
      for (const siblings of byGroup.values()) {
        findOverlappingTaskIds(siblings).forEach((id) => conflictIds.add(id));
      }
      setDragConflictIds(conflictIds);
    },
    [taskLevel, tasks, unassignedStationLabel],
  );

  const displayTasks = useMemo(() => {
    return tasks.map((t) => {
      let next = t;
      const decorateSlice = (sliceId: string, css: string, className: string) => {
        if (t.segments?.length) {
          next = {
            ...next,
            segments: t.segments.map((seg, index) => {
              const segId = operationTaskIdFromSegment(seg, index);
              if (segId !== sliceId) return seg;
              return {
                ...seg,
                css: [seg.css, css].filter(Boolean).join(' '),
                class: [seg.class, className].filter(Boolean).join(' '),
              };
            }),
          };
          return;
        }
        next = {
          ...next,
          css: [next.css, css].filter(Boolean).join(' '),
          class: [next.class, className].filter(Boolean).join(' '),
        };
      };

      if (selectedWorkOrderId != null) {
        if (t.segments?.length) {
          const hasSelected = t.segments.some((seg) => seg.work_order_id === selectedWorkOrderId);
          if (hasSelected) {
            next = {
              ...next,
              segments: t.segments.map((seg) => {
                if (seg.work_order_id !== selectedWorkOrderId) return seg;
                const extra = 'gantt-wo-flow-selected';
                return {
                  ...seg,
                  css: [seg.css, extra].filter(Boolean).join(' '),
                  class: [seg.class, extra].filter(Boolean).join(' '),
                };
              }),
            };
          }
        } else if (t.work_order_id === selectedWorkOrderId && isOperationTaskId(t.id)) {
          decorateSlice(String(t.id), 'gantt-wo-flow-selected', 'gantt-wo-flow-selected');
        }
      }

      if (t.segments?.length) {
        next = {
          ...next,
          segments: t.segments.map((seg, index) => {
            const segId = operationTaskIdFromSegment(seg, index);
            if (!dragConflictIds.has(segId)) return seg;
            return {
              ...seg,
              css: [seg.css, 'gantt-drag-conflict', 'gantt-task-red'].filter(Boolean).join(' '),
              class: [seg.class, 'gantt-drag-conflict', 'gantt-task-red'].filter(Boolean).join(' '),
            };
          }),
        };
      } else if (dragConflictIds.has(String(t.id))) {
        decorateSlice(String(t.id), 'gantt-drag-conflict gantt-task-red', 'gantt-drag-conflict gantt-task-red');
      }
      return next;
    });
  }, [tasks, selectedWorkOrderId, dragConflictIds]);

  const processFlowLinks = useMemo(() => {
    if (!RESOURCE_LEVELS.includes(taskLevel) || selectedWorkOrderId == null) return [];
    return buildWorkOrderOperationLinks(selectedWorkOrderId, safeWorkOrders);
  }, [taskLevel, selectedWorkOrderId, safeWorkOrders]);

  useEffect(() => {
    if (selectedWorkOrderId == null) return;
    if (!safeWorkOrders.some((w) => w.id === selectedWorkOrderId)) {
      setSelectedWorkOrderId(null);
      setSelectedTaskIds([]);
      onWorkOrderSelect?.(null);
    }
  }, [safeWorkOrders, selectedWorkOrderId, onWorkOrderSelect]);

  useEffect(() => {
    if (taskLevel === 'station') return;
    if (!focusTaskId) {
      appliedFocusTaskRef.current = null;
      return;
    }
    if (!ganttApiRef.current) return;
    if (appliedFocusTaskRef.current === focusTaskId) return;

    const api = ganttApiRef.current;
    const targetFocusId = focusTaskId;
    appliedFocusTaskRef.current = targetFocusId;

    requestAnimationFrame(() => {
      if (!ganttApiRef.current) return;
      const parsed = parseTaskId(targetFocusId);
      let ganttSelectId: number | string = targetFocusId;
      if (parsed?.kind === 'operation') {
        const stationRowId = resolveStationRowIdForOperation(parsed.id, tasksRef.current);
        if (stationRowId) ganttSelectId = stationRowId;
      }
      api.exec('select-task', { id: ganttSelectId, show: true });
      const woId = resolveWorkOrderIdFromTask(
        targetFocusId,
        tasksRef.current,
        safeWorkOrdersRef.current
      );
      if (woId != null) {
        setSelectedWorkOrderId(woId);
        setSelectedTaskIds(getWorkOrderOperationTaskIds(woId, safeWorkOrdersRef.current));
        onWorkOrderSelect?.(woId);
      }
      onFocusTaskConsumed?.();
    });
  }, [focusTaskId, onFocusTaskConsumed, onWorkOrderSelect, taskLevel]);

  useEffect(() => {
    if (taskLevel === 'station') return;
    if (!scrollToTodayToken || !ganttApiRef.current) return;
    scrollGanttToToday(ganttApiRef.current, wrapperRef.current);
  }, [scrollToTodayToken, taskLevel]);

  const scales = useMemo(() => buildSchedulingGanttScales(t, viewMode), [t, viewMode]);

  const ganttColumns = useMemo(() => {
    const taskHeader = resolveGanttColumnHeader(t, taskLevel);
    const cols: RiverGanttColumn[] = [
      {
        id: 'text',
        header: taskHeader,
        width: 168,
        align: 'left',
        cell: ({ row }: { row: RiverGanttTask }) =>
          renderGanttGridLabel(row as unknown as GanttTask, taskLevel),
      },
    ];
    return cols;
  }, [t, taskLevel]);

  const schedulingTaskTemplate = useMemo(
    () =>
      taskLevel === 'station'
        ? undefined
        : function SchedulingTaskTemplate({ data }: { data: RiverGanttTask }) {
            return renderGanttTimelineLabel(data as unknown as GanttTask, taskLevel);
          },
    [taskLevel]
  );

  const { start, end } = useMemo(() => {
    if (tasks.length === 0) {
      const t = dayjs();
      return {
        start: t.subtract(7, 'day').toDate(),
        end: t.add(30, 'day').toDate(),
      };
    }
    const dates = tasks.flatMap((t) => [t.start.getTime(), t.end.getTime()]);
    const min = Math.min(...dates);
    const max = Math.max(...dates);
    return {
      start: new Date(min - 7 * 24 * 60 * 60 * 1000),
      end: new Date(max + 14 * 24 * 60 * 60 * 1000),
    };
  }, [tasks]);

  const freezeUntil = useMemo(
    () => (freezeHorizonDays > 0 ? dayjs().add(freezeHorizonDays, 'day').endOf('day').toDate() : null),
    [freezeHorizonDays]
  );
  const showTodayMarker = viewMode === 'day' || viewMode === 'week';

  const selectWorkOrderGroup = useCallback(
    (woId: number | null, toggle?: boolean) => {
      if (woId == null) {
        setSelectedWorkOrderId(null);
        setSelectedTaskIds([]);
        onWorkOrderSelect?.(null);
        return;
      }
      if (selectedWorkOrderId === woId && toggle) {
        setSelectedWorkOrderId(null);
        setSelectedTaskIds([]);
        onWorkOrderSelect?.(null);
        return;
      }
      setSelectedWorkOrderId(woId);
      const ids = getWorkOrderOperationTaskIds(woId, safeWorkOrders);
      setSelectedTaskIds(ids);
      onWorkOrderSelect?.(woId);
    },
    [onWorkOrderSelect, safeWorkOrders, selectedWorkOrderId]
  );

  const handleSelectTask = useCallback(
    (ev: { id: number | string; toggle?: boolean }) => {
      if (!RESOURCE_LEVELS.includes(taskLevel)) return;
      if (isOperationTaskId(ev.id)) {
        const woId = resolveWorkOrderIdFromTask(ev.id, tasks, safeWorkOrders);
        selectWorkOrderGroup(woId, ev.toggle);
        return;
      }
      if (isStationResourceTaskId(ev.id)) {
        const stationTask = tasks.find((t) => String(t.id) === String(ev.id));
        if (stationTask?.segments?.length === 1 && stationTask.segments[0].work_order_id != null) {
          selectWorkOrderGroup(stationTask.segments[0].work_order_id, ev.toggle);
          return;
        }
        if (stationTask?.segments && stationTask.segments.length > 1) {
          return;
        }
      }
      selectWorkOrderGroup(null);
    },
    [taskLevel, tasks, safeWorkOrders, selectWorkOrderGroup]
  );

  const handleGanttInit = useCallback(
    (api: RiverGanttApi) => {
      ganttApiRef.current = api;
      if (taskLevel !== 'station' || !onBatchUpdateOperationStations) return;
      api.on('move-task', (ev: { id: number | string; target?: number | string; mode: string; inProgress?: boolean }) => {
        if (ev.inProgress || ev.mode !== 'child' || !ev.target) return;
        const stationId = parseStationIdFromResourceRow(ev.target);
        const parsed = parseTaskId(ev.id);
        if (stationId == null || !parsed || parsed.kind !== 'operation') return;
        onBatchUpdateOperationStations([{ operation_id: parsed.id, assigned_station_id: stationId }]);
      });
    },
    [taskLevel, onBatchUpdateOperationStations]
  );

  const handleUpdateTask = useCallback(
    (ev: {
      id: number | string;
      segmentIndex?: number;
      inProgress?: boolean;
      task: { start?: Date; end?: Date; duration?: number };
    }) => {
      if (ev.inProgress) return;

      const id = ev.id;
      const stationTask = tasksRef.current.find((t) => String(t.id) === String(id));
      const segmentIndex = ev.segmentIndex;
      const segmentFromRef =
        stationTask?.segments && segmentIndex != null ? stationTask.segments[segmentIndex] : undefined;
      const segmentOpId = segmentFromRef?.operation_id;

      let newStart = ev.task.start ?? segmentFromRef?.start;
      let newEnd = ev.task.end ?? segmentFromRef?.end;

      const liveTask = ganttApiRef.current?.getTask(id);
      const liveSegment =
        liveTask?.segments && segmentIndex != null ? liveTask.segments[segmentIndex] : undefined;
      if (liveSegment?.start) newStart = liveSegment.start;
      if (liveSegment?.end) newEnd = liveSegment.end;

      if (!newStart || !newEnd) return;

      if (isResourceRowTaskId(id) && segmentIndex == null) {
        onBlockedDragAttempt?.(id);
        return;
      }
      const lockedOpId = segmentOpId != null ? `op-${segmentOpId}` : String(id);
      if (lockedTaskIds.has(lockedOpId)) {
        onBlockedDragAttempt?.(id);
        return;
      }

      const pendingId = segmentOpId != null ? (`op-${segmentOpId}` as const) : id;
      pendingUpdatesRef.current.set(pendingId, { start: newStart, end: newEnd });
      computeDragConflicts(pendingUpdatesRef.current);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        debounceRef.current = null;
        const toApply = new Map(pendingUpdatesRef.current);
        pendingUpdatesRef.current.clear();
        setDragConflictIds(new Set());
        if (toApply.size === 0) return;

        const opUpdates: GanttOperationDateUpdate[] = [];
        const woUpdates: GanttDateUpdate[] = [];
        for (const [k, { start, end }] of toApply.entries()) {
          const parsed = parseTaskId(k);
          if (!parsed) continue;
          if (parsed.kind === 'operation') {
            opUpdates.push({
              operation_id: parsed.id,
              planned_start_date: dayjs(start).toISOString(),
              planned_end_date: dayjs(end).toISOString(),
            });
          } else {
            woUpdates.push({
              work_order_id: parsed.id,
              planned_start_date: dayjs(start).toISOString(),
              planned_end_date: dayjs(end).toISOString(),
            });
          }
        }
        try {
          if (opUpdates.length > 0 && onBatchUpdateOperations) await onBatchUpdateOperations(opUpdates);
          if (woUpdates.length > 0 && onBatchUpdate) await onBatchUpdate(woUpdates);
        } catch {
          toApply.forEach((v, k) => pendingUpdatesRef.current.set(k, v));
          computeDragConflicts(pendingUpdatesRef.current);
          onRefresh?.();
        }
      }, 400);
    },
    [
      computeDragConflicts,
      lockedTaskIds,
      onBatchUpdate,
      onBatchUpdateOperations,
      onBlockedDragAttempt,
      onRefresh,
    ]
  );

  if (loading) {
    return (
      <div className="gantt-chart-wrapper gantt-chart-wrapper--visual" style={{ padding: '48px 0', textAlign: 'center' }}>
        <Spin tip={t('app.kuaizhizao.scheduling.pool.loadingGantt')} />
      </div>
    );
  }

  const readonly = !canUpdate || (!onBatchUpdate && !onBatchUpdateOperations);

  if (tasks.length === 0) {
    const emptyCopy = resolveGanttEmptyCopy(t, taskLevel);
    return (
      <div className="gantt-chart-wrapper gantt-chart-wrapper--visual" style={{ padding: '32px 16px' }}>
        <Empty
          description={
            <span>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>{emptyCopy.title}</div>
              <Typography.Text type="secondary">{emptyCopy.description}</Typography.Text>
            </span>
          }
        />
      </div>
    );
  }

  return (
    <div
      className={`gantt-chart-wrapper gantt-chart-wrapper--visual${selectedWorkOrderId != null ? ' gantt-chart-wrapper--wo-flow-active' : ''}`}
      ref={wrapperRef}
    >
      <RiverGantt
        tasks={displayTasks}
        links={processFlowLinks}
        selected={selectedTaskIds}
        scales={scales}
        start={start}
        end={end}
        zoom
        splitTasks={taskLevel === 'station'}
        cellHeight={GANTT_ROW_HEIGHT}
        taskTemplate={schedulingTaskTemplate}
        todayMarker={showTodayMarker}
        freezeUntil={freezeUntil}
        nonDraggableTaskIds={nonDraggableTaskIds}
        onUpdateTask={handleUpdateTask}
        onSelectTask={handleSelectTask}
        onBlockedDragAttempt={onBlockedDragAttempt}
        init={handleGanttInit}
        readonly={readonly}
        columns={ganttColumns}
      />
    </div>
  );
};

export default GanttSchedulingChart;
export type { WorkOrderForGantt, GanttTask, ViewMode, GanttTaskLevel, WorkstationResource } from './types';
