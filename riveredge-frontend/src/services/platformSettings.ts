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
  platform_name_en?: string;
  platform_logo?: string;
  favicon?: string;
  platform_description?: string;
  platform_contact_email?: string;
  platform_contact_phone?: string;
  platform_website?: string;
  login_title?: string;
  login_title_en?: string;
  login_content?: string;
  login_content_en?: string;
  login_decoration_image?: string;
  login_background_image?: string;
  login_decoration_enabled?: boolean;
  login_background_enabled?: boolean;
  icp_license?: string;
  icp_license_en?: string;
  theme_color?: string;
  tenant_auto_approve?: boolean;
  float_button_enabled?: boolean;
  login_guest_enabled?: boolean;
  login_client_win_enabled?: boolean;
  login_client_android_enabled?: boolean;
  login_quick_enabled?: boolean;
  enable_register?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PlatformSettingsUpdateRequest {
  platform_name?: string;
  platform_name_en?: string;
  platform_logo?: string;
  favicon?: string;
  platform_description?: string;
  platform_contact_email?: string;
  platform_contact_phone?: string;
  platform_website?: string;
  login_title?: string;
  login_title_en?: string;
  login_content?: string;
  login_content_en?: string;
  login_decoration_image?: string;
  login_background_image?: string;
  login_decoration_enabled?: boolean;
  login_background_enabled?: boolean;
  icp_license?: string;
  icp_license_en?: string;
  theme_color?: string;
  tenant_auto_approve?: boolean;
  float_button_enabled?: boolean;
  login_guest_enabled?: boolean;
  login_client_win_enabled?: boolean;
  login_client_android_enabled?: boolean;
  login_quick_enabled?: boolean;
  enable_register?: boolean;
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

function resolveBuildTime(): string {
  // 仅用于前端兜底（后端不可用时），避免生产每次刷新都动态变化
  const globalBuildTime =
    typeof __BUILD_TIME__ !== 'undefined' && typeof __BUILD_TIME__ === 'string'
      ? __BUILD_TIME__
      : '';
  const envBuildTime = typeof import.meta.env.VITE_BUILD_TIME === 'string' ? import.meta.env.VITE_BUILD_TIME : '';
  const value = (globalBuildTime || envBuildTime || '').trim();
  return value || '-';
}

/**
 * 获取平台版本与迭代信息（公开接口）
 * 用于右下角悬浮按钮展示
 */
export async function getPlatformVersion(): Promise<PlatformVersion> {
  const fallbackBuildTime = resolveBuildTime();
  try {
    const response = await fetch('/api/v1/infra/platform/version');
    let data: PlatformVersion;
    if (!response.ok) {
      data = getDefaultVersion();
    } else {
      data = await response.json();
    }
    // 优先使用后端返回的发布时刻；仅后端缺失时才使用前端兜底
    return {
      ...data,
      build_time: (data.build_time || '').trim() || fallbackBuildTime,
    };
  } catch {
    const data = getDefaultVersion();
    return {
      ...data,
      build_time: (data.build_time || '').trim() || fallbackBuildTime,
    };
  }
}

function getDefaultVersion(): PlatformVersion {
  const sha = import.meta.env.VITE_GIT_SHA;
  const buildTime = resolveBuildTime();
  return {
    build_time: buildTime,
    git_commit: typeof sha === 'string' && sha ? sha : '',
    git_latest_commit_time: '-',
    git_repo_url: 'https://gitee.com/kuaigeyun/kuaigeyun',
  };
}
