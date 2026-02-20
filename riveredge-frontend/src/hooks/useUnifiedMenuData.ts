/**
 * 统一菜单数据 Hook
 *
 * 平台级/系统级：使用原有 getMenuConfig 硬编码
 * 应用级 APP：数据库 getMenuTree（manifest 同步）→ 业务配置过滤 → 输出
 *
 * 使用场景：BasicLayout（侧边栏、UniTabs、面包屑、页面标题）、Dashboard 快捷入口等
 */

import { useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { MenuDataItem } from '@ant-design/pro-components';
import { getMenuTree, type MenuTree } from '../services/menu';
import { getBusinessConfig } from '../services/businessConfig';
import type { BusinessConfig } from '../services/businessConfig';
import { getMenuBusinessMeta } from '../utils/menuBusinessMapping';
import { extractAppCodeFromPath } from '../utils/menuTranslation';
import { useGlobalStore } from '../stores';

/** 与 BasicLayout 保持一致，确保缓存共享 */
const APPLICATION_MENUS_QUERY_KEY = 'applicationMenus';

/**
 * 按业务配置递归过滤菜单树
 */
function filterMenuByBusinessConfig(
  menus: MenuTree[],
  config: BusinessConfig | null | undefined
): MenuTree[] {
  if (!config) return menus;
  const modules = config.modules ?? {};
  const nodes = config.nodes ?? {};

  return menus
    .map((menu) => {
      const businessMeta = getMenuBusinessMeta(menu);
      if (businessMeta) {
        if (businessMeta.module !== undefined && modules[businessMeta.module] === false) return null;
        if (businessMeta.node !== undefined) {
          const nodeConfig = nodes[businessMeta.node];
          if (nodeConfig && nodeConfig.enabled === false) return null;
        }
      }
      if (menu.children && menu.children.length > 0) {
        const filteredChildren = filterMenuByBusinessConfig(menu.children, config);
        if (filteredChildren.length === 0 && !menu.path) return null;
        return { ...menu, children: filteredChildren };
      }
      return menu;
    })
    .filter((m): m is MenuTree => m !== null);
}

export interface UseUnifiedMenuDataOptions {
  /** 平台级/系统级菜单配置（原有硬编码，由 BasicLayout 传入 getMenuConfig） */
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
  const queryClient = useQueryClient();

  const applicationMenuVersion = useGlobalStore((s) => s.applicationMenuVersion ?? 0);

  const systemMenuConfig = useMemo(() => getSystemMenuConfig(), [getSystemMenuConfig]);

  const { data: fullMenuTree, isLoading, refetch } = useQuery({
    queryKey: [APPLICATION_MENUS_QUERY_KEY],
    queryFn: () => getMenuTree({ is_active: true }),
    enabled: !!currentUser,
    staleTime: process.env.NODE_ENV === 'development' ? 30 * 1000 : 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: businessConfig } = useQuery({
    queryKey: ['businessConfig'],
    queryFn: getBusinessConfig,
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const applicationMenus = useMemo(() => {
    const tree = fullMenuTree ?? [];
    const appRoots = tree.filter((m) => m.application_uuid);
    const seen = new Set<string>();
    return appRoots.filter((m) => {
      const u = m.application_uuid;
      if (!u || seen.has(u)) return false;
      seen.add(u);
      return true;
    });
  }, [fullMenuTree]);

  const filteredApplicationMenus = useMemo(() => {
    if (!applicationMenus?.length) return applicationMenus;
    return filterMenuByBusinessConfig(applicationMenus, businessConfig ?? undefined);
  }, [applicationMenus, businessConfig]);

  useEffect(() => {
    if (applicationMenuVersion > 0) {
      queryClient.invalidateQueries({ queryKey: [APPLICATION_MENUS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-menu-tree'] }); // Dashboard 快捷入口共用菜单源
    }
  }, [applicationMenuVersion, queryClient]);

  const invalidateAndRefetch = useCallback(() => {
    useGlobalStore.getState().incrementApplicationMenuVersion();
  }, []);

  const sidebarMenuData = useMemo(() => {
    if (!currentUser) return [];
    let items: MenuDataItem[] = [...systemMenuConfig];
    if (filteredApplicationMenus?.length) {
      const appMenuItems: MenuDataItem[] = [];
      filteredApplicationMenus.forEach((appMenu) => {
        if (!appMenu.children?.length) return;
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
          const firstPath = findFirstAppPath(appMenu.children);
          let appName = appMenu.name;
          if (firstPath?.startsWith('/apps/')) {
            const code = extractAppCodeFromPath(firstPath);
            if (code) {
              const key = `app.${code}.name`;
              const tr = t(key, { defaultValue: appMenu.name });
              if (tr && tr !== key) appName = tr;
            }
          }
          appMenuItems.push({
            name: appName,
            label: appName,
            key: `app-group-${appMenu.uuid}`,
            type: 'group',
            className: 'menu-group-title-app app-menu-container-start',
            children: [{ key: `app-group-placeholder-${appMenu.uuid}`, name: '', style: { display: 'none' } }],
          } as MenuDataItem);
        }
        appMenu.children.forEach((child) => {
          const converted = convertMenuTreeToMenuDataItem(child, true);
          converted.className = converted.className ? `${converted.className} app-menu-item` : 'app-menu-item';
          appMenuItems.push(converted);
        });
      });
      items.splice(1, 0, ...appMenuItems);
    }
    if (!currentUser.is_infra_admin) {
      items = items.filter((item) => {
        if (item.children) {
          const hasInfra = item.children.some(
            (c) =>
              c.path?.startsWith('/infra/operation') ||
              c.path?.startsWith('/infra/tenants') ||
              c.path?.startsWith('/infra/packages') ||
              c.path?.startsWith('/infra/monitoring') ||
              c.path?.startsWith('/infra/inngest') ||
              c.path?.startsWith('/infra/admin')
          );
          return !hasInfra;
        }
        return true;
      });
    }
    return items;
  }, [
    currentUser,
    systemMenuConfig,
    filteredApplicationMenus,
    convertMenuTreeToMenuDataItem,
    collapsed,
    t,
  ]);

  const breadcrumbMenuData = useMemo(() => {
    if (!currentUser) return [];
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
        let appName = appMenu.name;
        if (firstPath?.startsWith('/apps/')) {
          const code = extractAppCodeFromPath(firstPath);
          if (code) {
            const key = `app.${code}.name`;
            const tr = t(key, { defaultValue: appMenu.name });
            if (tr && tr !== key) appName = tr;
          }
        }
        return {
          ...convertMenuTreeToMenuDataItem(appMenu, true),
          name: appName,
          key: `breadcrumb-app-${appMenu.uuid}`,
        } as MenuDataItem;
      });
      items.splice(1, 0, ...appItems);
    }
    return items;
  }, [
    currentUser,
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
