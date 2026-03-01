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

/**
 * 获取当前用户个人资料
 */
export async function getUserProfile(): Promise<UserProfile> {
  return apiRequest<UserProfile>('/personal/user-profile');
}
