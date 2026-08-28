import React, { useEffect, useState } from 'react';

import {
  getMaterialUnitDisplayMapShared,
  resolveMaterialUnitLabel,
} from '../../utils/materialUnitDisplay';

export interface MaterialUnitLabelProps {
  value?: string | null;
  emptyText?: string;
}

function coerceUnitRaw(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  // ProTable 误把已渲染 dom 传入时勿 String(ReactNode) → [object Object]
  return '';
}

/** 单位 code → 主数据名称（替代 DictionaryLabel MATERIAL_UNIT） */
export const MaterialUnitLabel: React.FC<MaterialUnitLabelProps> = ({
  value,
  emptyText = '-',
}) => {
  const [map, setMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    getMaterialUnitDisplayMapShared()
      .then((m) => {
        if (!cancelled) setMap(m);
      })
      .catch(() => {
        if (!cancelled) setMap({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const raw = coerceUnitRaw(value);
  if (!raw) return <>{emptyText}</>;
  return <>{resolveMaterialUnitLabel(raw, map) || emptyText}</>;
};

export default MaterialUnitLabel;
