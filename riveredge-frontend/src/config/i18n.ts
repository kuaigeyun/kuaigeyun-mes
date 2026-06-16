/**
 * i18n 配置文件
 *
 * 语言加载时序（结构对齐 themeStore，优先级：个人 language > 租户默认 > zh-CN）：
 * 1. 模块同步 init：resolveInitialLanguage()（个人缓存 || 租户默认缓存）
 * 2. initLanguageFromApi：先拉租户默认并应用，再 fetchPreferences，有个人 language 则覆盖
 * 3. syncLanguageFromPreferences：偏好变更时按 resolveLanguageFromCloud 同步
 *
 * 租户默认来源：语言管理 is_default > 站点 settings.default_language
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getSiteSetting } from '../services/siteSetting';
import { getTranslations, getLanguageList, type Language } from '../services/language';
import { getToken } from '../utils/auth';
import {
  getLanguageFromPreferenceCache,
  useUserPreferenceStore,
} from '../stores/userPreferenceStore';
import { useConfigStore } from '../stores/configStore';
import {
  cacheTenantDefaultLanguage,
  normalizeUiLanguage,
  resolveInitialLanguage,
  resolveTenantDefaultFromCache,
  UI_LANGUAGE_FALLBACK,
  type SupportedUiLanguage,
} from '../utils/localeBootstrap';
import { syncEnglishUiFont } from '../constants/fonts';

import zhCN from '../locales/zh-CN';

const LOCALE_BUNDLES: Record<string, Record<string, string>> = {
  'zh-CN': zhCN,
};

const FALLBACK_LANGUAGE: SupportedUiLanguage = UI_LANGUAGE_FALLBACK;

/** 最近一次云端租户默认语言（语言管理 is_default / 站点 default_language） */
let tenantDefaultLanguage: SupportedUiLanguage | null = null;
/** 最近一次站点 settings，供 sync 回退 */
let siteLanguageSettings: Record<string, unknown> | null = null;

function mergeTranslationsWithMenuPriority(
  backendTranslations: Record<string, string>,
  languageCode: string,
): Record<string, string> {
  const local = LOCALE_BUNDLES[languageCode] || {};
  const merged = { ...backendTranslations };
  for (const key of Object.keys(local)) {
    if (!local[key]) continue;
    const useLocal =
      key.startsWith('path.') ||
      (key.startsWith('app.') && key.includes('.menu.')) ||
      key.startsWith('pages.system.applications.') ||
      key.startsWith('components.tenantSelection.') ||
      key.startsWith('app.kuaizhizao.quotation.') ||
      key.startsWith('pages.personal.messages.') ||
      key.startsWith('pages.system.files.') ||
      key.startsWith('dashboard.businessBoard.');
    if (useLocal) {
      merged[key] = local[key];
    }
  }
  return merged;
}

export const LANGUAGE_MAP: Record<string, string> = {
  'zh-CN': '简体中文',
  'en-US': 'English',
};

function resolveTenantDefaultFromCloud(
  siteSettings?: Record<string, unknown> | null,
  languages?: Language[] | null,
): SupportedUiLanguage {
  const fromLangMgmt = normalizeUiLanguage(languages?.find((item) => item.is_default)?.code);
  if (fromLangMgmt) return fromLangMgmt;

  const site = siteSettings && typeof siteSettings === 'object' ? siteSettings : {};
  const fromSite = normalizeUiLanguage(site.default_language);
  if (fromSite) return fromSite;

  return resolveTenantDefaultFromCache() ?? FALLBACK_LANGUAGE;
}

/** 个人 language 优先，否则租户默认 */
export function resolveLanguageFromCloud(
  userPreferences: Record<string, unknown> | null | undefined,
  siteSettings?: Record<string, unknown> | null,
  tenantDefault?: SupportedUiLanguage | null,
): string {
  const prefs = userPreferences && typeof userPreferences === 'object' ? userPreferences : {};
  const userLang = prefs.language;
  if (typeof userLang === 'string' && userLang) {
    return normalizeUiLanguage(userLang) ?? userLang;
  }

  const tenant =
    tenantDefault ??
    tenantDefaultLanguage ??
    resolveTenantDefaultFromCloud(siteSettings ?? siteLanguageSettings, null);
  return tenant;
}

/** @deprecated 请使用 resolveLanguageFromCloud */
export function resolveLanguageFromPreferences(
  preferences: Record<string, unknown> | null | undefined,
  tenantDefault?: string | null,
): string {
  return resolveLanguageFromCloud(
    preferences,
    siteLanguageSettings,
    normalizeUiLanguage(tenantDefault),
  );
}

let languageInitialized = false;
let languageLoading = false;

export function isLanguageInitialized(): boolean {
  return languageInitialized;
}

function buildInitResources(languageCode: SupportedUiLanguage): Record<string, { translation: Record<string, string> }> {
  const resources: Record<string, { translation: Record<string, string> }> = {
    'zh-CN': { translation: zhCN },
  };
  if (languageCode === 'en-US' && LOCALE_BUNDLES['en-US']) {
    resources['en-US'] = { translation: LOCALE_BUNDLES['en-US'] };
  }
  return resources;
}

async function ensureLanguageLoaded(languageCode: string): Promise<void> {
  if (languageCode === 'en-US' && !LOCALE_BUNDLES['en-US']) {
    const { default: enUS } = await import('../locales/en-US');
    LOCALE_BUNDLES['en-US'] = enUS;
    if (i18n.isInitialized) {
      i18n.addResourceBundle('en-US', 'translation', enUS, true, true);
    }
  }
}

function preloadLanguageBundleIfNeeded(languageCode: SupportedUiLanguage): void {
  if (languageCode === 'en-US') {
    void ensureLanguageLoaded('en-US').then(() => {
      if (i18n.language !== 'en-US') {
        void i18n.changeLanguage('en-US');
      }
    });
  }
}

const initialLang = resolveInitialLanguage();

i18n.use(initReactI18next).init({
  lng: initialLang,
  fallbackLng: FALLBACK_LANGUAGE,
  debug: false,
  interpolation: { escapeValue: false },
  keySeparator: false,
  nsSeparator: false,
  resources: buildInitResources(initialLang),
  backend: {
    loadTranslations: async (language: string) => {
      try {
        const response = await getTranslations(language);
        return response.translations || {};
      } catch (error) {
        console.warn(`Failed to load translations for ${language}:`, error);
        return {};
      }
    },
  },
});

preloadLanguageBundleIfNeeded(initialLang);
syncEnglishUiFont(initialLang);

const originalChangeLanguage = i18n.changeLanguage.bind(i18n);
i18n.changeLanguage = async (language: string) => {
  await ensureLanguageLoaded(language);
  const result = await originalChangeLanguage(language);
  syncEnglishUiFont(language);
  return result;
};

async function applyLanguage(
  languageCode: string,
  options?: { loadBackendTranslations?: boolean },
): Promise<void> {
  await i18n.changeLanguage(languageCode);

  if (options?.loadBackendTranslations === false || !getToken()) return;

  try {
    const response = await getTranslations(languageCode);
    if (response.translations) {
      const merged = mergeTranslationsWithMenuPriority(response.translations, languageCode);
      i18n.addResourceBundle(languageCode, 'translation', merged, true, true);
    }
  } catch (error) {
    console.warn(`Failed to load translations from backend for ${languageCode}:`, error);
  }
}

/** 偏好变更时同步；有个人 language 则覆盖租户默认 */
export async function syncLanguageFromPreferences(
  preferences: Record<string, unknown> | null | undefined,
): Promise<void> {
  const languageCode = resolveLanguageFromCloud(preferences, siteLanguageSettings, tenantDefaultLanguage);
  if (i18n.language === languageCode) {
    if (getToken() && !i18n.hasResourceBundle(languageCode, 'translation')) {
      await applyLanguage(languageCode);
    }
    return;
  }
  await applyLanguage(languageCode);
}

/**
 * 登录后初始化语言：先租户默认，再个人偏好（与 themeStore.initFromApi 并行挂载，不阻塞 React）
 */
export async function initLanguageFromApi(): Promise<void> {
  if (languageInitialized || languageLoading) return;

  if (!getToken()) {
    await applyLanguage(resolveInitialLanguage(), { loadBackendTranslations: false });
    languageInitialized = true;
    return;
  }

  languageLoading = true;
  try {
    // 阶段 1：租户默认语言（语言管理 is_default + 站点 default_language）
    const [siteSetting, languageListResponse] = await Promise.all([
      getSiteSetting().catch(() => null),
      getLanguageList({ page_size: 20 }).catch(() => null),
    ]);

    const siteSettings =
      siteSetting?.settings && typeof siteSetting.settings === 'object'
        ? siteSetting.settings
        : null;

    if (siteSettings) {
      try {
        useConfigStore.getState().hydrateFromSettings(siteSettings);
      } catch {
        // 不阻塞语言流程
      }
    }

    siteLanguageSettings = siteSettings;
    const tenantDefault = resolveTenantDefaultFromCloud(
      siteSettings,
      languageListResponse?.items ?? null,
    );
    tenantDefaultLanguage = tenantDefault;
    cacheTenantDefaultLanguage(tenantDefault);

    await applyLanguage(tenantDefault);

    // 阶段 2：个人偏好（有个人 language 时覆盖租户默认）
    await useUserPreferenceStore.getState().fetchPreferences();
    const prefs = useUserPreferenceStore.getState().preferences || {};
    const finalLanguage = resolveLanguageFromCloud(prefs, siteSettings, tenantDefault);
    if (finalLanguage !== tenantDefault) {
      await applyLanguage(finalLanguage);
    }

    languageInitialized = true;
  } catch (error) {
    console.warn('Failed to init language:', error);
    await applyLanguage(resolveInitialLanguage());
    languageInitialized = true;
  } finally {
    languageLoading = false;
  }
}

export async function applyLanguageWithPersist(languageCode: string): Promise<void> {
  await applyLanguage(languageCode);
  if (!getToken()) return;
  await useUserPreferenceStore.getState().updatePreferences({ language: languageCode });
}

export function clearLanguageForLogout(): void {
  languageInitialized = false;
  languageLoading = false;
  siteLanguageSettings = null;
  tenantDefaultLanguage = null;
  const lang = resolveTenantDefaultFromCache() ?? FALLBACK_LANGUAGE;
  void i18n.changeLanguage(lang);
}

/** @deprecated 请使用 initLanguageFromApi */
export async function loadUserLanguage(): Promise<void> {
  await initLanguageFromApi();
}

export async function refreshTranslations(): Promise<void> {
  const currentLanguage = i18n.language;
  await ensureLanguageLoaded(currentLanguage);
  try {
    const response = await getTranslations(currentLanguage);
    if (response.translations) {
      const merged = mergeTranslationsWithMenuPriority(response.translations, currentLanguage);
      i18n.addResourceBundle(currentLanguage, 'translation', merged, true, true);
    }
  } catch (error) {
    console.warn(`Failed to refresh translations for ${currentLanguage}:`, error);
  }
}

export default i18n;
