import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { LIST_PAGE_REFRESH_KEYS, useListPageRefreshStore } from '../stores/listPageRefreshStore';

/** 与销售订单 UniTable columnPersistenceId 一致 */
export const SALES_ORDER_UNI_TABLE_QUERY_KEY = [
  'uniTable',
  'apps.kuaizhizao.pages.sales-management.sales-orders',
] as const;

export const SALES_ORDER_STATISTICS_QUERY_KEY = ['salesOrderStatistics'] as const;

/** 销售订单列表/统计变更后：清 TanStack 缓存并通知销售订单 Tab 刷新 */
export function useInvalidateSalesOrderList(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.removeQueries({
      queryKey: [...SALES_ORDER_UNI_TABLE_QUERY_KEY],
      exact: false,
    });
    void queryClient.invalidateQueries({
      queryKey: SALES_ORDER_STATISTICS_QUERY_KEY,
      exact: false,
    });
    useListPageRefreshStore.getState().bump(LIST_PAGE_REFRESH_KEYS.salesOrders);
  }, [queryClient]);
}
