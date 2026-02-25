/**
 * 销售订单甘特图
 * 基于 @svar-ui/react-gantt 展示销售明细的交货时间轴
 */

import React, { useMemo } from 'react';
import { Gantt, Willow } from '@svar-ui/react-gantt';
import '@svar-ui/react-gantt/all.css';
import './gantt-scrollbar.less';
import dayjs from 'dayjs';

export interface SalesOrderItemForGantt {
  _rowKey: string;
  sales_order_id: number;
  order_code?: string;
  customer_name?: string;
  material_code?: string;
  material_name?: string;
  required_quantity?: number;
  order_date?: string;
  delivery_date?: string;
  order_delivery_date?: string;
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

function toGanttTask(item: SalesOrderItemForGantt, index: number): GanttTask {
  const startStr = item.order_date || item.order_delivery_date || dayjs().format('YYYY-MM-DD');
  const endStr = item.delivery_date || item.order_delivery_date || startStr;
  const start = dayjs(startStr).toDate();
  let end = dayjs(endStr).toDate();
  if (end.getTime() <= start.getTime()) {
    end = dayjs(startStr).add(1, 'day').toDate();
  }
  const durationMs = end.getTime() - start.getTime();
  const duration = Math.max(1, Math.ceil(durationMs / (24 * 60 * 60 * 1000)));
  const text = [item.order_code, item.material_name].filter(Boolean).join(' - ') || `明细 ${index + 1}`;
  return {
    id: index,
    text,
    start,
    end,
    duration,
    progress: 0,
    type: 'task',
    lazy: false,
  };
}

const SCALES = [
  { unit: 'month' as const, step: 1, format: '%Y年%m月' },
  { unit: 'week' as const, step: 1, format: '第%W周' },
  { unit: 'day' as const, step: 1, format: '%d' },
];

interface SalesOrderGanttChartProps {
  items: SalesOrderItemForGantt[];
}

const SalesOrderGanttChart: React.FC<SalesOrderGanttChartProps> = ({ items }) => {
  const tasks = useMemo(() => items.map(toGanttTask), [items]);

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

  if (tasks.length === 0) {
    return <div>暂无销售明细数据</div>;
  }

  return (
    <div className="gantt-chart-wrapper">
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
            { id: 'text', header: '订单/物料', width: 220 },
            { id: 'start', header: '开始', width: 100 },
            { id: 'end', header: '结束', width: 100 },
            { id: 'duration', header: '工期(天)', width: 80 },
          ]}
        />
      </Willow>
    </div>
  );
};

export default SalesOrderGanttChart;
