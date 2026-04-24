/**
 * 登录页专用公开平台设置（轻量）
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

const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  platform_name: 'RiverEdge SaaS Framework',
  theme_color: '#1890ff',
};

export async function getPlatformSettingsPublic(): Promise<PlatformSettings> {
  try {
    const response = await fetch('/api/v1/infra/platform-settings/public');
    if (!response.ok) return DEFAULT_PLATFORM_SETTINGS;
    return response.json();
  } catch {
    return DEFAULT_PLATFORM_SETTINGS;
  }
}
