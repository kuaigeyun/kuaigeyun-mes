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
  tenant_auto_approve?: boolean;
  float_button_enabled?: boolean;
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
  tenant_auto_approve?: boolean;
  float_button_enabled?: boolean;
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

/** 默认平台设置（API 失败时降级使用） */
const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  platform_name: 'RiverEdge SaaS Framework',
  theme_color: '#1890ff',
};

/**
 * 获取平台设置（公开接口，不需要认证）
 * 用于登录页等公开页面
 * API 失败时返回默认值，确保登录页可加载
 */
export async function getPlatformSettingsPublic(): Promise<PlatformSettings> {
  try {
    const response = await fetch('/api/v1/infra/platform-settings/public');
    if (!response.ok) {
      return DEFAULT_PLATFORM_SETTINGS;
    }
    return response.json();
  } catch {
    return DEFAULT_PLATFORM_SETTINGS;
  }
}

/** 平台版本信息（用于悬浮按钮） */
export interface PlatformVersion {
  build_time: string;
  git_latest_commit_time: string;
  git_repo_url: string;
  iteration_notice?: string;
}

/**
 * 获取平台版本与迭代信息（公开接口）
 * 用于右下角悬浮按钮展示
 */
export async function getPlatformVersion(): Promise<PlatformVersion> {
  try {
    const response = await fetch('/api/v1/infra/platform/version');
    if (!response.ok) return getDefaultVersion();
    return response.json();
  } catch {
    return getDefaultVersion();
  }
}

function getDefaultVersion(): PlatformVersion {
  return {
    build_time: '-',
    git_latest_commit_time: '-',
    git_repo_url: 'https://gitee.com/kuaigeyun/kuaigeyun',
  };
}
