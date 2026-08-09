import React, { useEffect, useState } from 'react';

import {
  getMaterialUnitDisplayMapShared,
  resolveMaterialUnitLabel,
} from '../../utils/materialUnitDisplay';

export interface MaterialUnitLabelProps {
  value?: string | null;
  emptyText?: string;
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

  const raw = String(value ?? '').trim();
  if (!raw) return <>{emptyText}</>;
  return <>{resolveMaterialUnitLabel(raw, map) || emptyText}</>;
};

export default MaterialUnitLabel;
