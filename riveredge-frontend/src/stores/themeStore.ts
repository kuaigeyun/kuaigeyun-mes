/**
 * 主题状态 Store
 *
 * 单一数据源，集中管理主题模式与配置。
 * 解析顺序：站点配置 <- 用户偏好 <- 默认值
 */

import { create } from 'zustand';
import { theme } from 'antd';
import { getSiteSetting } from '../services/siteSetting';
import { getUserPreference } from '../services/userPreference';
import { getToken } from '../utils/auth';

const THEME_CONFIG_STORAGE_KEY = 'riveredge_theme_config';
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
  };

  const fallback = readFallbackFromStorage();
  const initialTheme = (fallback?.theme as ThemeMode) || 'light';
  const initialConfig = fallback?.config ?? { ...DEFAULT_CONFIG };
  const initialResolved = computeResolved(initialTheme, initialConfig);

  return {
    theme: initialTheme,
    config: initialConfig,
    resolved: initialResolved,
    initialized: false,

    initFromApi: async () => {
      if (!getToken()) {
        const fallback = readFallbackFromStorage();
        if (fallback) {
          doApplyTheme(fallback.theme as ThemeMode, fallback.config);
        } else {
          doApplyTheme('light', DEFAULT_CONFIG);
        }
        set({ initialized: true });
        return;
      }

      try {
        const [siteSetting, userPreference] = await Promise.all([
          getSiteSetting().catch(() => null),
          getUserPreference().catch(() => null),
        ]);

        const siteConfig = (siteSetting?.settings?.theme_config || {}) as Partial<ThemeConfig>;
        const userPrefs = userPreference?.preferences;
        const userTheme = (userPrefs?.theme as ThemeMode) || 'light';
        const userConfig = (userPrefs?.theme_config || {}) as Partial<ThemeConfig>;

        const mergedConfig = mergeConfig(siteConfig as ThemeConfig, userConfig);
        doApplyTheme(userTheme, mergedConfig);

        set({ initialized: true });
      } catch (e) {
        console.warn('Theme init failed:', e);
        const fallback = readFallbackFromStorage();
        if (fallback) {
          doApplyTheme(fallback.theme as ThemeMode, fallback.config);
        } else {
          doApplyTheme('light', DEFAULT_CONFIG);
        }
        set({ initialized: true });
      }
    },

    applyTheme: (themeMode: ThemeMode, configOverride?: Partial<ThemeConfig>) => {
      doApplyTheme(themeMode, configOverride);
    },

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
        localStorage.removeItem(THEME_CONFIG_STORAGE_KEY);
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

function readFallbackFromStorage(): { theme: string; config: ThemeConfig } | null {
  try {
    const raw = localStorage.getItem(THEME_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const themeMode = parsed.theme || 'light';
    const config = mergeConfig({}, parsed as Partial<ThemeConfig>);
    return { theme: themeMode, config };
  } catch {
    return null;
  }
}
