/**
 * 上线向导服务
 * 
 * 提供角色上线准备和使用场景引导的API调用
 * 
 * @author Luigi Lu
 * @date 2026-01-27
 */

import { apiRequest } from './api';

/**
 * 上线准备清单项
 */
export interface OnboardingChecklistItem {
  id: string;
  name: string;
  required: boolean;
  description: string;
}

/**
 * 上线准备清单分类
 */
export interface OnboardingChecklistCategory {
  id: string;
  name: string;
  items: OnboardingChecklistItem[];
}

/**
 * 角色上线准备向导
 */
export interface RoleOnboardingGuide {
  name: string;
  checklist: OnboardingChecklistCategory[];
}

/**
 * 角色上线准备向导响应
 */
export interface RoleOnboardingGuideResponse {
  role?: {
    id: number;
    uuid: string;
    name: string;
    code: string;
  };
  guide: RoleOnboardingGuide;
}

/**
 * 获取角色上线准备向导
 * 
 * @param roleId - 角色ID（可选）
 * @param roleCode - 角色代码（可选）
 * @returns 角色上线准备向导信息
 */
export async function getRoleOnboardingGuide(
  roleId?: number,
  roleCode?: string
): Promise<any> {
  if (roleId) {
    const response = await apiRequest(`/api/v1/core/onboarding/roles/${roleId}/guide`, { method: 'GET' });
    return response.data || response;
  } else if (roleCode) {
    const response = await apiRequest(`/api/v1/core/onboarding/roles/by-code/${roleCode}/guide`, { method: 'GET' });
    return response.data || response;
  } else {
    throw new Error('必须提供roleId或roleCode');
  }
}

/**
 * 获取所有角色的上线准备向导
 * 
 * @returns 所有角色的上线准备向导信息
 */
export async function getAllOnboardingGuides(): Promise<any> {
  const response = await apiRequest('/api/v1/core/onboarding/guides', { method: 'GET' });
  return response.data || response;
}

/**
 * 获取角色使用场景向导
 * 
 * @param roleId - 角色ID（可选）
 * @param roleCode - 角色代码（可选）
 * @returns 角色使用场景向导信息
 */
export async function getRoleScenarioGuide(
  roleId?: number,
  roleCode?: string
): Promise<any> {
  if (roleId) {
    const response = await apiRequest(`/api/v1/core/onboarding/roles/${roleId}/scenarios`, { method: 'GET' });
    return response.data || response;
  } else if (roleCode) {
    const response = await apiRequest(`/api/v1/core/onboarding/roles/by-code/${roleCode}/scenarios`, { method: 'GET' });
    return response.data || response;
  } else {
    throw new Error('必须提供roleId或roleCode');
  }
}

/**
 * 获取快速入门教程
 * 
 * @returns 快速入门教程信息
 */
export async function getQuickStartTutorial(): Promise<any> {
  const response = await apiRequest('/api/v1/core/onboarding/quick-start', { method: 'GET' });
  return response.data || response;
}
