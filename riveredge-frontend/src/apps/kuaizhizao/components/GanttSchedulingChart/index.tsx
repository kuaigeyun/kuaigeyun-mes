/**
 * 甘特图排产组件
 *
 * 基于 @svar-ui/react-gantt 实现工单级时间轴展示、拖拽调整、日/周/月视图。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gantt, Willow } from '@svar-ui/react-gantt';
import '@svar-ui/react-gantt/all.css';
import '../gantt-scrollbar.less';
import type { WorkOrderForGantt } from './types';
import { workOrdersToGanttTasks } from './utils';
import type { ViewMode, GanttTaskLevel, GanttTask } from './types';
import dayjs from 'dayjs';
import { ensureGanttIconsCssLoaded } from '../../../../utils/loadGanttIconsCss';
import { GanttTaskLabel } from './GanttTaskLabel';

const GANTT_ROW_HEIGHT = 44;

function renderGanttTaskLabel(row: Pick<GanttTask, 'gantt_primary_label' | 'gantt_work_order_code' | 'text'>) {
  return (
    <GanttTaskLabel
      productName={row.gantt_primary_label}
      workOrderCode={row.gantt_work_order_code}
    />
  );
}

const SchedulingTaskTemplate: React.FC<{
  data: Pick<GanttTask, 'gantt_primary_label' | 'gantt_work_order_code' | 'text'>;
}> = ({ data }) => renderGanttTaskLabel(data);

const SCALES_DAY = [
  { unit: 'month', step: 1, format: '%Y年%m月' },
  { unit: 'day', step: 1, format: '%d' },
];

const SCALES_WEEK = [
  { unit: 'month', step: 1, format: '%Y年%m月' },
  { unit: 'week', step: 1, format: '第%W周' },
  { unit: 'day', step: 1, format: '%d' },
];

const SCALES_MONTH = [
  { unit: 'year', step: 1, format: '%Y年' },
  { unit: 'month', step: 1, format: '%m月' },
  { unit: 'week', step: 1, format: '%W' },
];

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

export interface GanttSchedulingChartProps {
  workOrders: WorkOrderForGantt[];
  loading?: boolean;
  viewMode?: ViewMode;
  taskLevel?: GanttTaskLevel;
  onViewModeChange?: (mode: ViewMode) => void;
  onBatchUpdate?: (updates: GanttDateUpdate[]) => void | Promise<void>;
  onBatchUpdateOperations?: (updates: GanttOperationDateUpdate[]) => void | Promise<void>;
  onRefresh?: () => void;
  nonDraggableTaskIds?: Array<number | string>;
  onBlockedDragAttempt?: (taskId: number | string) => void;
}

const GanttSchedulingChart: React.FC<GanttSchedulingChartProps> = ({
  workOrders,
  loading = false,
  viewMode = 'week',
  taskLevel = 'work_order',
  onBatchUpdate,
  onBatchUpdateOperations,
  nonDraggableTaskIds = [],
  onBlockedDragAttempt,
}) => {
  // 首次渲染时按需注入 wx-icons.css，减少未使用页面/登录页的外链开销
  useEffect(() => {
    ensureGanttIconsCssLoaded();
  }, []);

  const pendingUpdatesRef = useRef<Map<number | string, { start: Date; end: Date }>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const lockedTaskIds = useMemo(() => new Set(nonDraggableTaskIds.map((id) => String(id))), [nonDraggableTaskIds]);
  const [dynamicMaxHeightPx, setDynamicMaxHeightPx] = useState<number>(0);

  const tasks = useMemo(() => {
    return workOrdersToGanttTasks(workOrders, taskLevel);
  }, [workOrders, taskLevel]);

  const scales = useMemo(() => {
    if (viewMode === 'day') return SCALES_DAY;
    if (viewMode === 'month') return SCALES_MONTH;
    return SCALES_WEEK;
  }, [viewMode]);

  const ganttColumns = useMemo(() => {
    const taskHeader = taskLevel === 'operation' ? '工单/工序' : '工单';
    return [
      {
        id: 'text',
        header: taskHeader,
        width: 168,
        cell: ({ row }: { row: GanttTask }) => renderGanttTaskLabel(row),
      },
    ];
  }, [taskLevel]);

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

  const updateDynamicMaxHeight = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    // 底部保留空间，避免挤压后续诊断/表格区域
    const reservedBottom = 180;
    const available = Math.floor(window.innerHeight - rect.top - reservedBottom);
    const clamped = Math.max(360, Math.min(available, 900));
    setDynamicMaxHeightPx(clamped);
  }, []);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    updateDynamicMaxHeight();
    const onResize = () => updateDynamicMaxHeight();
    window.addEventListener('resize', onResize, { passive: true });
    const resizeObserver = new ResizeObserver(() => updateDynamicMaxHeight());
    resizeObserver.observe(wrapper);
    return () => {
      window.removeEventListener('resize', onResize);
      resizeObserver.disconnect();
    };
  }, [updateDynamicMaxHeight]);

  const handleUpdateTask = useCallback(
    (ev: { id: number | string; task: { start?: Date; end?: Date; duration?: number } }) => {
      const id = ev.id;
      const { start: newStart, end: newEnd } = ev.task;
      if (!newStart || !newEnd) return;
      if (lockedTaskIds.has(String(id))) {
        onBlockedDragAttempt?.(id);
        return;
      }

      pendingUpdatesRef.current.set(id, { start: newStart, end: newEnd });

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        debounceRef.current = null;
        const toApply = new Map(pendingUpdatesRef.current);
        pendingUpdatesRef.current.clear();
        if (toApply.size === 0) return;

        const opUpdates: GanttOperationDateUpdate[] = [];
        const woUpdates: GanttDateUpdate[] = [];
        for (const [k, { start, end }] of toApply.entries()) {
          const parsed = parseTaskId(k);
          if (!parsed) {
            continue;
          }
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
        }
      }, 400);
    },
    [lockedTaskIds, onBatchUpdate, onBatchUpdateOperations, onBlockedDragAttempt]
  );

  if (loading) {
    return <div>加载中...</div>;
  }

  if (tasks.length === 0) {
    return (
      <div>
        <div>暂无待排产工单</div>
        <div>请先在需求计算或生产计划中生成工单</div>
      </div>
    );
  }

  return (
    <div
      className="gantt-chart-wrapper"
      ref={wrapperRef}
      style={dynamicMaxHeightPx > 0 ? ({ ['--gantt-max-height' as string]: `${dynamicMaxHeightPx}px` } as React.CSSProperties) : undefined}
    >
      <Willow>
        <Gantt
          tasks={tasks}
          links={[]}
          scales={scales}
          start={start}
          end={end}
          zoom
          cellHeight={GANTT_ROW_HEIGHT}
          taskTemplate={SchedulingTaskTemplate}
          onUpdateTask={handleUpdateTask}
          readonly={!onBatchUpdate && !onBatchUpdateOperations}
          columns={ganttColumns}
        />
      </Willow>
    </div>
  );
};

export default GanttSchedulingChart;
export type { WorkOrderForGantt, GanttTask, ViewMode, GanttTaskLevel } from './types';
