/**
 * 主题状态 Store（派生层）
 *
 * 从 userPreferenceStore 读取主题，合并站点默认，计算 resolved 供 ConfigProvider 使用。
 * 主题数据源：userPreferenceStore.preferences（theme / theme_config）
 * 解析顺序：站点配置 <- 用户偏好 <- 默认值
 */

import { create } from 'zustand';
import { theme } from 'antd';
import { getSiteSetting } from '../services/siteSetting';
import { getToken } from '../utils/auth';
import { useUserPreferenceStore } from './userPreferenceStore';
import { getThemeFromPreferenceCache } from './userPreferenceStore';

const DEFAULT_CONFIG = {
  colorPrimary: '#1890ff',
  borderRadius: 6,
  fontSize: 14,
  compact: false,
  siderBgColor: '',
  headerBgColor: '',
  tabsBgColor: '',
};

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface ThemeConfig {
  colorPrimary?: string;
  borderRadius?: number;
  fontSize?: number;
  compact?: boolean;
  siderBgColor?: string;
  headerBgColor?: string;
  tabsBgColor?: string;
}

export interface ResolvedTheme {
  algorithm:
    | typeof theme.defaultAlgorithm
    | typeof theme.darkAlgorithm
    | Array<typeof theme.defaultAlgorithm | typeof theme.darkAlgorithm | typeof theme.compactAlgorithm>;
  token: {
    colorPrimary?: string;
    borderRadius?: number;
    fontSize?: number;
  };
  isDark: boolean;
  siderBgColor: string;
  headerBgColor: string;
  tabsBgColor: string;
}

function mergeConfig(base: ThemeConfig, override: Partial<ThemeConfig> | null): ThemeConfig {
  if (!override || typeof override !== 'object') return { ...DEFAULT_CONFIG, ...base };
  return {
    ...DEFAULT_CONFIG,
    ...base,
    ...override,
  };
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'dark') return 'dark';
  if (mode === 'auto' && typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function computeResolved(themeMode: ThemeMode, config: ThemeConfig): ResolvedTheme {
  const effectiveMode = resolveTheme(themeMode);
  const baseAlgorithm = effectiveMode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm;
  const algorithm = config.compact ? [baseAlgorithm, theme.compactAlgorithm] : baseAlgorithm;
  const isDark = effectiveMode === 'dark';

  return {
    algorithm,
    token: {
      colorPrimary: config.colorPrimary || DEFAULT_CONFIG.colorPrimary,
      borderRadius: config.borderRadius ?? DEFAULT_CONFIG.borderRadius,
      fontSize: config.fontSize ?? DEFAULT_CONFIG.fontSize,
    },
    isDark,
    siderBgColor: isDark ? '' : (config.siderBgColor || '').trim(),
    headerBgColor: (config.headerBgColor || '').trim(),
    tabsBgColor: (config.tabsBgColor || '').trim(),
  };
}

interface ThemeState {
  theme: ThemeMode;
  config: ThemeConfig;
  resolved: ResolvedTheme;
  initialized: boolean;
  initFromApi: () => Promise<void>;
  applyTheme: (themeMode: ThemeMode, config?: Partial<ThemeConfig>) => void;
  syncFromPreferences: (preferences: Record<string, any>) => void;
  subscribeToSystemTheme: () => () => void;
  clearForLogout: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const doApplyTheme = (themeMode: ThemeMode, configOverride?: Partial<ThemeConfig>) => {
    const { config } = get();
    const mergedConfig = mergeConfig(config, configOverride ?? null);
    const resolved = computeResolved(themeMode, mergedConfig);

    set({ theme: themeMode, config: mergedConfig, resolved });

    document.documentElement.style.colorScheme = resolved.isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', resolved.isDark ? 'dark' : 'light');
  };

  const syncFromPreferences = (preferences: Record<string, any>) => {
    if (!preferences || typeof preferences !== 'object') return;
    const userTheme = (preferences.theme as ThemeMode) || 'light';
    const userConfig = (preferences.theme_config || {}) as Partial<ThemeConfig>;
    const mergedConfig = mergeConfig({}, userConfig);
    doApplyTheme(userTheme, mergedConfig);
  };

  // 初始值：优先从 userPreferenceStore 缓存读取，否则用默认
  const cached = getThemeFromPreferenceCache();
  const initialTheme = (cached?.theme as ThemeMode) || 'light';
  const initialConfig = cached?.theme_config
    ? mergeConfig({}, cached.theme_config as Partial<ThemeConfig>)
    : { ...DEFAULT_CONFIG };
  const initialResolved = computeResolved(initialTheme, initialConfig);

  // 初始化时同步设置 document 属性，确保首屏渲染时 data-theme 已正确
  if (typeof document !== 'undefined') {
    document.documentElement.style.colorScheme = initialResolved.isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', initialResolved.isDark ? 'dark' : 'light');
  }

  return {
    theme: initialTheme,
    config: initialConfig,
    resolved: initialResolved,
    initialized: false,

    initFromApi: async () => {
      if (!getToken()) {
        const cachedTheme = getThemeFromPreferenceCache();
        if (cachedTheme) {
          const merged = mergeConfig({}, cachedTheme.theme_config as Partial<ThemeConfig>);
          doApplyTheme((cachedTheme.theme as ThemeMode) || 'light', merged);
        } else {
          doApplyTheme('light', { ...DEFAULT_CONFIG });
        }
        set({ initialized: true });
        return;
      }

      try {
        const [siteSetting] = await Promise.all([
          getSiteSetting().catch(() => null),
          useUserPreferenceStore.getState().fetchPreferences(),
        ]);

        const siteConfig = (siteSetting?.settings?.theme_config || {}) as Partial<ThemeConfig>;
        const prefs = useUserPreferenceStore.getState().preferences || {};
        const userTheme = (prefs?.theme as ThemeMode) || 'light';
        const userConfig = (prefs?.theme_config || {}) as Partial<ThemeConfig>;

        const mergedConfig = mergeConfig(siteConfig as ThemeConfig, userConfig);
        doApplyTheme(userTheme, mergedConfig);

        set({ initialized: true });
      } catch (e) {
        console.warn('Theme init failed:', e);
        const cachedTheme = getThemeFromPreferenceCache();
        if (cachedTheme) {
          const merged = mergeConfig({}, cachedTheme.theme_config as Partial<ThemeConfig>);
          doApplyTheme((cachedTheme.theme as ThemeMode) || 'light', merged);
        } else {
          doApplyTheme('light', { ...DEFAULT_CONFIG });
        }
        set({ initialized: true });
      }
    },

    applyTheme: (themeMode: ThemeMode, configOverride?: Partial<ThemeConfig>) => {
      const { config } = get();
      const mergedConfig = mergeConfig(config, configOverride ?? null);
      doApplyTheme(themeMode, mergedConfig);

      if (getToken()) {
        useUserPreferenceStore
          .getState()
          .updatePreferences({
            theme: themeMode,
            theme_config: mergedConfig,
          })
          .catch((err) => console.warn('Failed to persist theme:', err));
      }
    },

    syncFromPreferences,

    subscribeToSystemTheme: () => {
      const { theme: mode } = get();
      if (mode !== 'auto') return () => {};

      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => {
        doApplyTheme('auto', get().config);
      };
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    },

    clearForLogout: () => {
      try {
        localStorage.removeItem('riveredge_theme_config');
      } catch (_) {}
      set({
        theme: 'light',
        config: { ...DEFAULT_CONFIG },
        resolved: computeResolved('light', DEFAULT_CONFIG),
        initialized: false,
      });
      doApplyTheme('light', DEFAULT_CONFIG);
    },
  };
});
