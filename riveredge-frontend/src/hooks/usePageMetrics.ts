/**
 * 按页面路径获取指标卡
 *
 * 调用 GET /core/datasets/metrics/by-page，返回与 ListPageTemplate 兼容的 statCards。
 * 无配置时返回 null，保持与现有 getXxxStatistics 的兼容。
 */

import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { getPageMetrics, type StatCardItem } from '../services/dataset';
import type { StatCard } from '../components/layout-templates/ListPageTemplate';

function mapToStatCard(item: StatCardItem): StatCard {
  return {
    key: item.key,
    title: item.title,
    value: item.value ?? 0,
    suffix: item.suffix,
    valueStyle: item.color ? { color: item.color } : undefined,
    precision: item.precision,
  };
}

export interface UsePageMetricsResult {
  statCards: StatCard[];
  loading: boolean;
  error: Error | null;
  hasConfig: boolean;
}

/**
 * 按当前页面路径获取指标卡
 *
 * @param pagePath - 可选，默认使用 location.pathname
 * @returns 有配置时返回 { statCards, loading, error, hasConfig }，无配置时 statCards 为空、hasConfig 为 false
 */
export function usePageMetrics(pagePath?: string): UsePageMetricsResult {
  const location = useLocation();
  const path = pagePath ?? location.pathname;

  const { data, isLoading, error } = useQuery({
    queryKey: ['pageMetrics', path],
    queryFn: () => getPageMetrics(path),
    staleTime: 30_000,
  });

  const hasConfig = !!(data?.dataset_code || (data?.stat_cards && data.stat_cards.length > 0));
  const statCards = (data?.stat_cards ?? []).map(mapToStatCard);

  return {
    statCards,
    loading: isLoading,
    error: error as Error | null,
    hasConfig,
  };
}
