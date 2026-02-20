/**
 * 平台设置API服务
 *
 * 提供平台设置相关的API调用接口
 *
 * @author Auto (AI Assistant)
 * @date 2026-01-06
 */

import { api } from './api';

/**
 * 平台设置接口定义
 */
export interface PlatformSettings {
  id?: number;
  platform_name: string;
  platform_logo?: string;
  favicon?: string;
  platform_description?: string;
  platform_contact_email?: string;
  platform_contact_phone?: string;
  platform_website?: string;
  login_title?: string;
  login_content?: string;
  icp_license?: string;
  theme_color?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PlatformSettingsUpdateRequest {
  platform_name?: string;
  platform_logo?: string;
  favicon?: string;
  platform_description?: string;
  platform_contact_email?: string;
  platform_contact_phone?: string;
  platform_website?: string;
  login_title?: string;
  login_content?: string;
  icp_license?: string;
  theme_color?: string;
}

/**
 * 获取平台设置
 */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  return api.get<PlatformSettings>('/infra/platform-settings');
}

/**
 * 更新平台设置
 */
export async function updatePlatformSettings(
  data: PlatformSettingsUpdateRequest
): Promise<PlatformSettings> {
  return api.put<PlatformSettings>('/infra/platform-settings', data);
}

/**
 * 创建平台设置
 */
export async function createPlatformSettings(
  data: PlatformSettings
): Promise<PlatformSettings> {
  return api.post<PlatformSettings>('/infra/platform-settings', data);
}

/**
 * 获取平台设置（公开接口，不需要认证）
 * 用于登录页等公开页面
 */
export async function getPlatformSettingsPublic(): Promise<PlatformSettings> {
  // 使用原生fetch，因为这是公开接口，不需要认证
  const response = await fetch('/api/v1/infra/platform-settings/public');
  if (!response.ok) {
    throw new Error(`获取平台设置失败: ${response.statusText}`);
  }
  return response.json();
}
