/**
 * 统一菜单数据 Hook
 *
 * 平台级/系统级：使用原有 getMenuConfig 硬编号
 * 应用级 APP：GET /core/menus/navigation-tree（顺序由后端 manifest 决定）→ 权限过滤 → 输出。
 * 禁止在此对应用菜单按 sort_order 重排（见 .cursor/rules/no-fallback-patches.mdc）。
 *
 * 菜单显示层级（蓝图设置已下线）：
 * 1. 菜单管理：navigation-tree（任意登录用户可读），未入库或禁用则不返回（= 功能关闭）
 * 2. 自组菜单：custom-layout（任意登录用户可读；写入须 system.menu:update）
 * 3. 权限管理：filterMenuItemsByPermission，用户无权限则隐藏
 *
 * 使用场景：BasicLayout（侧边栏、UniTabs、面包屑、页面标题）、Dashboard 快捷入口等
 */

import { createElement, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { MenuDataItem } from '@ant-design/pro-components';
import {
  buildMenuCustomLayoutQueryKey,
  getMenuCustomLayout,
  type MenuTree,
  type CustomMenuLayoutNode,
} from '../services/menu';
import { extractAppCodeFromPath, resolveAppMenuGroupDisplayName } from '../utils/menuTranslation';
import { useGlobalStore } from '../stores';
import { useConfigStore } from '../stores/configStore';
import { filterMenuItemsByPermission, resolveUserForMenuPermission, isAppGroupTitleItem } from '../utils/permission';
import { isEmptyIndustryPackRoot } from '../layouts/basicLayout/sidebarMenuLayout';
import { isInfraSuperAdminUser, hasPlatformAdministrativeAuthority } from '../utils/auth';
import { refetchSessionCurrentUser } from '../utils/sessionCurrentUser';
import { NAVIGATION_MENU_TREE_QUERY_KEY, useNavigationMenuTreeQuery } from './useNavigationMenuTreeQuery';
import { useCurrentUser } from './useCurrentUser';

// 向后兼容：历史代码从本模块导入该常量
export { NAVIGATION_MENU_TREE_QUERY_KEY };

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

function flattenMenuTreeByUuid(nodes: MenuTree[]): Map<string, MenuTree> {
  const byUuid = new Map<string, MenuTree>();
  const walk = (items: MenuTree[]) => {
    items.forEach((item) => {
      if (item?.uuid) byUuid.set(String(item.uuid), item);
      if (item.children?.length) walk(item.children);
    });
  };
  walk(nodes);
  return byUuid;
}

function cloneSourceMenuNode(
  source: MenuTree,
  nodeIdPrefix: string,
  overrides?: { title?: string; icon?: string },
): MenuTree {
  const children = (source.children ?? []).map((child, idx) =>
    cloneSourceMenuNode(child, `${nodeIdPrefix}-${idx}`),
  );
  return {
    ...source,
    uuid: `${nodeIdPrefix}-${source.uuid}`,
    name: (overrides?.title || '').trim() || source.name,
    icon: (overrides?.icon || '').trim() || source.icon,
    children,
  };
}

/**
 * 「未分组」是自组编辑器的虚拟桶（叶子尚未归入命名分组），不应作为侧栏一级标题。
 * 识别：id 含 ungrouped，或历史已落库的各语种标题。
 */
const CUSTOM_LAYOUT_UNGROUPED_TITLES = new Set([
  '未分组',
  '未群組',
  'Ungrouped',
  '未グループ',
  'Chưa phân nhóm',
  'pages.system.menus.customLayoutUngrouped',
]);

function isUngroupedCustomLayoutGroup(node: CustomMenuLayoutNode): boolean {
  if (node.type !== 'custom_group') return false;
  const id = String(node.id || '');
  if (id.includes('ungrouped')) return true;
  const title = String(node.title || '').trim();
  return CUSTOM_LAYOUT_UNGROUPED_TITLES.has(title);
}

function buildMappedMenuTree(
  nodes: CustomMenuLayoutNode[],
  sourceByUuid: Map<string, MenuTree>,
  parentPrefix: string,
): MenuTree[] {
  const result: MenuTree[] = [];
  nodes.forEach((node, index) => {
    const nodeId = (node.id || '').trim() || `${parentPrefix}-${index}`;
    // 侧栏展开「未分组」：子项直接挂到父级（APP 下表现为一级菜单）
    if (isUngroupedCustomLayoutGroup(node)) {
      result.push(
        ...buildMappedMenuTree(node.children || [], sourceByUuid, `${parentPrefix}-${nodeId}`),
      );
      return;
    }
    if (node.type === 'menu_ref') {
      const menuUuid = String(node.menu_uuid || '');
      const source = sourceByUuid.get(menuUuid);
      if (!source) {
        result.push({
          uuid: `${parentPrefix}-${nodeId}-missing`,
          tenant_id: 0,
          name: node.title?.trim() || menuUuid || 'missing',
          path: undefined,
          icon: node.icon,
          component: undefined,
          permission_code: undefined,
          application_uuid: undefined,
          parent_uuid: undefined,
          sort_order: index,
          is_active: true,
          is_external: false,
          external_url: undefined,
          meta: { custom_layout_virtual: true, custom_layout_missing_ref: true },
          created_at: '',
          updated_at: '',
          children: [],
        });
        return;
      }
      result.push(
        cloneSourceMenuNode(source, `${parentPrefix}-${nodeId}`, {
          title: node.title,
          icon: node.icon,
        }),
      );
      return;
    }

    result.push({
      uuid: `${parentPrefix}-${nodeId}`,
      tenant_id: 0,
      name: (node.title || '').trim() || (node.type === 'app_group' ? 'APP' : '分组'),
      path: undefined,
      icon: (node.icon || '').trim() || undefined,
      component: undefined,
      permission_code: undefined,
      application_uuid: undefined,
      parent_uuid: undefined,
      sort_order: index,
      is_active: true,
      is_external: false,
      external_url: undefined,
      meta: {
        custom_layout_virtual: true,
        custom_layout_group_type: node.type,
      },
      created_at: '',
      updated_at: '',
      children: buildMappedMenuTree(node.children || [], sourceByUuid, `${parentPrefix}-${nodeId}`),
    });
  });
  return result;
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
  const currentUser = useCurrentUser();
  /** 未设置或非 false 时视为开启（兼容历史租户） */
  const launchWizardEnabled = useConfigStore((s) => s.configs.enable_launch_wizard !== false);
  const systemDashboardEnabled = useConfigStore((s) => s.configs.enable_system_dashboard !== false);
  /** 侧栏 APP 名称分组标题；站点设置 show_app_menu_names，缺省显示 */
  const showAppMenuNames = useConfigStore((s) => s.configs.show_app_menu_names !== false);
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
    void refetchSessionCurrentUser().catch(() => {});
  }, [currentUser?.id, currentUser?.is_tenant_admin, currentUser?.is_infra_admin, menuPermissionUser?.permissions?.length]);

  const { data: fullMenuTree, isLoading, isPending, refetch } = useNavigationMenuTreeQuery();
  const menuCustomLayoutQueryKey = useMemo(
    () => buildMenuCustomLayoutQueryKey(currentUser?.tenant_id),
    [currentUser?.tenant_id],
  );
  const { data: menuCustomLayout } = useQuery({
    queryKey: menuCustomLayoutQueryKey,
    queryFn: () => getMenuCustomLayout(),
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    // 菜单重命名等仅刷新导航树时，避免布局 query 短暂空窗回退 manifest 默认序
    placeholderData: (previousData) => previousData,
  });

  const applicationMenus = useMemo(() => {
    const tree = fullMenuTree ?? [];
    return collectApplicationRoots(tree);
  }, [fullMenuTree]);

  const mappedApplicationMenus = useMemo(() => {
    const layoutEnabled = menuCustomLayout?.enabled === true;
    const layoutNodes = menuCustomLayout?.nodes;
    if (!layoutEnabled || !Array.isArray(layoutNodes) || layoutNodes.length === 0) {
      return applicationMenus;
    }
    const sourceByUuid = flattenMenuTreeByUuid(applicationMenus);
    return buildMappedMenuTree(layoutNodes, sourceByUuid, 'custom-layout-root');
  }, [applicationMenus, menuCustomLayout?.enabled, menuCustomLayout?.nodes]);

  // 蓝图下线后不再做业务配置过滤；菜单可见性完全由 is_active + 权限控制。
  const filteredApplicationMenus = mappedApplicationMenus;

  useEffect(() => {
    if (applicationMenuVersion > 0) {
      queryClient.invalidateQueries({ queryKey: [NAVIGATION_MENU_TREE_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-menu-tree'] });
    }
  }, [applicationMenuVersion, queryClient]);

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

        if (!collapsed && showAppMenuNames) {
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
          const codeFromRoot = extractAppCodeFromPath(String(appMenu.path || ''));
          const codeFromFirstLeaf = firstPath ? extractAppCodeFromPath(firstPath) : null;
          // 快交付等 PRO 应用菜单页在 kuaizhizao 路径下，须以应用根 path 识别 code，否则 PRO 徽标丢失
          const code = codeFromRoot || codeFromFirstLeaf;
          // 行业包容器：分组标题固定用 industry-pack 显示名，勿用子模块 code 顶替（子模块名在下一级「电子制造」等）
          const isIndustryPackRoot =
            String(appMenu.path || '') === '/apps/industry-pack' ||
            extractAppCodeFromPath(String(appMenu.path || '')) === 'industry-pack';
          const groupCode = isIndustryPackRoot ? 'industry-pack' : code;
          const appName = (appMenu.meta as any)?.custom_layout_virtual
            ? appMenu.name
            : (groupCode
                ? resolveAppMenuGroupDisplayName(groupCode, appMenu.name, t)
                : appMenu.name);
          // React 兄弟节点 key 必须唯一：同一 app code 可能出现多个根（自组菜单 / 重复入库）。
          // 应用 code 仍写在 path / data-app-menu-group，供侧栏样式与短标签解析。
          appMenuItems.push({
            name: appName,
            label: createElement(
              'span',
              {
                'data-app-menu-group': groupCode || '1',
                className: 'menu-group-title-app-inner',
              },
              appName,
            ),
            key: `app-group-${appMenu.uuid}`,
            path: groupCode ? `#app-group-${groupCode}` : undefined,
            type: 'group',
            className: 'menu-group-title-app app-menu-container-start',
            children: [
              {
                key: `app-group-placeholder-${appMenu.uuid}`,
                name: '\u00A0',
                className: 'app-group-placeholder-item',
              },
            ],
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
    showAppMenuNames,
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
        const codeFromChild = firstPath ? extractAppCodeFromPath(firstPath) : null;
        // 与侧栏分组一致：行业包容器勿用首个子模块 code（如 ind-electronics）顶替
        const isIndustryPackRoot =
          String(appMenu.path || '') === '/apps/industry-pack' ||
          extractAppCodeFromPath(String(appMenu.path || '')) === 'industry-pack';
        const code = isIndustryPackRoot ? 'industry-pack' : codeFromChild;
        const appName = (appMenu.meta as any)?.custom_layout_virtual
          ? appMenu.name
          : (code ? resolveAppMenuGroupDisplayName(code, appMenu.name, t) : appMenu.name);
        return {
          ...convertMenuTreeToMenuDataItem(appMenu, true),
          name: appName,
          key: `breadcrumb-app-${appMenu.uuid}`,
          isAppRoot: true, // 标记为 APP 根节点，供面包屑直接使用已翻译名称
        } as MenuDataItem;
      }).filter((item) => !isEmptyIndustryPackRoot(item));
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
    // 已有导航树即可渲染 APP 菜单；自组布局未到时先按默认序，到了再映射，勿整段卡住
    isLoading: (isPending || isLoading) && !fullMenuTree?.length,
    refetch,
    invalidateAndRefetch,
  };
}
