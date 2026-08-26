import { useMemo } from 'react';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import {
  getBusinessConfig,
  resolveNumericPrecisionFromConfig,
  type BusinessConfig,
  type NumericPrecisionKind,
  type NumericPrecisionSettings,
} from '../services/businessConfig';
import { queryClient } from '../queryClient';

export const NUMERIC_PRECISION_QUERY_KEY = ['businessConfigNumericPrecision'] as const;

const DEFAULT_PRECISION: NumericPrecisionSettings = {
  quantity: 2,
  price: 2,
  amount: 2,
};

const NUMERIC_PRECISION_QUERY_OPTIONS = {
  queryKey: NUMERIC_PRECISION_QUERY_KEY,
  queryFn: getBusinessConfig,
  staleTime: 5 * 60 * 1000,
} as const;

function resolveNumericPrecisionSettings(
  config: BusinessConfig | null | undefined,
): NumericPrecisionSettings {
  if (!config) return DEFAULT_PRECISION;
  return {
    quantity: resolveNumericPrecisionFromConfig(config, 'quantity'),
    price: resolveNumericPrecisionFromConfig(config, 'price'),
    amount: resolveNumericPrecisionFromConfig(config, 'amount'),
  };
}

/** 从 React Query 缓存同步读取数值精度（供 formatQuantity 等非 Hook 场景） */
export function getCachedNumericPrecision(): NumericPrecisionSettings {
  const data = queryClient.getQueryData<BusinessConfig>(NUMERIC_PRECISION_QUERY_KEY);
  return resolveNumericPrecisionSettings(data);
}

export function getCachedNumericPrecisionPlaces(kind: NumericPrecisionKind): number {
  return getCachedNumericPrecision()[kind];
}

/** 登录后预取业务配置数值精度，避免首屏 InputNumber / formatQuantity 仍用默认 2 位 */
export function prefetchNumericPrecision(client: QueryClient = queryClient) {
  return client.prefetchQuery(NUMERIC_PRECISION_QUERY_OPTIONS);
}

/** 读取业务配置中的数量/单价/金额小数位（默认均为 2） */
export function useNumericPrecisionQuery() {
  return useQuery(NUMERIC_PRECISION_QUERY_OPTIONS);
}

export function useNumericPrecision(): NumericPrecisionSettings {
  const { data } = useNumericPrecisionQuery();
  return useMemo(() => resolveNumericPrecisionSettings(data), [data]);
}

export function useNumericPrecisionPlaces(kind: NumericPrecisionKind): number {
  const settings = useNumericPrecision();
  return settings[kind];
}
