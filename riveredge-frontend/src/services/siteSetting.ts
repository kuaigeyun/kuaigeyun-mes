/**
 * 站点设置 API 服务
 * 
 * 提供站点设置管理相关的 API 接口
 */

import { apiRequest } from './api';

/**
 * 站点设置信息接口
 */
export interface SiteSetting {
  uuid: string;
  tenant_id: number;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * 更新站点设置数据
 */
export interface UpdateSiteSettingData {
  settings: Record<string, any>;
}

/**
 * 获取站点设置
 * 
 * 获取当前组织的站点设置，如果不存在则自动创建。
 * 
 * @returns 站点设置信息
 */
export async function getSiteSetting(): Promise<SiteSetting> {
  return apiRequest<SiteSetting>('/core/site-settings');
}

/**
 * 更新站点设置
 * 
 * 更新当前组织的站点设置。
 * 
 * @param data - 站点设置更新数据
 * @returns 更新后的站点设置信息
 */
export async function updateSiteSetting(data: UpdateSiteSettingData): Promise<SiteSetting> {
  return apiRequest<SiteSetting>('/core/site-settings', {
    method: 'PUT',
    data,
  });
}

