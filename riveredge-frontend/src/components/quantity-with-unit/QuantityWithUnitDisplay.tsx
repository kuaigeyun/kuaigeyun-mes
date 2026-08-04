import React, { useEffect, useState } from 'react';
import {
  formatQuantityWithUnit,
  getMaterialUnitDisplayMapShared,
} from '../../utils/materialUnitDisplay';

export interface QuantityWithUnitDisplayProps {
  quantity: unknown;
  unit?: unknown;
  /** 已有字典映射时可传入，避免重复请求 */
  unitLabelMap?: Record<string, string>;
  className?: string;
  style?: React.CSSProperties;
}

/** 只读展示：数量 + 单位（字典标签优先） */
export const QuantityWithUnitDisplay: React.FC<QuantityWithUnitDisplayProps> = ({
  quantity,
  unit,
  unitLabelMap: unitLabelMapProp,
  className,
  style,
}) => {
  const [unitLabelMap, setUnitLabelMap] = useState<Record<string, string>>(
    unitLabelMapProp ?? {},
  );

  useEffect(() => {
    if (unitLabelMapProp) {
      setUnitLabelMap(unitLabelMapProp);
      return;
    }
    let cancelled = false;
    getMaterialUnitDisplayMapShared().then((map) => {
      if (!cancelled) setUnitLabelMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, [unitLabelMapProp]);

  return (
    <span className={className} style={style}>
      {formatQuantityWithUnit(quantity, unit, unitLabelMap)}
    </span>
  );
};
