import { useQuery, type QueryClient } from '@tanstack/react-query';
import { materialUnitApi } from '../services/material-unit';

/** 启用单位选项（物料表单 / 单据单位下拉唯一来源） */
export const MATERIAL_UNIT_OPTIONS_QUERY_KEY = ['master-data', 'material-units', 'active'] as const;

export function invalidateMaterialUnitOptionsQuery(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [...MATERIAL_UNIT_OPTIONS_QUERY_KEY] });
}

export function useMaterialUnitOptions(enabled = true) {
  const query = useQuery({
    queryKey: [...MATERIAL_UNIT_OPTIONS_QUERY_KEY],
    queryFn: async () => {
      const res = await materialUnitApi.list({ skip: 0, limit: 500, is_active: true });
      return res.items;
    },
    enabled,
    staleTime: 60_000,
  });

  const options = (query.data ?? []).map((u) => ({
    label: u.name || u.code,
    value: u.code,
  }));

  const valueToLabel = (query.data ?? []).reduce<Record<string, string>>((acc, u) => {
    acc[u.code] = u.name || u.code;
    return acc;
  }, {});

  return {
    ...query,
    options,
    valueToLabel,
  };
}
