/**
 * 菜单管理服务
 * 
 * 提供菜单的查询、创建、更新、删除和树形结构管理功能。
 */

import { apiRequest } from './api';

export interface Menu {
  uuid: string;
  tenant_id: number;
  name: string;
  path?: string;
  icon?: string;
  component?: string;
  permission_code?: string;
  application_uuid?: string;
  parent_uuid?: string;
  sort_order: number;
  is_active: boolean;
  is_external: boolean;
  external_url?: string;
  meta?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface MenuTree extends Menu {
  children: MenuTree[];
}

export interface CreateMenuData {
  name: string;
  path?: string;
  icon?: string;
  component?: string;
  permission_code?: string;
  application_uuid?: string;
  parent_uuid?: string;
  sort_order?: number;
  is_active?: boolean;
  is_external?: boolean;
  external_url?: string;
  meta?: Record<string, any>;
}

export interface UpdateMenuData {
  name?: string;
  path?: string;
  icon?: string;
  component?: string;
  permission_code?: string;
  application_uuid?: string;
  parent_uuid?: string;
  sort_order?: number;
  is_active?: boolean;
  is_external?: boolean;
  external_url?: string;
  meta?: Record<string, any>;
}

export interface MenuOrderItem {
  uuid: string;
  sort_order: number;
}

export type CustomMenuLayoutNodeType = 'app_group' | 'custom_group' | 'menu_ref';

export interface CustomMenuLayoutNode {
  id: string;
  type: CustomMenuLayoutNodeType;
  title?: string;
  icon?: string;
  menu_uuid?: string;
  menu_path?: string;
  children: CustomMenuLayoutNode[];
}

export interface CustomMenuLayout {
  enabled: boolean;
  version: number;
  nodes: CustomMenuLayoutNode[];
}

/**
 * 创建菜单
 */
export async function createMenu(data: CreateMenuData): Promise<Menu> {
  return apiRequest<Menu>('/core/menus', {
    method: 'POST',
    data,
  });
}

/**
 * 获取菜单列表
 */
export async function getMenus(params?: {
  page?: number;
  page_size?: number;
  parent_uuid?: string;
  application_uuid?: string;
  is_active?: boolean;
}): Promise<Menu[]> {
  return apiRequest<Menu[]>('/core/menus', {
    params,
  });
}

/**
 * 获取菜单树（菜单管理 / 权限配置，需 system.menu:read）
 */
export async function getMenuTree(params?: {
  parent_uuid?: string;
  application_uuid?: string;
  is_active?: boolean;
}): Promise<MenuTree[]> {
  return apiRequest<MenuTree[]>('/core/menus/tree', {
    params,
  });
}

/**
 * 侧栏 / 工作台导航菜单树（任意登录用户可读，前端再按 RBAC 过滤）
 */
export async function getNavigationMenuTree(): Promise<MenuTree[]> {
  return apiRequest<MenuTree[]>('/core/menus/navigation-tree');
}

/** 获取租户级自组菜单布局（展示映射层） */
export async function getMenuCustomLayout(): Promise<CustomMenuLayout> {
  return apiRequest<CustomMenuLayout>('/core/menus/custom-layout');
}

/** 更新租户级自组菜单布局 */
export async function updateMenuCustomLayout(data: {
  enabled: boolean;
  nodes: CustomMenuLayoutNode[];
}): Promise<CustomMenuLayout> {
  return apiRequest<CustomMenuLayout>('/core/menus/custom-layout', {
    method: 'PUT',
    data,
  });
}

/**
 * 获取菜单详情
 */
export async function getMenuDetail(uuid: string): Promise<Menu> {
  return apiRequest<Menu>(`/core/menus/${uuid}`);
}

/**
 * 更新菜单
 */
export async function updateMenu(uuid: string, data: UpdateMenuData): Promise<Menu> {
  return apiRequest<Menu>(`/core/menus/${uuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除菜单
 */
export async function deleteMenu(uuid: string): Promise<void> {
  return apiRequest<void>(`/core/menus/${uuid}`, {
    method: 'DELETE',
  });
}

/**
 * 更新菜单排序
 */
export async function updateMenuOrder(menuOrders: MenuOrderItem[]): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>('/core/menus/update-order', {
    method: 'POST',
    data: menuOrders,
  });
}

/**
 * 根据已安装应用的菜单配置，重新同步所有菜单到数据库
 */
export async function syncAllMenus(): Promise<{ success: boolean; message: string; count?: number }> {
  return apiRequest<{ success: boolean; message: string; count?: number }>('/core/menus/sync-all', {
    method: 'POST',
  });
}

/** React Query 缓存键：当前租户后台首页 */
export const TENANT_BACKEND_HOME_QUERY_KEY = ['tenantBackendHome'] as const;

/** React Query 缓存键：当前用户有效 UniTabs 首页 */
export const EFFECTIVE_HOME_QUERY_KEY = ['effectiveHome'] as const;

export type EffectiveHomeSource = 'role' | 'menu' | 'workplace' | 'fallback';

export interface EffectiveHome {
  path: string;
  source: EffectiveHomeSource;
  role_uuid?: string | null;
  menu_uuid?: string | null;
}

export interface TenantBackendHome {
  menu_uuid: string | null;
  path: string | null;
  name: string | null;
}

/** 当前租户配置的后台首页（未配置时 path/menu_uuid 为 null） */
export async function getTenantBackendHome(): Promise<TenantBackendHome> {
  return apiRequest<TenantBackendHome>('/core/menus/backend-home');
}

/** 当前用户有效首页：角色 > 菜单主页 > 工作台 > 兜底页 */
export async function getEffectiveHome(): Promise<EffectiveHome> {
  return apiRequest<EffectiveHome>('/core/menus/effective-home');
}

/** 将菜单设为后台首页（租户内唯一，自动取消原配置） */
export async function setMenuAsBackendHome(menuUuid: string): Promise<Menu> {
  return apiRequest<Menu>(`/core/menus/${menuUuid}/set-as-backend-home`, {
    method: 'POST',
  });
}

/** 清除自定义后台首页，恢复系统默认（工作台/应用中心） */
export async function clearTenantBackendHome(): Promise<void> {
  return apiRequest<void>('/core/menus/backend-home', {
    method: 'DELETE',
  });
}

