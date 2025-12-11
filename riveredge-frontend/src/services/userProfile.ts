/**
 * 个人资料管理服务
 * 
 * 提供个人资料的查询和更新功能。
 * 注意：所有 API 自动获取当前用户的个人资料
 */

import { apiRequest } from './api';

export interface UserProfile {
  uuid: string;
  username: string;
  email?: string;
  full_name?: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  contact_info?: Record<string, any>;
  gender?: string;
}

export interface UpdateUserProfileData {
  avatar?: string | null;
  bio?: string;
  contact_info?: Record<string, any>;
  gender?: string;
  email?: string;
  full_name?: string;
  phone?: string;
  username?: string;
}

/**
 * 获取当前用户个人资料
 */
export async function getUserProfile(): Promise<UserProfile> {
  return apiRequest<UserProfile>('/personal/user-profile');
}

/**
 * 更新当前用户个人资料
 */
export async function updateUserProfile(data: UpdateUserProfileData): Promise<UserProfile> {
  return apiRequest<UserProfile>('/personal/user-profile', {
    method: 'PUT',
    data,
  });
}
