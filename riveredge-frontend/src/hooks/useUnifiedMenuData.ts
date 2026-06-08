/**
 * 统一菜单数据 Hook
 *
 * 平台级/系统级：使用原有 getMenuConfig 硬编号
 * 应用级 APP：GET /core/menus/navigation-tree（顺序由后端 manifest 决定）→ 权限过滤 → 输出。
 * 禁止在此对应用菜单按 sort_order 重排（见 .cursor/rules/no-fallback-patches.mdc）。
 *
 * 菜单显示层级（蓝图设置已下线）：
 * 1. 菜单管理：navigation-tree（任意登录用户可读），未入库或禁用则不返回（= 功能关闭）
 * 2. 权限管理：filterMenuItemsByPermission，用户无权限则隐藏
 *
 * 使用场景：BasicLayout（侧边栏、UniTabs、面包屑、页面标题）、Dashboard 快捷入口等
 */

import { useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { MenuDataItem } from '@ant-design/pro-components';
import { getNavigationMenuTree, type MenuTree } from '../services/menu';
import { refreshCurrentUserInStore } from '../services/auth';
import { extractAppCodeFromPath, getAppDisplayName } from '../utils/menuTranslation';
import { useGlobalStore } from '../stores';
import { useConfigStore } from '../stores/configStore';
import { filterMenuItemsByPermission, resolveUserForMenuPermission, isAppGroupTitleItem } from '../utils/permission';
import { isInfraSuperAdminUser, hasPlatformAdministrativeAuthority } from '../utils/auth';

/** 与 Dashboard / clearSessionQueries 共用，避免侧栏与工作台菜单缓存不一致 */
export const NAVIGATION_MENU_TREE_QUERY_KEY = 'navigationMenuTree';

function treeHasAppPath(nodes: MenuTree[]): boolean {
  for (const n of nodes) {
    if (n.path?.startsWith('/apps/')) return true;
    if (n.children?.length && treeHasAppPath(n.children)) return true;
  }
  return false;
}

function collectApplicationRoots(tree: MenuTree[]): MenuTree[] {
  const byUuid = tree.filter((m) => m.application_uuid);
  if (byUuid.length) return byUuid;
  // 兼容：部分租户菜单根未写入 application_uuid，但 path 在 /apps/ 下
  return tree.filter(
    (m) => m.path?.startsWith('/apps/') || treeHasAppPath(m.children ?? []),
  );
}

/** 上线向导关闭时从侧栏/面包屑隐藏的菜单路径（与站点设置 enable_launch_wizard 联动） */
const LAUNCH_WIZARD_MENU_PATHS = new Set(['/system/onboarding-wizard', '/system/launch-progress']);

/** 系统级仪表盘（工作台 / 运营看板）路径前缀，与站点设置 enable_system_dashboard 联动 */
const SYSTEM_DASHBOARD_PATH_PREFIX = '/system/dashboard';

function filterOutLaunchWizardMenus(items: MenuDataItem[]): MenuDataItem[] {
  const walk = (nodes: MenuDataItem[]): MenuDataItem[] =>
    nodes
      .map((node) => {
        const p = node.path;
        if (p && LAUNCH_WIZARD_MENU_PATHS.has(p)) return null;
        const rawChildren = node.children as MenuDataItem[] | undefined;
        const ch = rawChildren?.length ? walk(rawChildren) : undefined;
        if (ch) {
          if (ch.length === 0 && !p) return null;
          return { ...node, children: ch };
        }
        return node;
      })
      .filter((m): m is MenuDataItem => m !== null);
  return walk(items);
}

function filterOutSystemDashboardMenus(items: MenuDataItem[]): MenuDataItem[] {
  const walk = (nodes: MenuDataItem[]): MenuDataItem[] =>
    nodes
      .map((node) => {
        const p = node.path;
        if (p === SYSTEM_DASHBOARD_PATH_PREFIX || p?.startsWith(`${SYSTEM_DASHBOARD_PATH_PREFIX}/`)) {
          return null;
        }
        const rawChildren = node.children as MenuDataItem[] | undefined;
        const ch = rawChildren?.length ? walk(rawChildren) : undefined;
        if (ch) {
          if (ch.length === 0 && !p) return null;
          return { ...node, children: ch };
        }
        return node;
      })
      .filter((m): m is MenuDataItem => m !== null);
  return walk(items);
}

function reconcileAppGroupTitles(items: MenuDataItem[]): MenuDataItem[] {
  const result: MenuDataItem[] = [];
  let pendingGroup: MenuDataItem | null = null;

  const isAppMenuSibling = (item: MenuDataItem) =>
    Boolean(item.className?.includes('app-menu-item') || item.path?.startsWith('/apps/'));

  for (const item of items) {
    if (isAppGroupTitleItem(item)) {
      pendingGroup = item;
      continue;
    }
    if (pendingGroup) {
      if (isAppMenuSibling(item) && !item.hideInMenu) {
        result.push(pendingGroup);
        pendingGroup = null;
      } else if (!isAppMenuSibling(item)) {
        pendingGroup = null;
      }
    }
    result.push(item);
  }
  return result;
}

export interface UseUnifiedMenuDataOptions {
  /** 平台级/系统级菜单配置（原有硬编号，由 BasicLayout 传入 getMenuConfig） */
  getSystemMenuConfig: () => MenuDataItem[];
  /** 数据库菜单转 MenuDataItem 的转换函数 */
  convertMenuTreeToMenuDataItem: (menu: MenuTree, isAppMenu?: boolean) => MenuDataItem;
  /** 翻译函数 */
  t: (key: string, options?: any) => string;
  /** 侧边栏是否收起（影响分组标题显示） */
  collapsed?: boolean;
}

export interface UnifiedMenuDataResult {
  /** 侧边栏 + UniTabs 用：系统菜单 + 扁平化应用菜单 */
  sidebarMenuData: MenuDataItem[];
  /** 面包屑 + 页面标题用：保留应用菜单完整层级 */
  breadcrumbMenuData: MenuDataItem[];
  /** 原始应用菜单树（过滤后），供需要树形结构的地方使用 */
  applicationMenus: MenuTree[];
  /** 是否加载中 */
  isLoading: boolean;
  /** 主动刷新 */
  refetch: () => void;
  /** 使缓存失效并刷新（manifest 同步后调用） */
  invalidateAndRefetch: () => void;
}

export function useUnifiedMenuData(
  options: UseUnifiedMenuDataOptions
): UnifiedMenuDataResult {
  const {
    getSystemMenuConfig,
    convertMenuTreeToMenuDataItem,
    t,
    collapsed = false,
  } = options;
  const currentUser = useGlobalStore((s) => s.currentUser);
  /** 未设置或非 false 时视为开启（兼容历史租户） */
  const launchWizardEnabled = useConfigStore((s) => s.configs.enable_launch_wizard !== false);
  const systemDashboardEnabled = useConfigStore((s) => s.configs.enable_system_dashboard !== false);
  const queryClient = useQueryClient();

  const applicationMenuVersion = useGlobalStore((s) => s.applicationMenuVersion ?? 0);

  const systemMenuConfig = useMemo(() => getSystemMenuConfig(), [getSystemMenuConfig]);

  const menuPermissionUser = useMemo(
    () => resolveUserForMenuPermission(currentUser),
    [currentUser],
  );

  // 权限列表为空时主动拉取 /auth/me，避免侧栏因本地缓存无 permissions 而整树被滤空
  useEffect(() => {
    if (!currentUser?.id) return;
    if (currentUser.is_tenant_admin || currentUser.is_infra_admin) return;
    if (menuPermissionUser?.permissions?.length) return;
    void refreshCurrentUserInStore().catch(() => {});
  }, [currentUser?.id, currentUser?.is_tenant_admin, currentUser?.is_infra_admin, menuPermissionUser?.permissions?.length]);

  const navigationMenuQueryKey = useMemo(
    () => [NAVIGATION_MENU_TREE_QUERY_KEY, currentUser?.tenant_id ?? null, currentUser?.permission_version ?? 0] as const,
    [currentUser?.tenant_id, currentUser?.permission_version],
  );

  const { data: fullMenuTree, isLoading, refetch } = useQuery({
    queryKey: navigationMenuQueryKey,
    queryFn: () => getNavigationMenuTree(),
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const applicationMenus = useMemo(() => {
    const tree = fullMenuTree ?? [];
    return collectApplicationRoots(tree);
  }, [fullMenuTree]);

  // 蓝图下线后不再做业务配置过滤；菜单可见性完全由 is_active + 权限控制。
  const filteredApplicationMenus = applicationMenus;

  useEffect(() => {
    if (applicationMenuVersion > 0) {
      queryClient.invalidateQueries({ queryKey: [NAVIGATION_MENU_TREE_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-menu-tree'] });
    }
  }, [applicationMenuVersion, queryClient]);

  useEffect(() => {
    if (currentUser?.permission_version != null) {
      queryClient.invalidateQueries({ queryKey: [NAVIGATION_MENU_TREE_QUERY_KEY] });
    }
  }, [currentUser?.permission_version, queryClient]);

  const invalidateAndRefetch = useCallback(() => {
    useGlobalStore.getState().incrementApplicationMenuVersion();
  }, []);

  const sidebarMenuData = useMemo(() => {
    if (!menuPermissionUser) return [];
    let items: MenuDataItem[] = [...systemMenuConfig];
    if (filteredApplicationMenus?.length) {
      const appMenuItems: MenuDataItem[] = [];
      filteredApplicationMenus.forEach((appMenu) => {
        if (!appMenu.children?.length) return;
        const convertedChildren = appMenu.children.map((child) => {
          const converted = convertMenuTreeToMenuDataItem(child, true);
          converted.className = converted.className ? `${converted.className} app-menu-item` : 'app-menu-item';
          return converted;
        });
        const visibleChildren = filterMenuItemsByPermission(convertedChildren, menuPermissionUser);
        if (!visibleChildren.length) return;

        if (!collapsed) {
          const findFirstAppPath = (list: any[]): string | null => {
            for (const c of list) {
              if (c?.path) return c.path;
              if (c?.children?.length) {
                const f = findFirstAppPath(c.children);
                if (f) return f;
              }
            }
            return null;
          };
          const firstPath = findFirstAppPath(visibleChildren);
          const code = firstPath ? extractAppCodeFromPath(firstPath) : null;
          const appName = code ? getAppDisplayName(code, t, appMenu.name) : appMenu.name;
          appMenuItems.push({
            name: appName,
            label: appName,
            key: `app-group-${appMenu.uuid}`,
            type: 'group',
            className: 'menu-group-title-app app-menu-container-start',
            children: [{ key: `app-group-placeholder-${appMenu.uuid}`, name: '', style: { display: 'none' } }],
          } as MenuDataItem);
        }
        visibleChildren.forEach((child) => {
          appMenuItems.push(child);
        });
      });
      items.splice(1, 0, ...appMenuItems);
    }
    const canAccessPlatformInfra = hasPlatformAdministrativeAuthority(currentUser);
    if (!canAccessPlatformInfra) {
      items = items.filter((item) => {
        if (item.children) {
          const hasInfra = item.children.some(
            (c) =>
              c.path?.startsWith('/infra/operation') ||
              c.path?.startsWith('/infra/tenants') ||
              c.path?.startsWith('/infra/packages') ||
              c.path?.startsWith('/infra/scripts') ||
              c.path?.startsWith('/infra/scheduled-tasks') ||
              c.path?.startsWith('/infra/admin')
          );
          return !hasInfra;
        }
        return true;
      });
    }
    let result = filterMenuItemsByPermission(items, menuPermissionUser);
    if (!launchWizardEnabled) {
      result = filterOutLaunchWizardMenus(result);
    }
    if (!systemDashboardEnabled) {
      result = filterOutSystemDashboardMenus(result);
    }
    return reconcileAppGroupTitles(result);
  }, [
    menuPermissionUser,
    launchWizardEnabled,
    systemDashboardEnabled,
    systemMenuConfig,
    filteredApplicationMenus,
    convertMenuTreeToMenuDataItem,
    collapsed,
    t,
    currentUser?.is_infra_admin,
  ]);

  const breadcrumbMenuData = useMemo(() => {
    if (!menuPermissionUser) return [];
    const items: MenuDataItem[] = [...systemMenuConfig];
    if (filteredApplicationMenus?.length) {
      const appItems: MenuDataItem[] = filteredApplicationMenus.map((appMenu) => {
        const findFirst = (list: any[]): string | null => {
          for (const c of list) {
            if (c?.path) return c.path;
            if (c?.children?.length) {
              const f = findFirst(c.children);
              if (f) return f;
            }
          }
          return null;
        };
        const firstPath = findFirst(appMenu.children || []);
        const code = firstPath ? extractAppCodeFromPath(firstPath) : null;
        const appName = code ? getAppDisplayName(code, t, appMenu.name) : appMenu.name;
        return {
          ...convertMenuTreeToMenuDataItem(appMenu, true),
          name: appName,
          key: `breadcrumb-app-${appMenu.uuid}`,
          isAppRoot: true, // 标记为 APP 根节点，供面包屑直接使用已翻译名称
        } as MenuDataItem;
      });
      items.splice(1, 0, ...appItems);
    }
    let result = filterMenuItemsByPermission(items, menuPermissionUser);
    if (!launchWizardEnabled) {
      result = filterOutLaunchWizardMenus(result);
    }
    if (!systemDashboardEnabled) {
      result = filterOutSystemDashboardMenus(result);
    }
    return result;
  }, [
    menuPermissionUser,
    launchWizardEnabled,
    systemDashboardEnabled,
    systemMenuConfig,
    filteredApplicationMenus,
    convertMenuTreeToMenuDataItem,
    t,
  ]);

  return {
    sidebarMenuData,
    breadcrumbMenuData,
    applicationMenus: filteredApplicationMenus ?? [],
    isLoading,
    refetch,
    invalidateAndRefetch,
  };
}
