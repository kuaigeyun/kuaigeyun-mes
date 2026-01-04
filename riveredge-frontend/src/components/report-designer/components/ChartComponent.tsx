/**
 * 图表组件
 *
 * 基于@ant-design/charts的报表图表组件
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React from 'react';
import { Column, Line, Pie, Scatter } from '@ant-design/charts';
import { ReportComponent } from '../index';

/**
 * 图表组件Props
 */
export interface ChartComponentProps {
  component: ReportComponent;
  data?: any[];
}

/**
 * 图表组件
 */
const ChartComponent: React.FC<ChartComponentProps> = ({ component, data = [] }) => {
  const chartType = component.chartType || 'column';
  const config = component.chartConfig || {};

  const commonConfig = {
    data,
    ...config,
  };

  switch (chartType) {
    case 'column':
      return <Column {...commonConfig} />;
    case 'line':
      return <Line {...commonConfig} />;
    case 'pie':
      return <Pie {...commonConfig} />;
    case 'scatter':
      return <Scatter {...commonConfig} />;
    default:
      return <Column {...commonConfig} />;
  }
};

export default ChartComponent;

