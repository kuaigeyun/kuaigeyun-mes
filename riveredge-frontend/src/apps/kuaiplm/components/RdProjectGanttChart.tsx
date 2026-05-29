/**
 * 研发项目进度甘特图
 */

import React, { useEffect, useMemo } from 'react';
import { Empty } from 'antd';
import { Gantt, Willow } from '@svar-ui/react-gantt';
import '@svar-ui/react-gantt/all.css';
import '../../kuaizhizao/components/gantt-scrollbar.less';
import dayjs from 'dayjs';
import { ensureGanttIconsCssLoaded } from '../../../utils/loadGanttIconsCss';

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

const SCALES = [
  { unit: 'month' as const, step: 1, format: '%Y年%m月' },
  { unit: 'week' as const, step: 1, format: '第%W周' },
  { unit: 'day' as const, step: 1, format: '%d' },
];

function toGanttTask(item: RdProjectGanttItem, index: number): GanttTask {
  const startStr = item.planned_start_date || dayjs().format('YYYY-MM-DD');
  const endStr = item.planned_end_date || dayjs(startStr).add(90, 'day').format('YYYY-MM-DD');
  const start = dayjs(startStr).toDate();
  let end = dayjs(endStr).toDate();
  if (end.getTime() <= start.getTime()) {
    end = dayjs(startStr).add(7, 'day').toDate();
  }
  const durationMs = end.getTime() - start.getTime();
  const duration = Math.max(1, Math.ceil(durationMs / (24 * 60 * 60 * 1000)));
  const gateHint = item.current_gate_name ? ` · ${item.current_gate_name}` : '';
  const text =
    [item.project_code, item.project_name].filter(Boolean).join(' - ') + gateHint || `项目 ${index + 1}`;
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
  useEffect(() => {
    ensureGanttIconsCssLoaded();
  }, []);

  const tasks = useMemo(() => items.map(toGanttTask), [items]);

  const { start, end } = useMemo(() => {
    if (tasks.length === 0) {
      const t = dayjs();
      return {
        start: t.subtract(14, 'day').toDate(),
        end: t.add(120, 'day').toDate(),
      };
    }
    const dates = tasks.flatMap((t) => [t.start.getTime(), t.end.getTime()]);
    const min = Math.min(...dates);
    const max = Math.max(...dates);
    return {
      start: new Date(min - 14 * 24 * 60 * 60 * 1000),
      end: new Date(max + 21 * 24 * 60 * 60 * 1000),
    };
  }, [tasks]);

  if (tasks.length === 0) {
    return <Empty description="暂无在研项目，创建项目后将在此展示 NPI 进度时间轴" />;
  }

  return (
    <div className="gantt-chart-wrapper" style={{ ['--gantt-max-height' as string]: '520px' }}>
      <Willow>
        <Gantt
          tasks={tasks}
          links={[]}
          scales={SCALES}
          start={start}
          end={end}
          zoom
          readonly
          columns={[
            { id: 'text', header: '项目 / 阶段门', width: 260 },
            { id: 'start', header: '计划开始', width: 100 },
            { id: 'end', header: '计划完成', width: 100 },
            { id: 'duration', header: '工期(天)', width: 80 },
            { id: 'progress', header: '进度%', width: 72 },
          ]}
        />
      </Willow>
    </div>
  );
};

export default RdProjectGanttChart;
