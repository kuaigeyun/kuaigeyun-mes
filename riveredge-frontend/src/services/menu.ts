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
 * 获取菜单树
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

