import React from 'react';
import { formatQuantityWithUnit } from '../../utils/materialUnitDisplay';

export interface QuantityWithUnitDisplayProps {
  quantity: unknown;
  unit?: unknown;
  /** @deprecated 忽略；单位字段本身即名称 */
  unitLabelMap?: Record<string, string>;
  className?: string;
  style?: React.CSSProperties;
}

/** 只读展示：数量 + 单位名称（业务字段直出，禁止对照表） */
export const QuantityWithUnitDisplay: React.FC<QuantityWithUnitDisplayProps> = ({
  quantity,
  unit,
  className,
  style,
}) => {
  return (
    <span className={className} style={style}>
      {formatQuantityWithUnit(quantity, unit)}
    </span>
  );
};
