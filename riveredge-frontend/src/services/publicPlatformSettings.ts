/**
 * 登录页专用公开平台设置（轻量）
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

const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  platform_name: 'RiverEdge SaaS Framework',
  theme_color: '#1890ff',
};

export async function getPlatformSettingsPublic(): Promise<PlatformSettings> {
  try {
    const url = new URL('/api/v1/infra/platform-settings/public', window.location.origin);
    const tenantDomain = resolveTenantDomain(window.location.pathname, window.location.search);
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

function resolveTenantDomain(pathname: string, search: string): string | null {
  try {
    const queryDomain = new URLSearchParams(search).get('tenant_domain');
    const normalized = (queryDomain || '').trim().toLowerCase();
    if (normalized) return normalized;
  } catch {
    // ignore query parse errors
  }

  const segments = pathname.split('/').filter(Boolean);
  if (!segments.length) return null;
  const reserved = new Set([
    'login',
    'infra',
    'apps',
    'system',
    'personal',
    'init',
    'lock-screen',
  ]);
  // 支持 /kgsoft 或 /kgsoft/login 两种组织访问形态
  if (!reserved.has(segments[0])) return segments[0].toLowerCase();
  if (segments[0] === 'login' && segments[1] && !reserved.has(segments[1])) return segments[1].toLowerCase();
  return null;
}
