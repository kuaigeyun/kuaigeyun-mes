import { useQuery, type QueryClient } from '@tanstack/react-query';
import { materialUnitApi } from '../services/material-unit';

/** 启用单位选项（物料表单 / 单据单位下拉唯一来源；value=名称） */
export const MATERIAL_UNIT_OPTIONS_QUERY_KEY = ['master-data', 'material-units', 'active'] as const;

export function invalidateMaterialUnitOptionsQuery(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [...MATERIAL_UNIT_OPTIONS_QUERY_KEY] });
}

/**
 * 单位下拉唯一契约：value / label 均为单位名称。
 * 业务字段存名称；禁止 value=code 再在展示侧翻译。
 */
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

  const options = (query.data ?? []).map((u) => {
    const name = String(u.name || u.code || '').trim();
    return {
      label: name,
      value: name,
    };
  });

  return {
    ...query,
    options,
  };
}
