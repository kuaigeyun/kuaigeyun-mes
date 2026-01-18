/**
 * 角色场景服务
 * 
 * 提供角色使用场景和工作台定制的API调用
 * 
 * @author Luigi Lu
 * @date 2026-01-27
 */

import { apiRequest } from './api';

/**
 * 角色场景信息
 */
export interface RoleScenario {
  id: string;
  name: string;
  description: string;
  features: string[];
  permissions: string[];
}

/**
 * 角色场景数据
 */
export interface RoleScenarioData {
  name: string;
  description: string;
  scenarios: RoleScenario[];
  dashboard: {
    widgets: Array<{
      type: string;
      title: string;
      api: string;
    }>;
  };
}

/**
 * 角色场景响应
 */
export interface RoleScenarioResponse {
  role?: {
    id: number;
    uuid: string;
    name: string;
    code: string;
  };
  scenarios: Record<string, RoleScenarioData> | RoleScenarioData;
}

/**
 * 角色工作台配置
 */
export interface RoleDashboardConfig {
  role?: {
    id: number;
    uuid: string;
    name: string;
    code: string;
  };
  dashboard: {
    widgets: Array<{
      type: string;
      title: string;
      api: string;
    }>;
  };
}

/**
 * 角色权限信息
 */
export interface RolePermissionInfo {
  role: {
    id: number;
    uuid: string;
    name: string;
    code: string;
  };
  permissions: Array<{
    id: number;
    uuid: string;
    name: string;
    code: string;
    type: string;
  }>;
}

/**
 * 获取角色使用场景
 * 
 * @param roleId - 角色ID（可选）
 * @param roleCode - 角色代码（可选）
 * @returns 角色使用场景信息
 */
export async function getRoleScenarios(
  roleId?: number,
  roleCode?: string
): Promise<any> {
  if (roleId) {
    const response = await apiRequest(`/api/v1/core/roles/${roleId}/scenarios`, { method: 'GET' });
    return response.data || response;
  } else if (roleCode) {
    const response = await apiRequest(`/api/v1/core/roles/by-code/${roleCode}/scenarios`, { method: 'GET' });
    return response.data || response;
  } else {
    // 获取所有角色场景
    const response = await apiRequest('/api/v1/core/roles/scenarios', { method: 'GET' });
    return response.data || response;
  }
}

/**
 * 获取角色工作台配置
 * 
 * @param roleId - 角色ID（可选）
 * @param roleCode - 角色代码（可选）
 * @returns 角色工作台配置
 */
export async function getRoleDashboard(
  roleId?: number,
  roleCode?: string
): Promise<any> {
  if (roleId) {
    const response = await apiRequest(`/api/v1/core/roles/${roleId}/dashboard`, { method: 'GET' });
    return response.data || response;
  } else if (roleCode) {
    const response = await apiRequest(`/api/v1/core/roles/by-code/${roleCode}/dashboard`, { method: 'GET' });
    return response.data || response;
  } else {
    throw new Error('必须提供roleId或roleCode');
  }
}

/**
 * 获取角色权限
 * 
 * @param roleId - 角色ID
 * @returns 角色权限信息
 */
export async function getRolePermissions(roleId: number): Promise<RolePermissionInfo> {
  return apiRequest(`/api/v1/core/roles/${roleId}/permissions`, { method: 'GET' });
}
