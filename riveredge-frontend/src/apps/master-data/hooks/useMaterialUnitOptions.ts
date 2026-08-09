import { useQuery } from '@tanstack/react-query';
import { materialUnitApi } from '../services/material-unit';

/** 启用单位选项（物料表单 / 单据单位下拉唯一来源） */
export function useMaterialUnitOptions(enabled = true) {
  const query = useQuery({
    queryKey: ['master-data', 'material-units', 'active'],
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

  return {
    ...query,
    options,
  };
}
