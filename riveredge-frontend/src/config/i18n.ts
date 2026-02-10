/**
 * i18n 配置文件
 * 
 * 集成 react-i18next，从后端语言管理获取翻译内容
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getTranslations } from '../services/language';
import { getUserPreference } from '../services/userPreference';

// 默认语言包（本地静态文件，作为后备）
import zhCN from '../locales/zh-CN';
import enUS from '../locales/en-US';

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
    
    // 资源（本地静态文件作为后备）
    resources: {
      'zh-CN': {
        translation: zhCN,
      },
      'en-US': {
        translation: enUS,
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

/**
 * 加载用户选择的语言
 * 
 * 从用户偏好设置中读取语言设置，并加载对应的翻译内容
 */
export async function loadUserLanguage(): Promise<void> {
  try {
    // 获取用户偏好设置
    const preference = await getUserPreference().catch((error) => {
      // 如果是 401 错误，静默忽略（token 可能在其他地方被验证）
      if (error?.response?.status === 401) {
        console.warn('⚠️ 用户语言偏好设置加载失败（401），使用默认语言');
        return null;
      }
      throw error; // 其他错误重新抛出
    });

    const languageCode = preference?.preferences?.language || 'zh-CN';

    // 切换到用户选择的语言
    await i18n.changeLanguage(languageCode);

    // 从后端加载翻译内容
    try {
      const response = await getTranslations(languageCode);
      if (response.translations) {
        // 将后端翻译内容添加到 i18n 资源中
        i18n.addResourceBundle(languageCode, 'translation', response.translations, true, true);
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
  try {
    const response = await getTranslations(currentLanguage);
    if (response.translations) {
      // 更新 i18n 资源
      i18n.addResourceBundle(currentLanguage, 'translation', response.translations, true, true);
    }
  } catch (error) {
    console.warn(`Failed to refresh translations for ${currentLanguage}:`, error);
  }
}

export default i18n;


