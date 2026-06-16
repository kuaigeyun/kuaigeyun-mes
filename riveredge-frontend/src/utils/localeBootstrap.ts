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

export const SUPPORTED_UI_LANGUAGES = ['zh-CN', 'en-US', 'zh-Hant', 'ja-JP', 'vi-VN'] as const;
export type SupportedUiLanguage = (typeof SUPPORTED_UI_LANGUAGES)[number];

const FALLBACK_LANGUAGE: SupportedUiLanguage = 'zh-CN';
const GUEST_LANGUAGE_KEY = 'riveredge-guest-language';
const TENANT_DEFAULT_LANGUAGE_KEY_PREFIX = 'riveredge-tenant-default-language';

const SUPPORTED_LANGUAGE_SET = new Set<string>(SUPPORTED_UI_LANGUAGES);

export function normalizeUiLanguage(code: unknown): SupportedUiLanguage | null {
  if (typeof code !== 'string' || !SUPPORTED_LANGUAGE_SET.has(code)) return null;
  return code as SupportedUiLanguage;
}

function getTenantDefaultLanguageStorageKey(): string | null {
  if (typeof window === 'undefined') return null;
  const tenantId = getTenantId() ?? getUserInfo()?.tenant_id ?? getUserInfo()?.tenantId;
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
