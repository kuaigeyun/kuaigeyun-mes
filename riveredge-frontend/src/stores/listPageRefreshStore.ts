/**
 * 列表页跨 Tab 刷新信号（如报价转销售订单后，销售订单 Tab 自动 reload）
 */

import { create } from 'zustand';

export const LIST_PAGE_REFRESH_KEYS = {
  salesOrders: 'sales-orders',
} as const;

interface ListPageRefreshState {
  versions: Record<string, number>;
  bump: (key: string) => void;
}

export const useListPageRefreshStore = create<ListPageRefreshState>((set) => ({
  versions: {},
  bump: (key: string) =>
    set((s) => ({
      versions: {
        ...s.versions,
        [key]: (s.versions[key] ?? 0) + 1,
      },
    })),
}));
