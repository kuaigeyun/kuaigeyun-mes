import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getBusinessConfig,
  resolveNumericPrecisionFromConfig,
  type NumericPrecisionKind,
  type NumericPrecisionSettings,
} from '../services/businessConfig';

export const NUMERIC_PRECISION_QUERY_KEY = ['businessConfigNumericPrecision'] as const;

const DEFAULT_PRECISION: NumericPrecisionSettings = {
  quantity: 2,
  price: 2,
  amount: 2,
};

/** 读取业务配置中的数量/单价/金额小数位（默认均为 2） */
export function useNumericPrecisionQuery() {
  return useQuery({
    queryKey: NUMERIC_PRECISION_QUERY_KEY,
    queryFn: getBusinessConfig,
    staleTime: 5 * 60 * 1000,
  });
}

export function useNumericPrecision(): NumericPrecisionSettings {
  const { data } = useNumericPrecisionQuery();
  return useMemo(() => {
    if (!data) return DEFAULT_PRECISION;
    return {
      quantity: resolveNumericPrecisionFromConfig(data, 'quantity'),
      price: resolveNumericPrecisionFromConfig(data, 'price'),
      amount: resolveNumericPrecisionFromConfig(data, 'amount'),
    };
  }, [data]);
}

export function useNumericPrecisionPlaces(kind: NumericPrecisionKind): number {
  const settings = useNumericPrecision();
  return settings[kind];
}
