/**
 * 列表页指标卡 `backgroundChart`（与 `ListPageTemplate` 搭配使用，**勿改** layout-templates 内模板）。
 * 视觉与销售订单页内 Area 配置一致：smooth、渐变填充、描边；销售订单示范页本身保持页内实现不变。
 */
import React, { useMemo } from 'react';
import { Area } from '@ant-design/charts';

export type StatCardTrendPoint = { date: string; value: number };
export type StatCardTrendData = number[] | StatCardTrendPoint[];

/** 折线描边略透明（#RGB / #RRGGBB）；非 hex 则原样返回 */
export function strokeColorWithAlpha(color: string, alpha = 0.5): string {
  const c = color.trim();
  if (c.startsWith('rgba(') || c.startsWith('rgb(')) return c;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (!m) return c;
  let hex = m[1];
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((ch) => ch + ch)
      .join('');
  }
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function normalizeTrendData(data: StatCardTrendData): StatCardTrendPoint[] {
  if (!data?.length) return [];
  const first = data[0] as unknown;
  if (typeof first === 'number') {
    return (data as number[]).map((y, i) => ({
      date: String(i),
      value: Number.isFinite(y) ? y : 0,
    }));
  }
  return (data as StatCardTrendPoint[]).map((d, i) => ({
    date: String(d.date ?? i),
    value: Number.isFinite(Number(d.value)) ? Number(d.value) : 0,
  }));
}

export interface StatCardTrendAreaProps {
  data: StatCardTrendData;
  color?: string;
  height?: number;
}

export const StatCardTrendArea: React.FC<StatCardTrendAreaProps> = ({
  data,
  color = '#1890ff',
  height,
}) => {
  const chartData = useMemo(() => normalizeTrendData(data), [JSON.stringify(data)]);
  if (!chartData.length) return null;
  return (
    <div
      style={{
        height: height !== undefined ? height : '100%',
        width: '100%',
        minHeight: 56,
      }}
    >
      <Area
        data={chartData}
        xField="date"
        yField="value"
        padding={0}
        axis={false}
        colorField={() => color}
        shapeField="smooth"
        style={{
          fill: `linear-gradient(-90deg, transparent 0%, ${color} 100%)`,
          fillOpacity: 0.1,
          stroke: strokeColorWithAlpha(color),
          lineWidth: 1,
        }}
        autoFit
      />
    </div>
  );
};
