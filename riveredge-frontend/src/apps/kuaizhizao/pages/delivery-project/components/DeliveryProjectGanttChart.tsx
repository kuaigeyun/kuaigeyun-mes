/**
 * 交付项目进度甘特图（交付中心看板）
 * 默认以项目为维度展示；展开后可查看各节点计划条。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Empty } from 'antd';
import { Gantt, Willow, WillowDark } from '@svar-ui/react-gantt';
import '@svar-ui/react-gantt/all.css';
import '../../../components/gantt-scrollbar.less';
import dayjs from 'dayjs';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ensureGanttIconsCssLoaded } from '../../../../../utils/loadGanttIconsCss';
import { formatDateTime } from '../../../../../utils/format';
import { useThemeStore } from '../../../../../stores/themeStore';
import { UNI_TABLE_PROGRESS_COLUMN_WIDTH } from '../../../../../utils/uniTableLayoutColumns';
import {
  clampPushProgressPercent,
  DocumentPushProgressBar,
} from '../../sales-management/shared/DocumentPushProgressBar';
import { resolveDeliveryProgressStatus } from '../shared/deliveryProgressColumn';

export interface DeliveryProjectGanttItem {
  id: number;
  project_id: number;
  node_id: number;
  project_code: string;
  project_name: string;
  node_name: string;
  customer_name?: string | null;
  node_status?: string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  progress?: number;
}

interface GanttTask {
  id: number;
  text: string;
  start: Date;
  end: Date;
  duration: number;
  progress: number;
  type: 'task' | 'summary';
  parent?: number;
  open?: boolean;
  lazy: false;
  node_status?: string | null;
}

function normalizeProgress(value: unknown): number {
  return clampPushProgressPercent(Number(value ?? 0));
}

function DeliveryGanttProgressCell({ row }: { row: GanttTask }) {
  const percent = normalizeProgress(row.progress);
  return (
    <DocumentPushProgressBar
      percent={percent}
      status={resolveDeliveryProgressStatus(row.node_status, percent)}
      tooltipSummary={`${percent}%`}
    />
  );
}

export type DeliveryGanttViewMode = 'day' | 'week' | 'month';

const GANTT_CELL_HEIGHT = 36;
const GANTT_SCALE_HEIGHT = 28;

function projectSummaryId(projectId: number): number {
  return projectId * 100000;
}

function ganttContentHeight(rowCount: number, scaleRows: number): number {
  return scaleRows * GANTT_SCALE_HEIGHT + rowCount * GANTT_CELL_HEIGHT;
}

function buildGanttScales(t: TFunction, viewMode: DeliveryGanttViewMode) {
  const month = t('app.kuaizhizao.deliveryProject.gantt.scale.month');
  const week = t('app.kuaizhizao.deliveryProject.gantt.scale.week');
  if (viewMode === 'day') {
    return [
      { unit: 'month' as const, step: 1, format: month },
      { unit: 'week' as const, step: 1, format: week },
      { unit: 'day' as const, step: 1, format: '%d' },
    ];
  }
  if (viewMode === 'month') {
    return [
      { unit: 'year' as const, step: 1, format: t('app.kuaizhizao.deliveryProject.gantt.scale.year') },
      { unit: 'month' as const, step: 1, format: t('app.kuaizhizao.deliveryProject.gantt.scale.monthShort') },
    ];
  }
  return [
    { unit: 'month' as const, step: 1, format: month },
    { unit: 'week' as const, step: 1, format: week },
  ];
}

function ganttCellWidth(viewMode: DeliveryGanttViewMode): number {
  if (viewMode === 'day') {
    return 36;
  }
  if (viewMode === 'month') {
    return 96;
  }
  return 56;
}

function formatColumnDate(value: Date): string {
  return formatDateTime(dayjs(value), 'YYYY-MM-DD');
}

function resolveItemDates(item: DeliveryProjectGanttItem): Pick<GanttTask, 'start' | 'end' | 'duration'> {
  const startStr = item.planned_start_date || formatDateTime(dayjs(), 'YYYY-MM-DD');
  const endStr = item.planned_end_date || formatDateTime(dayjs(startStr).add(14, 'day'), 'YYYY-MM-DD');
  const start = dayjs(startStr).toDate();
  let end = dayjs(endStr).toDate();
  if (end.getTime() <= start.getTime()) {
    end = dayjs(startStr).add(7, 'day').toDate();
  }
  const durationMs = end.getTime() - start.getTime();
  const duration = Math.max(1, Math.ceil(durationMs / (24 * 60 * 60 * 1000)));
  return { start, end, duration };
}

function buildProjectLabel(item: DeliveryProjectGanttItem): string {
  const parts = [item.project_code, item.project_name].filter(Boolean);
  if (item.customer_name) {
    parts.push(item.customer_name);
  }
  return parts.join(' ');
}

function countVisibleGanttRows(tasks: GanttTask[], expandedSummaryIds: ReadonlySet<number>): number {
  const childCountBySummary = new Map<number, number>();
  for (const task of tasks) {
    if (task.parent && task.parent !== 0) {
      childCountBySummary.set(task.parent, (childCountBySummary.get(task.parent) ?? 0) + 1);
    }
  }

  let visibleRows = 0;
  for (const task of tasks) {
    if (task.parent !== 0) {
      continue;
    }
    visibleRows += 1;
    if (expandedSummaryIds.has(task.id)) {
      visibleRows += childCountBySummary.get(task.id) ?? 0;
    }
  }
  return Math.max(visibleRows, 1);
}

function buildHierarchicalTasks(
  t: TFunction,
  items: DeliveryProjectGanttItem[],
  defaultExpanded: boolean,
): GanttTask[] {
  const projectOrder: number[] = [];
  const nodesByProject = new Map<number, DeliveryProjectGanttItem[]>();

  for (const item of items) {
    if (!nodesByProject.has(item.project_id)) {
      projectOrder.push(item.project_id);
      nodesByProject.set(item.project_id, []);
    }
    nodesByProject.get(item.project_id)!.push(item);
  }

  const tasks: GanttTask[] = [];

  for (const projectId of projectOrder) {
    const nodes = nodesByProject.get(projectId) ?? [];
    if (nodes.length === 0) {
      continue;
    }

    const head = nodes[0];
    const summaryId = projectSummaryId(projectId);

    if (nodes.length === 1 && head.node_id === 0) {
      const dates = resolveItemDates(head);
      tasks.push({
        id: summaryId,
        text: buildProjectLabel(head),
        ...dates,
        progress: normalizeProgress(head.progress),
        type: 'summary',
        parent: 0,
        open: defaultExpanded,
        lazy: false,
        node_status: head.node_status,
      });
      continue;
    }

    const nodeTasks = nodes
      .filter((node) => node.node_id !== 0)
      .map((node) => {
        const dates = resolveItemDates(node);
        return {
          id: node.id,
          text: node.node_name,
          ...dates,
          progress: normalizeProgress(node.progress),
          type: 'task' as const,
          parent: summaryId,
          lazy: false as const,
          node_status: node.node_status,
        };
      });

    if (nodeTasks.length === 0) {
      continue;
    }

    const start = new Date(Math.min(...nodeTasks.map((task) => task.start.getTime())));
    const end = new Date(Math.max(...nodeTasks.map((task) => task.end.getTime())));
    const durationMs = end.getTime() - start.getTime();
    const duration = Math.max(1, Math.ceil(durationMs / (24 * 60 * 60 * 1000)));
    const progress = normalizeProgress(
      nodeTasks.reduce((sum, task) => sum + task.progress, 0) / Math.max(nodeTasks.length, 1),
    );

    tasks.push({
      id: summaryId,
      text: buildProjectLabel(head),
      start,
      end,
      duration,
      progress,
      type: 'summary',
      parent: 0,
      open: defaultExpanded,
      lazy: false,
      node_status: progress >= 100 ? 'completed' : null,
    });
    tasks.push(...nodeTasks);
  }

  if (tasks.length === 0 && items.length > 0) {
    return items.map((item, index) => {
      const dates = resolveItemDates(item);
      return {
        id: item.id ?? index,
        text:
          buildProjectLabel(item) ||
          `${t('app.kuaizhizao.deliveryProject.fields.projectName')} ${index + 1}`,
        ...dates,
        progress: normalizeProgress(item.progress),
        type: 'summary' as const,
        parent: 0,
        open: defaultExpanded,
        lazy: false as const,
        node_status: item.node_status,
      };
    });
  }

  return tasks;
}

function collectSummaryIds(tasks: GanttTask[]): Set<number> {
  return new Set(tasks.filter((task) => task.type === 'summary' && task.parent === 0).map((task) => task.id));
}

interface DeliveryProjectGanttChartProps {
  items: DeliveryProjectGanttItem[];
  viewMode?: DeliveryGanttViewMode;
  /** 工作台单项目场景默认展开节点行 */
  defaultExpanded?: boolean;
}

const DeliveryProjectGanttChart: React.FC<DeliveryProjectGanttChartProps> = ({
  items,
  viewMode = 'week',
  defaultExpanded = false,
}) => {
  const { t } = useTranslation();
  const isDark = useThemeStore((s) => s.resolved.isDark);
  const GanttTheme = isDark ? WillowDark : Willow;
  const [expandedSummaryIds, setExpandedSummaryIds] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    ensureGanttIconsCssLoaded();
  }, []);

  const tasks = useMemo(
    () => buildHierarchicalTasks(t, items, defaultExpanded),
    [defaultExpanded, items, t],
  );

  useEffect(() => {
    setExpandedSummaryIds(defaultExpanded ? collectSummaryIds(tasks) : new Set());
  }, [defaultExpanded, tasks]);
  const visibleRowCount = useMemo(
    () => countVisibleGanttRows(tasks, expandedSummaryIds),
    [tasks, expandedSummaryIds],
  );
  const scales = useMemo(() => buildGanttScales(t, viewMode), [t, viewMode]);
  const cellWidth = ganttCellWidth(viewMode);

  const handleOpenTask = useCallback((event: { id: number; mode: boolean }) => {
    setExpandedSummaryIds((prev) => {
      const next = new Set(prev);
      if (event.mode) {
        next.add(event.id);
      } else {
        next.delete(event.id);
      }
      return next;
    });
  }, []);

  const columns = useMemo(
    () => [
      { id: 'text', header: t('app.kuaizhizao.deliveryProject.gantt.columns.projectNode'), width: 280 },
      { id: 'start', header: t('app.kuaizhizao.deliveryProject.gantt.columns.plannedStart'), width: 100, template: formatColumnDate },
      { id: 'end', header: t('app.kuaizhizao.deliveryProject.gantt.columns.plannedEnd'), width: 100, template: formatColumnDate },
      { id: 'duration', header: t('app.kuaizhizao.deliveryProject.gantt.columns.durationDays'), width: 80 },
      {
        id: 'progress',
        header: t('app.kuaizhizao.deliveryProject.gantt.columns.progressPercent'),
        width: UNI_TABLE_PROGRESS_COLUMN_WIDTH,
        cell: DeliveryGanttProgressCell,
      },
    ],
    [t],
  );

  const { start, end } = useMemo(() => {
    if (tasks.length === 0) {
      const now = dayjs();
      return {
        start: now.subtract(14, 'day').toDate(),
        end: now.add(120, 'day').toDate(),
      };
    }
    const dates = tasks.flatMap((task) => [task.start.getTime(), task.end.getTime()]);
    const min = Math.min(...dates);
    const max = Math.max(...dates);
    return {
      start: new Date(min - 14 * 24 * 60 * 60 * 1000),
      end: new Date(max + 21 * 24 * 60 * 60 * 1000),
    };
  }, [tasks]);

  if (tasks.length === 0) {
    return <Empty description={t('app.kuaizhizao.deliveryProject.gantt.empty')} style={{ padding: '32px 16px' }} />;
  }

  return (
    <div
      className="gantt-chart-wrapper gantt-chart-wrapper--visual gantt-chart-wrapper--delivery-dashboard"
      style={{ height: ganttContentHeight(visibleRowCount, scales.length) }}
    >
      <GanttTheme>
        <Gantt
          key={viewMode}
          tasks={tasks}
          links={[]}
          scales={scales}
          start={start}
          end={end}
          zoom
          readonly
          columns={columns}
          cellWidth={cellWidth}
          cellHeight={GANTT_CELL_HEIGHT}
          scaleHeight={GANTT_SCALE_HEIGHT}
          onOpenTask={handleOpenTask}
        />
      </GanttTheme>
    </div>
  );
};

export default DeliveryProjectGanttChart;
