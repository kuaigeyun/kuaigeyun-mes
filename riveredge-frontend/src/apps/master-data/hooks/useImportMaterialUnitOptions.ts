import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  importDropdownLabelsFromCodeLabelMap,
  parseImportCodedCell,
  type ImportCodeLabelMap,
} from '../../../utils/loadImportDictionaryValues';
import { materialUnitApi } from '../services/material-unit';

/**
 * 导入列单位下拉：展示名称；确认时 parse 还原存库 code。
 * 替代字典 MATERIAL_UNIT。
 */
export function useImportMaterialUnitOptions(enabled = true) {
  const query = useQuery({
    queryKey: ['master-data', 'material-units', 'import-options'],
    queryFn: async () => {
      const res = await materialUnitApi.list({ skip: 0, limit: 500, is_active: true });
      return res.items;
    },
    enabled,
    staleTime: 60_000,
  });

  const labelByCode = useMemo(() => {
    const map: ImportCodeLabelMap = {};
    for (const u of query.data ?? []) {
      const code = String(u.code ?? '').trim();
      if (!code) continue;
      map[code] = String(u.name ?? '').trim() || code;
    }
    return map;
  }, [query.data]);

  const options = useMemo(
    () => importDropdownLabelsFromCodeLabelMap(labelByCode),
    [labelByCode],
  );

  const parse = useMemo(
    () => (raw?: string | null) => parseImportCodedCell(raw, labelByCode),
    [labelByCode],
  );

  return {
    ...query,
    options,
    labelByCode,
    parse,
  };
}
