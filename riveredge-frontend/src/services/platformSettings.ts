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
  /** 当前运行代码的短 commit，未注入或旧版后端时可能缺省 */
  git_commit?: string;
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
    let data: PlatformVersion;
    if (!response.ok) {
      data = getDefaultVersion();
    } else {
      data = await response.json();
    }
    // 强制使用前端构建时注入的时间作为“构建/发布时间”
    // 这样能确保时间是固定的，且以实际前端部署（构建）时间为准
    return {
      ...data,
      build_time: __BUILD_TIME__,
    };
  } catch {
    const data = getDefaultVersion();
    return {
      ...data,
      build_time: __BUILD_TIME__,
    };
  }
}

function getDefaultVersion(): PlatformVersion {
  const sha = import.meta.env.VITE_GIT_SHA;
  return {
    build_time: __BUILD_TIME__,
    git_commit: typeof sha === 'string' && sha ? sha : '',
    git_latest_commit_time: '-',
    git_repo_url: 'https://gitee.com/kuaigeyun/kuaigeyun',
  };
}
