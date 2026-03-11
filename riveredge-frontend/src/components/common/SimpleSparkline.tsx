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
  if (!data || data.length === 0) return null;

  const config: any = {
    height,
    autoFit: true,
    data,
    smooth: true,
    color,
    padding: 0, // Force chart to edges
    line: {
      style: {
        lineWidth: 2,
      },
    },
    animation: {
      appear: {
        animation: 'path-in',
        duration: 1000,
      },
    },
  };

  if (type === 'area') {
    return <Tiny.Area {...config} areaStyle={{ fill: `l(270) 0:#ffffff 1:${color}` }} />;
  }

  if (type === 'column') {
    return <Tiny.Column {...config} />;
  }

  return <Tiny.Line {...config} />;
};
