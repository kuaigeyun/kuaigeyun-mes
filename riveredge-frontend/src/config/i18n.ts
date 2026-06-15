/**
 * i18n 配置文件
 *
 * 集成 react-i18next，从后端语言管理获取翻译内容
 * 菜单相关翻译（path.*、app.*.menu.*）优先使用本地 locale，避免后端历史错误值覆盖
 *
 * 语言数据源：userPreferenceStore.preferences.language
 * 首帧：localStorage 缓存（rehydrateFromStorage / getLanguageFromPreferenceCache）仅作占位，登录后以 API 为准覆盖
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getTranslations } from '../services/language';
import { getToken } from '../utils/auth';
import {
  getLanguageFromPreferenceCache,
  useUserPreferenceStore,
} from '../stores/userPreferenceStore';

// 默认语言包（zh-CN 同步加载，en-US 懒加载以减小主包体积）
import zhCN from '../locales/zh-CN';

/** 本地 locale 映射（en-US 在首次切换时动态加载） */
const LOCALE_BUNDLES: Record<string, Record<string, string>> = {
  'zh-CN': zhCN,
};

/**
 * 合并翻译：以下 key 优先使用本地 locale，其余使用后端值
 * - path.*、app.*.menu.*：避免后端历史错误覆盖菜单/路径文案
 * - pages.system.applications.*：应用中心卡片等 UI 随前端版本迭代，后端语言库易残留旧文案
 * - components.tenantSelection.*：登录页多组织选择弹窗；后端语言包常不含此类 key，合并后否则会显示原始 key
 * - pages.personal.messages.*：我的消息页文案随前端迭代，后端语言库易残留旧文案
 * - pages.system.files.*：文件管理文件夹 category 展示名
 */
function mergeTranslationsWithMenuPriority(
  backendTranslations: Record<string, string>,
  languageCode: string
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

// 语言代码到语言名称的映射（仅保留简体中文和英语）
export const LANGUAGE_MAP: Record<string, string> = {
  'zh-CN': '简体中文',
  'en-US': 'English',
};

const DEFAULT_LANGUAGE = 'zh-CN';

/** 从用户偏好解析语言；无设置时回退默认语言 */
export function resolveLanguageFromPreferences(
  preferences: Record<string, unknown> | null | undefined,
): string {
  const language = preferences?.language;
  return typeof language === 'string' && language ? language : DEFAULT_LANGUAGE;
}

let languageInitialized = false;
let languageLoading = false;

export function isLanguageInitialized(): boolean {
  return languageInitialized;
}

// 初始化 i18n
i18n
  .use(initReactI18next)
  .init({
    // 首帧占位：优先从当前账户偏好缓存读取，与 themeStore 策略一致
    lng: getLanguageFromPreferenceCache() || DEFAULT_LANGUAGE,
    fallbackLng: 'zh-CN',
    
    // 调试模式（关闭调试日志）
    debug: false,
    
    // 插值配置
    interpolation: {
      escapeValue: false, // React 已经转义了
    },

    // 适配扁平化 key 结构
    keySeparator: false,
    nsSeparator: false,
    
    // 资源（仅默认语言同步加载，en-US 在首次切换时懒加载）
    resources: {
      'zh-CN': {
        translation: zhCN,
      },
    },
    
    // 后端配置（从语言管理获取翻译）
    backend: {
      // 自定义后端加载器
      loadTranslations: async (language: string) => {
        try {
          // 从后端获取翻译内容
          const response = await getTranslations(language);
          return response.translations || {};
        } catch (error) {
          console.warn(`Failed to load translations for ${language}:`, error);
          // 如果后端加载失败，返回空对象，使用本地后备资源
          return {};
        }
      },
    },
  });

/** 确保语言包已加载（en-US 懒加载） */
async function ensureLanguageLoaded(languageCode: string): Promise<void> {
  if (languageCode === 'en-US' && !i18n.hasResourceBundle('en-US', 'translation')) {
    const { default: enUS } = await import('../locales/en-US');
    LOCALE_BUNDLES['en-US'] = enUS;
    i18n.addResourceBundle('en-US', 'translation', enUS, true, true);
  }
}

// 包装 changeLanguage，在切换前确保目标语言已加载
const originalChangeLanguage = i18n.changeLanguage.bind(i18n);
i18n.changeLanguage = async (language: string) => {
  await ensureLanguageLoaded(language);
  return originalChangeLanguage(language);
};

/**
 * 加载用户选择的语言
 * 
 * 从用户偏好设置中读取语言设置，并加载对应的翻译内容
 * ⚠️ 未登录时不调用需认证的 API，避免 401 触发 window.location 导致登录页无限刷新
 */
/**
 * 等待 userPreferenceStore 初始化完成（已有结果或 loading 中订阅直到完成）。
 * 最长等待 3s，超时走降级，避免偶发接口挂起阻塞首屏。
 */
async function waitForUserPreferences(timeoutMs = 3000): Promise<void> {
  const store = useUserPreferenceStore.getState();
  if (store.initialized) return;
  // 还没人触发过，则主动触发一次（内部有 loading/initialized 短路）
  if (!store.loading) {
    void useUserPreferenceStore.getState().fetchPreferences();
  }
  await new Promise<void>((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useUserPreferenceStore.subscribe((state) => {
      if (state.initialized) {
        if (timer) clearTimeout(timer);
        unsub();
        resolve();
      }
    });
    timer = setTimeout(() => {
      unsub();
      resolve();
    }, timeoutMs);
  });
}

async function waitForLanguageInit(timeoutMs = 3000): Promise<void> {
  if (languageInitialized) return;
  await new Promise<void>((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = () => {
      if (languageInitialized) {
        if (timer) clearTimeout(timer);
        resolve();
      }
    };
    const interval = setInterval(check, 50);
    timer = setTimeout(() => {
      clearInterval(interval);
      resolve();
    }, timeoutMs);
    check();
  });
}

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

/** 偏好变更时同步 i18n；数据源 userPreferenceStore.preferences.language */
export async function syncLanguageFromPreferences(
  preferences: Record<string, unknown> | null | undefined,
): Promise<void> {
  const languageCode = resolveLanguageFromPreferences(preferences);
  if (i18n.language === languageCode) {
    if (getToken() && !i18n.hasResourceBundle(languageCode, 'translation')) {
      await applyLanguage(languageCode);
    }
    return;
  }
  await applyLanguage(languageCode);
}

/** 登录后从 API 拉取偏好并应用语言；首帧占位见 localStorage 缓存 */
export async function initLanguageFromApi(): Promise<void> {
  if (languageInitialized) return;

  if (!getToken()) {
    const cached = getLanguageFromPreferenceCache();
    await applyLanguage(cached ?? DEFAULT_LANGUAGE, { loadBackendTranslations: false });
    languageInitialized = true;
    return;
  }

  if (languageLoading) {
    await waitForLanguageInit();
    return;
  }

  languageLoading = true;
  try {
    // 复用 userPreferenceStore，避免 themeStore.initFromApi 和本函数同窗口内重复请求 /user-preferences。
    await waitForUserPreferences();
    const prefs = useUserPreferenceStore.getState().preferences;
    await applyLanguage(resolveLanguageFromPreferences(prefs));
    languageInitialized = true;
  } catch (error) {
    console.warn('Failed to init language from user preferences:', error);
    const cached = getLanguageFromPreferenceCache();
    await applyLanguage(cached ?? DEFAULT_LANGUAGE);
    languageInitialized = true;
  } finally {
    languageLoading = false;
  }
}

/** 切换语言并持久化到 userPreferenceStore（与 themeStore.applyTheme persist 一致） */
export async function applyLanguageWithPersist(languageCode: string): Promise<void> {
  await applyLanguage(languageCode);
  if (!getToken()) return;
  await useUserPreferenceStore.getState().updatePreferences({ language: languageCode });
}

/** 登出时重置语言初始化状态 */
export function clearLanguageForLogout(): void {
  languageInitialized = false;
  languageLoading = false;
  void i18n.changeLanguage(DEFAULT_LANGUAGE);
}

/**
 * @deprecated 请使用 initLanguageFromApi
 */
export async function loadUserLanguage(): Promise<void> {
  await initLanguageFromApi();
}

/**
 * 刷新当前语言的翻译内容
 * 
 * 从后端重新加载当前语言的翻译内容
 */
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


