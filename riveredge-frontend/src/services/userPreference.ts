/**
 * 用户偏好管理服务
 * 
 * 提供用户偏好的查询和更新功能。
 * 注意：所有 API 自动获取当前用户的偏好设置
 */

import { apiRequest } from './api';

export interface UserPreference {
  uuid: string;
  tenant_id: number;
  user_id: number;
  preferences: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface UpdateUserPreferenceData {
  preferences?: Record<string, any>;
}

/**
 * 获取当前用户偏好设置
 */
export async function getUserPreference(): Promise<UserPreference> {
  return apiRequest<UserPreference>('/personal/user-preferences');
}

/**
 * 更新当前用户偏好设置
 */
export async function updateUserPreference(data: UpdateUserPreferenceData): Promise<UserPreference> {
  return apiRequest<UserPreference>('/personal/user-preferences', {
    method: 'PUT',
    data,
  });
}

