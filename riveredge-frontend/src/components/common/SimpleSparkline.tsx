import React from 'react';
import { Tiny } from '@ant-design/charts';

export interface SimpleSparklineProps {
  data: number[];
  type?: 'area' | 'line' | 'column';
  color?: string;
  height?: number;
}

export const SimpleSparkline: React.FC<SimpleSparklineProps> = ({ 
  data, 
  type = 'area', 
  color = '#1890ff',
  height = 60
}) => {
  const safeData = Array.isArray(data) ? data : [];
  if (safeData.length === 0) return null;

  const baseConfig: any = {
    height,
    autoFit: true,
    data: safeData,
    smooth: true,
    padding: 0,
    axis: false,
    tooltip: false,
    animation: {
      appear: {
        animation: 'path-in',
        duration: 1000,
      },
    },
  };

  if (type === 'area') {
    // @ant-design/charts v2 API：用 style 控制面积填充，stroke: 'none' 消除闭合路径的竖线
    // line 单独控制顶部曲线
    return (
      <Tiny.Area
        {...baseConfig}
        style={{
          fill: `l(90) 0:${color} 1:rgba(255,255,255,0)`,
          fillOpacity: 1,
          stroke: 'none',  // 关键：去掉面积闭合路径的描边（含左右竖线）
        }}
        line={{
          style: {
            stroke: color,
            lineWidth: 2,
          },
        }}
      />
    );
  }

  if (type === 'column') {
    return (
      <Tiny.Column
        {...baseConfig}
        style={{ fill: color }}
      />
    );
  }

  return (
    <Tiny.Line
      {...baseConfig}
      style={{
        stroke: color,
        lineWidth: 2,
      }}
    />
  );
};
