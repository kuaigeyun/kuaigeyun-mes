import React from 'react';
import { StatCardTrendArea } from './StatCardTrendArea';

export interface SimpleSparklineProps {
  data: number[];
  /** @deprecated 指标卡已统一为与销售订单一致的光滑面积折线，柱状不再使用 */
  type?: 'area' | 'line' | 'column';
  color?: string;
  height?: number;
}

/**
 * 指标卡迷你趋势图（底层已统一为 {@link StatCardTrendArea}，与销售订单一致）
 */
export const SimpleSparkline: React.FC<SimpleSparklineProps> = ({ data, color, height }) => {
  return <StatCardTrendArea data={data} color={color} height={height} />;
};
