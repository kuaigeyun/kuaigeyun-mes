/**
 * 按页面路径获取指标卡（列表页指标「三层模式」之一）
 *
 * **标准做法（与快制造销售订单页一致）：**
 * 1. **数据集层**：`usePageMetrics()` → `GET /core/datasets/metrics/by-page`，租户在「页面指标」中配置时
 *    `hasConfig` 为 true，`stat_cards` 来自配置。
 * 2. **领域统计层**：`useQuery` + `getXxxStatistics` → 后端 `GET .../statistics` 聚合（趋势、金额等）。
 * 3. **合并**：`hasConfig` 为 true 时，用业务 `statistics` 按 `card.key` 补 `backgroundChart` / `description` / `onClick`；
 *    为 false 时完全用 `statistics` 构建卡片；无数据时回退占位零值。
 * 4. **失效**：变更单据后 `invalidateQueries` 同时失效 `['xxxStatistics']` 与 `['pageMetrics', pathname]`。
 *
 * 本 Hook 只负责第 1 层；无配置时 `statCards` 为空、`hasConfig` 为 false，由页面与统计 API 组合展示。
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
    /** 与全局 5min 策略一致：返回列表页时多用缓存，减少首屏二次等待 */
    staleTime: 5 * 60 * 1000,
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
