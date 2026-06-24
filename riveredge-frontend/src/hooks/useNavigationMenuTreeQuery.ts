/**
 * 导航菜单树（/core/menus/navigation-tree）统一查询 Hook。
 *
 * 侧边栏、工作台快捷入口、面包屑解析、各管理页等都消费同一份导航树。
 * 必须使用同一 queryKey，否则 React Query 视为不同 query，会在同一页面重复
 * 拉取 navigation-tree（侧栏一次、工作台又一次）。此处集中规范 queryKey 与
 * 查询参数，所有消费方复用，确保 staleTime 内命中同一缓存、只发一次请求。
 *
 * 失效仍可用前缀 [NAVIGATION_MENU_TREE_QUERY_KEY] 匹配（React Query 默认前缀匹配）。
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useGlobalStore } from '../stores';
import { getNavigationMenuTree, type MenuTree } from '../services/menu';
import type { CurrentUser } from '../types/api';

/** 与 clearSessionQueries / 各失效点共用，避免侧栏与工作台菜单缓存不一致 */
export const NAVIGATION_MENU_TREE_QUERY_KEY = 'navigationMenuTree';

/** 规范的导航树 queryKey：随租户与权限版本变化失效 */
export function buildNavigationMenuTreeQueryKey(
  user?: Pick<CurrentUser, 'tenant_id' | 'permission_version'> | null,
) {
  return [
    NAVIGATION_MENU_TREE_QUERY_KEY,
    user?.tenant_id ?? null,
    user?.permission_version ?? 0,
  ] as const;
}

export interface UseNavigationMenuTreeQueryOptions {
  /** 额外的启用条件（与「已登录」做与运算） */
  enabled?: boolean;
}

/**
 * 统一的导航菜单树查询。所有消费方都应使用本 Hook（而非各自手写 useQuery），
 * 以共用同一 queryKey 与缓存，消除重复请求。
 */
export function useNavigationMenuTreeQuery(
  options: UseNavigationMenuTreeQueryOptions = {},
) {
  const { enabled = true } = options;
  const currentUser = useGlobalStore((s) => s.currentUser);

  const queryKey = useMemo(
    () => buildNavigationMenuTreeQueryKey(currentUser),
    [currentUser?.tenant_id, currentUser?.permission_version],
  );

  return useQuery<MenuTree[]>({
    queryKey,
    queryFn: () => getNavigationMenuTree(),
    enabled: !!currentUser && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    // 菜单由后台同步/配置中心变更后，当前会话需要在回到窗口时及时拉取新树，避免长时间停留旧缓存。
    refetchOnWindowFocus: true,
  });
}
