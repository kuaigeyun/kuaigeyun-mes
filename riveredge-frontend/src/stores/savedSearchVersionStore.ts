/**
 * 保存搜索条件排序版本 Store
 *
 * 用于通知 riveredge-query 在拖拽排序后刷新钉住条件列表，
 * 替代 CustomEvent savedSearchOrderChanged
 */

import { create } from 'zustand';

interface SavedSearchVersionState {
  versions: Record<string, number>;
  incrementVersion: (pagePath: string) => void;
}

export const useSavedSearchVersionStore = create<SavedSearchVersionState>((set) => ({
  versions: {},
  incrementVersion: (pagePath: string) =>
    set((s) => ({
      versions: {
        ...s.versions,
        [pagePath]: (s.versions[pagePath] ?? 0) + 1,
      },
    })),
}));
