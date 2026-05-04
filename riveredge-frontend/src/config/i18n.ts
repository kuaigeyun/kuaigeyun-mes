/**
 * i18n 配置文件
 * 
 * 集成 react-i18next，从后端语言管理获取翻译内容
 * 菜单相关翻译（path.*、app.*.menu.*）优先使用本地 locale，避免后端历史错误值覆盖
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getTranslations } from '../services/language';
import { getToken } from '../utils/auth';
import { useUserPreferenceStore } from '../stores/userPreferenceStore';

// 默认语言包（zh-CN 同步加载，en-US 懒加载以减小主包体积）
import zhCN from '../locales/zh-CN';

/** 本地 locale 映射（en-US 在首次切换时动态加载） */
const LOCALE_BUNDLES: Record<string, Record<string, string>> = {
  'zh-CN': zhCN,
};

/**
 * 合并翻译：以下 key 优先使用本地 locale，其余使用后端值
 * - path.*、app.*.menu.*：避免后端历史错误覆盖菜单/路径文案
 * - components.tenantSelection.*：登录页多组织选择弹窗；后端语言包常不含此类 key，合并后否则会显示原始 key
 * - app.kuaizhizao.quotation.*：报价单词条随版本迭代快，语言管理里易残留旧文案（如「另存为新版本」），以仓库 locale 为准
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
      key.startsWith('components.tenantSelection.') ||
      key.startsWith('app.kuaizhizao.quotation.');
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

// 初始化 i18n
i18n
  .use(initReactI18next)
  .init({
    // 默认语言
    lng: 'zh-CN',
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

export async function loadUserLanguage(): Promise<void> {
  try {
    if (!getToken()) {
      await i18n.changeLanguage('zh-CN');
      return;
    }

    // 复用 userPreferenceStore，避免 themeStore.initFromApi 和本函数同窗口内重复请求 /user-preferences。
    await waitForUserPreferences();
    const prefs = useUserPreferenceStore.getState().preferences as
      | { language?: unknown }
      | null;
    const cachedLang = prefs?.language;
    const languageCode = typeof cachedLang === 'string' && cachedLang ? cachedLang : 'zh-CN';

    // 切换到用户选择的语言
    await i18n.changeLanguage(languageCode);

    // 从后端加载翻译内容（菜单 key 优先使用本地 locale）
    try {
      const response = await getTranslations(languageCode);
      if (response.translations) {
        const merged = mergeTranslationsWithMenuPriority(response.translations, languageCode);
        i18n.addResourceBundle(languageCode, 'translation', merged, true, true);
      }
    } catch (error) {
      console.warn(`Failed to load translations from backend for ${languageCode}:`, error);
      // 如果后端加载失败，使用本地后备资源
    }
  } catch (error) {
    console.warn('Failed to load user language preference:', error);
    // 如果获取用户偏好失败，使用默认语言
    await i18n.changeLanguage('zh-CN');
  }
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


