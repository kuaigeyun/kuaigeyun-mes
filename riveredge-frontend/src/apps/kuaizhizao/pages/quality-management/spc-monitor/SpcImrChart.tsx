import React, { useMemo } from 'react';
import { Line } from '@ant-design/charts';

export interface SpcImrChartPoint {
  sample_value: number;
  out_of_control?: boolean;
}

export interface SpcImrChartProps {
  points: SpcImrChartPoint[];
  mean: number;
  ucl: number;
  lcl: number;
  height?: number;
}

function buildYDomain(values: number[], mean: number, ucl: number, lcl: number): [number, number] {
  const dataMin = values.length ? Math.min(...values) : 0;
  const dataMax = values.length ? Math.max(...values) : 0;
  const yMin = Math.min(dataMin, lcl, mean);
  const yMax = Math.max(dataMax, ucl, mean);
  const span = yMax - yMin;
  const pad = span > 0 ? span * 0.15 : Math.max(Math.abs(yMax) * 0.15, 1);
  return [yMin - pad, yMax + pad];
}

const SpcImrChart: React.FC<SpcImrChartProps> = ({ points, mean, ucl, lcl, height = 420 }) => {
  const config = useMemo(() => {
    const data = points.map((p, idx) => ({
      index: idx + 1,
      value: Number(p.sample_value),
    }));
    const values = data.map((d) => d.value);
    const [yMin, yMax] = buildYDomain(values, mean, ucl, lcl);

    return {
      data: data.length ? data : [{ index: 0, value: 0 }],
      xField: 'index',
      yField: 'value',
      autoFit: true,
      height,
      smooth: true,
      animation: false,
      padding: 'auto' as const,
      color: '#1677ff',
      point: { size: 4, shape: 'circle' as const },
      scale: {
        y: { domain: [yMin, yMax], nice: true },
      },
    };
  }, [points, mean, ucl, lcl, height]);

  return (
    <div style={{ width: '100%', minWidth: 0, height }}>
      <Line {...config} />
    </div>
  );
};

export default SpcImrChart;
