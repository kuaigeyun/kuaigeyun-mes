import React, { createContext, useContext, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useUserPreferenceStore } from '../../stores/userPreferenceStore';

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
  if (!map || typeof map !== 'object') return false;
  const stored = (map as Record<string, unknown>)[toListPageStatCardsPreferenceSegment(pageKey)];
  return stored === undefined ? false : Boolean(stored);
}

/**
 * 在页面组件中读取当前列表页指标卡显隐偏好（无需依赖 ListPageTemplate 内部 Context）。
 */
export function useListPageStatCardsVisible(pageKey?: string): boolean {
  const location = useLocation();
  const preferences = useUserPreferenceStore((s) => s.preferences);
  const resolvedPageKey = pageKey ?? location.pathname;
  return useMemo(
    () => getListPageStatCardsVisible(preferences, resolvedPageKey),
    [preferences, resolvedPageKey],
  );
}
