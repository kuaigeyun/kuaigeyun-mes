/**
 * 甘特图排产组件
 *
 * 基于 @svar-ui/react-gantt 实现工单级时间轴展示、拖拽调整、日/周/月视图。
 */

import React, { useCallback, useMemo, useRef } from 'react';
import { Gantt, Willow } from '@svar-ui/react-gantt';
import '@svar-ui/react-gantt/all.css';
import '../gantt-scrollbar.less';
import type { WorkOrderForGantt } from './types';
import { workOrdersToGanttTasks } from './utils';
import type { ViewMode, GanttTaskLevel } from './types';
import dayjs from 'dayjs';

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
}

const GanttSchedulingChart: React.FC<GanttSchedulingChartProps> = ({
  workOrders,
  loading = false,
  viewMode = 'week',
  taskLevel = 'work_order',
  onViewModeChange,
  onBatchUpdate,
  onBatchUpdateOperations,
  onRefresh,
}) => {
  const pendingUpdatesRef = useRef<Map<number | string, { start: Date; end: Date }>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tasks = useMemo(() => {
    return workOrdersToGanttTasks(workOrders, taskLevel);
  }, [workOrders, taskLevel]);

  const scales = useMemo(() => {
    if (viewMode === 'day') return SCALES_DAY;
    if (viewMode === 'month') return SCALES_MONTH;
    return SCALES_WEEK;
  }, [viewMode]);

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

  const handleUpdateTask = useCallback(
    (ev: { id: number | string; task: { start?: Date; end?: Date; duration?: number } }) => {
      const id = ev.id;
      const { start: newStart, end: newEnd } = ev.task;
      if (!newStart || !newEnd) return;

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
          if (typeof k === 'string' && String(k).startsWith('op-')) {
            opUpdates.push({
              operation_id: parseInt(String(k).replace('op-', ''), 10),
              planned_start_date: dayjs(start).toISOString(),
              planned_end_date: dayjs(end).toISOString(),
            });
          } else {
            woUpdates.push({
              work_order_id: typeof k === 'number' ? k : parseInt(String(k), 10),
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
    [onBatchUpdate, onBatchUpdateOperations]
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
    <div className="gantt-chart-wrapper">
      <Willow>
        <Gantt
          tasks={tasks}
          links={[]}
          scales={scales}
          start={start}
          end={end}
          zoom
          onUpdateTask={handleUpdateTask}
          readonly={!onBatchUpdate && !onBatchUpdateOperations}
          columns={[
            { id: 'text', header: '工单', width: 200 },
            { id: 'work_center_name', header: '工作中心', width: 120 },
            { id: 'start', header: '开始', width: 100 },
            { id: 'end', header: '结束', width: 100 },
            { id: 'duration', header: '工期', width: 60 },
          ]}
        />
      </Willow>
    </div>
  );
};

export default GanttSchedulingChart;
export type { WorkOrderForGantt, GanttTask, ViewMode, GanttTaskLevel } from './types';
