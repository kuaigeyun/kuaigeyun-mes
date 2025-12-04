/**
 * 部门 API 服务
 * 
 * 提供部门管理相关的 API 接口
 * 注意：所有 API 自动过滤当前组织的部门
 */

import { apiRequest } from './api';

/**
 * 部门信息接口
 */
export interface Department {
  uuid: string;
  name: string;
  code?: string;
  description?: string;
  parent_uuid?: string;
  manager_uuid?: string;
  sort_order: number;
  is_active: boolean;
  tenant_id: number;
  children_count?: number;
  user_count?: number;
  created_at: string;
  updated_at: string;
}

/**
 * 部门树形项接口
 */
export interface DepartmentTreeItem extends Department {
  children?: DepartmentTreeItem[];
}

/**
 * 部门树形响应数据
 */
export interface DepartmentTreeResponse {
  items: DepartmentTreeItem[];
  total: number;
}

/**
 * 创建部门数据
 */
export interface CreateDepartmentData {
  name: string;
  code?: string;
  description?: string;
  parent_uuid?: string;
  manager_uuid?: string;
  sort_order?: number;
  is_active?: boolean;
}

/**
 * 更新部门数据
 */
export interface UpdateDepartmentData {
  name?: string;
  code?: string;
  description?: string;
  parent_uuid?: string;
  manager_uuid?: string;
  sort_order?: number;
  is_active?: boolean;
}

/**
 * 获取部门树形结构
 * 
 * 返回完整的部门树形结构，包含所有子部门。
 * 
 * @returns 部门树形响应数据
 */
export async function getDepartmentTree(): Promise<DepartmentTreeResponse> {
  return apiRequest<DepartmentTreeResponse>('/system/departments/tree');
}

/**
 * 获取部门详情
 * 
 * 自动验证组织权限：只能获取当前组织的部门。
 * 
 * @param departmentUuid - 部门 UUID
 * @returns 部门信息
 */
export async function getDepartmentByUuid(departmentUuid: string): Promise<Department> {
  return apiRequest<Department>(`/system/departments/${departmentUuid}`);
}

/**
 * 创建部门
 * 
 * 自动设置当前组织的 tenant_id。
 * 
 * @param data - 部门创建数据
 * @returns 创建的部门信息
 */
export async function createDepartment(data: CreateDepartmentData): Promise<Department> {
  return apiRequest<Department>('/system/departments', {
    method: 'POST',
    data,
  });
}

/**
 * 更新部门
 * 
 * 自动验证组织权限：只能更新当前组织的部门。
 * 
 * @param departmentUuid - 部门 UUID
 * @param data - 部门更新数据
 * @returns 更新后的部门信息
 */
export async function updateDepartment(departmentUuid: string, data: UpdateDepartmentData): Promise<Department> {
  return apiRequest<Department>(`/system/departments/${departmentUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除部门
 * 
 * 自动验证组织权限：只能删除当前组织的部门。
 * 有子部门或关联用户的部门不可删除。
 * 
 * @param departmentUuid - 部门 UUID
 */
export async function deleteDepartment(departmentUuid: string): Promise<void> {
  return apiRequest<void>(`/system/departments/${departmentUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 批量更新部门排序
 * 
 * 用于前端拖拽排序后批量更新多个部门的排序顺序。
 * 
 * @param departmentOrders - 部门排序列表，格式：[{"uuid": "...", "sort_order": 1}, ...]
 */
export async function updateDepartmentOrder(
  departmentOrders: Array<{ uuid: string; sort_order: number }>
): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>('/system/departments/sort', {
    method: 'PUT',
    data: departmentOrders,
  });
}

