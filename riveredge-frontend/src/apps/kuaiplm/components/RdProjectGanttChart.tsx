/**
 * 研发项目进度甘特图
 */

import React, { useEffect, useMemo } from 'react';
import { Empty } from 'antd';
import { Gantt, Willow } from '@svar-ui/react-gantt';
import '@svar-ui/react-gantt/all.css';
import '../../kuaizhizao/components/gantt-scrollbar.less';
import dayjs from 'dayjs';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ensureGanttIconsCssLoaded } from '../../../utils/loadGanttIconsCss';
import { formatDateTime } from '../../../utils/format';

export interface RdProjectGanttItem {
  id: number;
  project_code?: string;
  project_name?: string;
  status?: string;
  status_label?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  progress?: number;
  current_gate_name?: string;
  owner_name?: string;
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

function buildGanttScales(t: TFunction) {
  return [
    { unit: 'month' as const, step: 1, format: t('app.kuaiplm.gantt.scale.month') },
    { unit: 'week' as const, step: 1, format: t('app.kuaiplm.gantt.scale.week') },
    { unit: 'day' as const, step: 1, format: '%d' },
  ];
}

function toGanttTask(t: TFunction, item: RdProjectGanttItem, index: number): GanttTask {
  const startStr = item.planned_start_date || formatDateTime(dayjs(), 'YYYY-MM-DD');
  const endStr = item.planned_end_date || formatDateTime(dayjs(startStr).add(90, 'day'), 'YYYY-MM-DD');
  const start = dayjs(startStr).toDate();
  let end = dayjs(endStr).toDate();
  if (end.getTime() <= start.getTime()) {
    end = dayjs(startStr).add(7, 'day').toDate();
  }
  const durationMs = end.getTime() - start.getTime();
  const duration = Math.max(1, Math.ceil(durationMs / (24 * 60 * 60 * 1000)));
  const gateHint = item.current_gate_name ? ` · ${item.current_gate_name}` : '';
  const text =
    [item.project_code, item.project_name].filter(Boolean).join(' - ') + gateHint ||
    `${t('app.kuaiplm.common.columns.project')} ${index + 1}`;
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

interface RdProjectGanttChartProps {
  items: RdProjectGanttItem[];
}

const RdProjectGanttChart: React.FC<RdProjectGanttChartProps> = ({ items }) => {
  const { t } = useTranslation();

  useEffect(() => {
    ensureGanttIconsCssLoaded();
  }, []);

  const tasks = useMemo(() => items.map((item, index) => toGanttTask(t, item, index)), [items, t]);

  const scales = useMemo(() => buildGanttScales(t), [t]);

  const columns = useMemo(
    () => [
      { id: 'text', header: t('app.kuaiplm.gantt.columns.projectGate'), width: 260 },
      { id: 'start', header: t('app.kuaiplm.gantt.columns.plannedStart'), width: 100 },
      { id: 'end', header: t('app.kuaiplm.gantt.columns.plannedEnd'), width: 100 },
      { id: 'duration', header: t('app.kuaiplm.gantt.columns.durationDays'), width: 80 },
      { id: 'progress', header: t('app.kuaiplm.gantt.columns.progressPercent'), width: 72 },
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
    return <Empty description={t('app.kuaiplm.gantt.empty')} />;
  }

  return (
    <div className="gantt-chart-wrapper" style={{ ['--gantt-max-height' as string]: '520px' }}>
      <Willow>
        <Gantt
          tasks={tasks}
          links={[]}
          scales={scales}
          start={start}
          end={end}
          zoom
          readonly
          columns={columns}
        />
      </Willow>
    </div>
  );
};

export default RdProjectGanttChart;
