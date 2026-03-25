import React, { useMemo } from 'react';
import { Tiny } from '@ant-design/charts';

export interface SimpleSparklineProps {
  data: number[];
  type?: 'area' | 'line' | 'column';
  color?: string;
  height?: number;
}

/** 用序列化结果做依赖，避免父组件每次 render 传入新数组引用时反复触发图表 update/render（会导致 G2 interval 报错） */
function useStableNumericSeries(data: unknown): number[] {
  const key = JSON.stringify(Array.isArray(data) ? data : []);
  return useMemo(() => {
    let raw: unknown[] = [];
    try {
      raw = JSON.parse(key) as unknown[];
      if (!Array.isArray(raw)) raw = [];
    } catch {
      raw = [];
    }
    return raw
      .map((d) => Number(d))
      .filter((n) => Number.isFinite(n));
  }, [key]);
}

export const SimpleSparkline: React.FC<SimpleSparklineProps> = ({
  data,
  type = 'area',
  color = '#1890ff',
  height = 60,
}) => {
  const safeData = useStableNumericSeries(data);

  const baseConfig = useMemo(
    () => ({
      height,
      autoFit: true,
      data: safeData,
      smooth: true,
      padding: 0,
      axis: false,
      tooltip: false,
      // 关闭动画，减少异步渲染与快速 update 叠加时的未处理 Promise / 中间态错误
      animation: false,
    }),
    [height, safeData],
  );

  const areaProps = useMemo(
    () => ({
      ...baseConfig,
      style: {
        fill: `l(90) 0:${color} 1:rgba(255,255,255,0)`,
        fillOpacity: 1,
        stroke: 'none',
      },
      line: {
        style: {
          stroke: color,
          lineWidth: 2,
        },
      },
    }),
    [baseConfig, color],
  );

  const columnProps = useMemo(
    () => ({
      ...baseConfig,
      style: { fill: color },
    }),
    [baseConfig, color],
  );

  const lineProps = useMemo(
    () => ({
      ...baseConfig,
      style: {
        stroke: color,
        lineWidth: 2,
      },
    }),
    [baseConfig, color],
  );

  if (safeData.length === 0) return null;

  if (type === 'area') {
    return <Tiny.Area {...areaProps} />;
  }
  if (type === 'column') {
    return <Tiny.Column {...columnProps} />;
  }
  return <Tiny.Line {...lineProps} />;
};
