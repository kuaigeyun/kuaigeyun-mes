/**
 * 租户默认语言缓存与首帧解析
 *
 * 加载时序（与 themeStore 类似，但租户默认先于个人偏好占位）：
 * 1. 首帧：个人偏好缓存（若有）否则租户默认缓存
 * 2. API：先应用租户默认（语言管理 is_default / 站点 default_language），再拉个人偏好并覆盖
 */

import { getPersistedConfigs } from '../stores/configStore';
import { getLanguageFromPreferenceCache } from '../stores/userPreferenceStore';
import { getTenantId, getUserInfo } from './auth';

/** 当前注册的界面语言。下架语言包时把对应 code 移到 SHELVED_UI_LANGUAGES。 */
export const SUPPORTED_UI_LANGUAGES = ['zh-CN', 'zh-Hant', 'en-US', 'ja-JP', 'vi-VN', 'lo-LA'] as const;
export type SupportedUiLanguage = (typeof SUPPORTED_UI_LANGUAGES)[number];

/** 语言切换器展示名（各语言自称）。 */
export const LANGUAGE_MAP: Record<SupportedUiLanguage, string> = {
  'zh-CN': '简体中文',
  'zh-Hant': '繁體中文',
  'en-US': 'English',
  'ja-JP': '日本語',
  'vi-VN': 'Tiếng Việt',
  'lo-LA': 'ພາສາລາວ',
};

/** 登录页工具栏缩写。 */
export const LANGUAGE_TOOLBAR_SHORT: Record<SupportedUiLanguage, string> = {
  'zh-CN': '中',
  'zh-Hant': '繁',
  'en-US': 'EN',
  'ja-JP': '日',
  'vi-VN': 'VI',
  'lo-LA': 'ລາວ',
};

/** 语言包已就绪但当前不注册（不删文件）。启用时移入 SUPPORTED_UI_LANGUAGES。 */
export const SHELVED_UI_LANGUAGES = [] as const;

const FALLBACK_LANGUAGE: SupportedUiLanguage = 'zh-CN';
const GUEST_LANGUAGE_KEY = 'riveredge-guest-language';
const TENANT_DEFAULT_LANGUAGE_KEY_PREFIX = 'riveredge-tenant-default-language';

const SUPPORTED_LANGUAGE_SET = new Set<string>(SUPPORTED_UI_LANGUAGES);

export function normalizeUiLanguage(code: unknown): SupportedUiLanguage | null {
  if (typeof code !== 'string' || !SUPPORTED_LANGUAGE_SET.has(code)) return null;
  return code as SupportedUiLanguage;
}

/**
 * 租户号只从存储层取（tenant_id → user_info）。
 *
 * 本模块在 config/i18n 的模块求值期就被调用，而会话 store 反过来依赖 i18n；
 * 走 getSessionCurrentUser() 会形成 globalStore → i18n → 本模块 → globalStore 的环，
 * 首帧直接 TDZ 崩在「Cannot access 'useGlobalStore' before initialization」。
 * 首帧时 store 尚未灌入，其内容本就来自这两个存储键，读存储不丢信息。
 */
function getTenantDefaultLanguageStorageKey(): string | null {
  if (typeof window === 'undefined') return null;
  const tenantId = getTenantId() ?? getUserInfo()?.tenant_id;
  if (tenantId == null || String(tenantId).trim() === '') return null;
  return `${TENANT_DEFAULT_LANGUAGE_KEY_PREFIX}-${tenantId}`;
}

/** 租户默认语言 localStorage（语言管理 is_default / 站点 default_language 写入） */
export function getTenantDefaultLanguageFromCache(): SupportedUiLanguage | null {
  const key = getTenantDefaultLanguageStorageKey();
  if (!key) return null;
  try {
    return normalizeUiLanguage(localStorage.getItem(key));
  } catch {
    return null;
  }
}

export function cacheTenantDefaultLanguage(code: string): void {
  const normalized = normalizeUiLanguage(code);
  const key = getTenantDefaultLanguageStorageKey();
  if (!normalized || !key) return;
  try {
    localStorage.setItem(key, normalized);
  } catch {
    /* ignore */
  }
}

/** 同步读取租户默认：语言管理缓存 > 站点设置持久化缓存 */
export function resolveTenantDefaultFromCache(): SupportedUiLanguage | null {
  return (
    getTenantDefaultLanguageFromCache() ??
    normalizeUiLanguage(getPersistedConfigs()?.default_language)
  );
}

/**
 * 首帧语言：已有个人偏好缓存则直接用；否则用租户默认占位（避免无偏好时先 zh-CN 再切 en-US）
 */
export function resolveInitialLanguage(): SupportedUiLanguage {
  const userCached = normalizeUiLanguage(getLanguageFromPreferenceCache());
  if (userCached) return userCached;
  return resolveTenantDefaultFromCache() ?? FALLBACK_LANGUAGE;
}

export function getGuestLanguageStorageKey(): string {
  return GUEST_LANGUAGE_KEY;
}

export function getGuestLanguageFromSession(): SupportedUiLanguage | null {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeUiLanguage(sessionStorage.getItem(GUEST_LANGUAGE_KEY));
  } catch {
    return null;
  }
}

/** 登录页首帧：会话临时选择 > 租户默认 > zh-CN */
export function resolveLoginInitialLanguage(): SupportedUiLanguage {
  return getGuestLanguageFromSession() ?? resolveTenantDefaultFromCache() ?? FALLBACK_LANGUAGE;
}

export { FALLBACK_LANGUAGE as UI_LANGUAGE_FALLBACK };
