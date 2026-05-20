import React, { createContext, useContext } from 'react';

export interface ListPageStatCardsContextValue {
  enabled: boolean;
  visible: boolean;
  toggle: () => void;
  /** 列表页表体 scroll.y 视口扣减（px），随指标卡显隐变化 */
  tableScrollOffsetPx: number;
}

const ListPageStatCardsContext = createContext<ListPageStatCardsContextValue | null>(null);

export function ListPageStatCardsProvider({
  value,
  children,
}: {
  value: ListPageStatCardsContextValue;
  children: React.ReactNode;
}) {
  return (
    <ListPageStatCardsContext.Provider value={value}>{children}</ListPageStatCardsContext.Provider>
  );
}

export function useListPageStatCardsContext() {
  return useContext(ListPageStatCardsContext);
}

export function toListPageStatCardsPreferenceSegment(pageKey: string): string {
  return pageKey.replace(/^\//, '').replace(/\//g, '.') || 'default';
}

export function getListPageStatCardsVisible(
  preferences: Record<string, unknown>,
  pageKey: string,
): boolean {
  const map = (preferences?.ui as Record<string, unknown> | undefined)?.list_page_stat_cards;
  if (!map || typeof map !== 'object') return true;
  const stored = (map as Record<string, unknown>)[toListPageStatCardsPreferenceSegment(pageKey)];
  return stored === undefined ? true : Boolean(stored);
}
