/**
 * 登录页专用公开平台设置（轻量）
 */

import { resolveTenantDomainFromUrl } from '../utils/tenantDomainAccess';

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
  /** 平台默认登录租户（私有单体部署可跳过企微选组织） */
  default_tenant_id?: number | null;
  float_button_enabled?: boolean;
  /** 是否显示顶栏用户菜单中的版权声明入口 */
  copyright_menu_enabled?: boolean;
  /** 是否显示应用中心定制应用空态的商务咨询二维码（默认否） */
  custom_apps_contact_qr_enabled?: boolean;
  login_guest_enabled?: boolean;
  login_client_win_enabled?: boolean;
  login_client_android_enabled?: boolean;
  login_quick_enabled?: boolean;
  enable_register?: boolean;
  /** 站点时区（infra_settings.TIMEZONE，只读；写入 configs.timezone） */
  timezone?: string;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  platform_name: 'RiverEdge SaaS Framework',
  theme_color: '#1890ff',
};

export async function getPlatformSettingsPublic(): Promise<PlatformSettings> {
  try {
    const url = new URL('/api/v1/infra/platform-settings/public', window.location.origin);
    const tenantDomain = resolveTenantDomainFromUrl();
    if (tenantDomain) {
      url.searchParams.set('tenant_domain', tenantDomain);
    }
    const response = await fetch(url.toString());
    if (!response.ok) return DEFAULT_PLATFORM_SETTINGS;
    return response.json();
  } catch {
    return DEFAULT_PLATFORM_SETTINGS;
  }
}

