import { useQuery } from '@tanstack/react-query';
import { getBusinessConfig, isTrialRunModeEnabled } from '../services/businessConfig';

export const TRIAL_RUN_MODE_QUERY_KEY = ['businessConfigTrialRunMode'] as const;

/** 读取业务配置（试运营模式等通用参数） */
export function useTrialRunModeQuery() {
  return useQuery({
    queryKey: TRIAL_RUN_MODE_QUERY_KEY,
    queryFn: getBusinessConfig,
    staleTime: 5 * 60 * 1000,
  });
}

/** 是否开启试运营模式；未加载完成时默认 false（隐藏试运营专属入口） */
export function useTrialRunMode(defaultValue = false): boolean {
  const { data } = useTrialRunModeQuery();
  if (data === undefined) return defaultValue;
  return isTrialRunModeEnabled(data);
}
