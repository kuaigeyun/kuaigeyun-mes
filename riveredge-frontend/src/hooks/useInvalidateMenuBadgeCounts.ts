import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/** 与 BasicLayout `getMenuBadgeCounts` 的 queryKey 一致 */
export const MENU_BADGE_COUNTS_QUERY_KEY = ['menuBadgeCounts'] as const;

/** 业务单据变更后刷新侧栏菜单徽标（与销售订单列表用法一致） */
export function useInvalidateMenuBadgeCounts(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: MENU_BADGE_COUNTS_QUERY_KEY });
  }, [queryClient]);
}
