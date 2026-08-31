/**
 * 交付项目进度甘特图（交付中心看板）
 */

import React, { useEffect, useMemo } from 'react';
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
  type: 'task';
  lazy: false;
}

const GANTT_CELL_HEIGHT = 36;
const GANTT_SCALE_HEIGHT = 28;
const GANTT_SCALE_ROWS = 3;

function ganttContentHeight(rowCount: number): number {
  return GANTT_SCALE_ROWS * GANTT_SCALE_HEIGHT + rowCount * GANTT_CELL_HEIGHT;
}

function buildGanttScales(t: TFunction) {
  return [
    { unit: 'month' as const, step: 1, format: t('app.kuaizhizao.deliveryProject.gantt.scale.month') },
    { unit: 'week' as const, step: 1, format: t('app.kuaizhizao.deliveryProject.gantt.scale.week') },
    { unit: 'day' as const, step: 1, format: '%d' },
  ];
}

function formatColumnDate(value: Date): string {
  return formatDateTime(dayjs(value), 'YYYY-MM-DD');
}

function toGanttTask(t: TFunction, item: DeliveryProjectGanttItem, index: number): GanttTask {
  const startStr = item.planned_start_date || formatDateTime(dayjs(), 'YYYY-MM-DD');
  const endStr = item.planned_end_date || formatDateTime(dayjs(startStr).add(14, 'day'), 'YYYY-MM-DD');
  const start = dayjs(startStr).toDate();
  let end = dayjs(endStr).toDate();
  if (end.getTime() <= start.getTime()) {
    end = dayjs(startStr).add(7, 'day').toDate();
  }
  const durationMs = end.getTime() - start.getTime();
  const duration = Math.max(1, Math.ceil(durationMs / (24 * 60 * 60 * 1000)));
  const text =
    [item.project_code, item.node_name].filter(Boolean).join(' · ') ||
    `${t('app.kuaizhizao.deliveryProject.fields.projectName')} ${index + 1}`;
  return {
    id: item.id ?? index,
    text,
    start,
    end,
    duration,
    progress: Math.min(100, Math.max(0, Number(item.progress ?? 0))),
    type: 'task',
    lazy: false,
  };
}

interface DeliveryProjectGanttChartProps {
  items: DeliveryProjectGanttItem[];
}

const DeliveryProjectGanttChart: React.FC<DeliveryProjectGanttChartProps> = ({ items }) => {
  const { t } = useTranslation();
  const isDark = useThemeStore((s) => s.resolved.isDark);
  const GanttTheme = isDark ? WillowDark : Willow;

  useEffect(() => {
    ensureGanttIconsCssLoaded();
  }, []);

  const tasks = useMemo(() => items.map((item, index) => toGanttTask(t, item, index)), [items, t]);
  const scales = useMemo(() => buildGanttScales(t), [t]);

  const columns = useMemo(
    () => [
      { id: 'text', header: t('app.kuaizhizao.deliveryProject.gantt.columns.projectNode'), width: 240 },
      { id: 'start', header: t('app.kuaizhizao.deliveryProject.gantt.columns.plannedStart'), width: 100, template: formatColumnDate },
      { id: 'end', header: t('app.kuaizhizao.deliveryProject.gantt.columns.plannedEnd'), width: 100, template: formatColumnDate },
      { id: 'duration', header: t('app.kuaizhizao.deliveryProject.gantt.columns.durationDays'), width: 80 },
      { id: 'progress', header: t('app.kuaizhizao.deliveryProject.gantt.columns.progressPercent'), width: 72 },
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
      style={{ height: ganttContentHeight(tasks.length) }}
    >
      <GanttTheme>
        <Gantt
          tasks={tasks}
          links={[]}
          scales={scales}
          start={start}
          end={end}
          zoom
          readonly
          columns={columns}
          cellHeight={GANTT_CELL_HEIGHT}
          scaleHeight={GANTT_SCALE_HEIGHT}
        />
      </GanttTheme>
    </div>
  );
};

export default DeliveryProjectGanttChart;
