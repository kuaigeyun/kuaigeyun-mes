/**
 * 主题状态 Store（派生层）
 *
 * 从 userPreferenceStore 读取主题，合并站点默认，计算 resolved 供 ConfigProvider 使用。
 * 主题数据源：userPreferenceStore.preferences（theme / theme_config）
 * 解析顺序：用户 preferences.theme_config（云端）优先；从未配置过则用 DEFAULT_CONFIG
 * 首帧：localStorage 缓存（rehydrateFromStorage）仅作占位，登录后以 API 为准覆盖
 */

import { create } from 'zustand';
import { theme } from 'antd';
import { getSiteSetting } from '../services/siteSetting';
import { getToken } from '../utils/auth';
import { useUserPreferenceStore } from './userPreferenceStore';
import { getThemeFromPreferenceCache } from './userPreferenceStore';
import { useConfigStore } from './configStore';

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

/** 主题风格：多彩（全量配色）/ 简约（主色 + 灰阶） */
export type ThemeStyle = 'vivid' | 'plain';

export interface ThemeConfig {
  colorPrimary?: string;
  borderRadius?: number;
  fontSize?: number;
  compact?: boolean;
  siderBgColor?: string;
  headerBgColor?: string;
  tabsBgColor?: string;
  themeStyle?: ThemeStyle;
}

export interface ResolvedTheme {
  algorithm: typeof theme.defaultAlgorithm | typeof theme.darkAlgorithm;
  token: {
    colorPrimary?: string;
    borderRadius?: number;
    fontSize?: number;
    colorBorder?: string;
    colorSplit?: string;
  };
  isDark: boolean;
  themeStyle: ThemeStyle;
  siderBgColor: string;
  headerBgColor: string;
  tabsBgColor: string;
}

export function normalizeThemeStyle(value: unknown): ThemeStyle {
  return value === 'plain' ? 'plain' : 'vivid';
}

/** 接口/缓存可能返回字符串数字，Ant Design token 需要 number */
function clampFinite(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeThemeConfig(c: ThemeConfig): ThemeConfig {
  const fs = typeof c.fontSize === 'number' ? c.fontSize : Number(c.fontSize);
  const br = typeof c.borderRadius === 'number' ? c.borderRadius : Number(c.borderRadius);
  return {
    ...c,
    compact: false,
    themeStyle: normalizeThemeStyle(c.themeStyle),
    fontSize: clampFinite(fs, 10, 22, DEFAULT_CONFIG.fontSize),
    borderRadius: clampFinite(br, 0, 24, DEFAULT_CONFIG.borderRadius),
  };
}

/** 用户是否已在云端保存过主题配置（theme_config 非空） */
export function hasCloudThemeConfig(cfg: Partial<ThemeConfig> | null | undefined): boolean {
  if (!cfg || typeof cfg !== 'object') return false;
  return Object.keys(cfg).some((k) => {
    const v = cfg[k as keyof ThemeConfig];
    return v !== undefined && v !== null && v !== '';
  });
}

/** 从云端用户偏好解析主题：有 theme_config 用云端；否则用默认（不叠站点/缓存） */
export function resolveThemeFromPreferences(
  preferences: Record<string, unknown> | null | undefined,
): { theme: ThemeMode; config: ThemeConfig } {
  const prefs = preferences && typeof preferences === 'object' ? preferences : {};
  const userTheme = (prefs.theme as ThemeMode) || 'light';
  const userConfig = (prefs.theme_config || {}) as Partial<ThemeConfig>;
  if (hasCloudThemeConfig(userConfig)) {
    return { theme: userTheme, config: mergeConfig({}, userConfig) };
  }
  return { theme: 'light', config: normalizeThemeConfig({ ...DEFAULT_CONFIG }) };
}

function mergeConfig(base: ThemeConfig, override: Partial<ThemeConfig> | null): ThemeConfig {
  let merged: ThemeConfig;
  if (!override || typeof override !== 'object') {
    merged = { ...DEFAULT_CONFIG, ...base };
  } else {
    merged = {
      ...DEFAULT_CONFIG,
      ...base,
      ...override,
    };
  }
  return normalizeThemeConfig(merged);
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
  const algorithm = baseAlgorithm;
  const isDark = effectiveMode === 'dark';
  const themeStyle = normalizeThemeStyle(config.themeStyle);
  const isPlain = themeStyle === 'plain';

  return {
    algorithm,
    token: {
      colorPrimary: config.colorPrimary || DEFAULT_CONFIG.colorPrimary,
      borderRadius: config.borderRadius ?? DEFAULT_CONFIG.borderRadius,
      fontSize: config.fontSize ?? DEFAULT_CONFIG.fontSize,
      colorBorder: isDark ? '#303030' : '#d9d9d9',
      colorSplit: isDark ? '#262626' : '#f0f0f0',
    },
    isDark,
    themeStyle,
    siderBgColor: isPlain ? '' : isDark ? '' : (config.siderBgColor || '').trim(),
    headerBgColor: isPlain ? '' : (config.headerBgColor || '').trim(),
    tabsBgColor: isPlain ? '' : (config.tabsBgColor || '').trim(),
  };
}

interface ThemeState {
  theme: ThemeMode;
  config: ThemeConfig;
  resolved: ResolvedTheme;
  initialized: boolean;
  loading: boolean;
  initFromApi: () => Promise<void>;
  applyTheme: (themeMode: ThemeMode, config?: Partial<ThemeConfig>, options?: { persist?: boolean }) => void;
  /** 偏好变更时按云端 theme_config 应用；未配置过则用默认主题 */
  syncFromPreferences: (preferences: Record<string, any>) => void;
  subscribeToSystemTheme: () => () => void;
  clearForLogout: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const applyDocumentThemeAttrs = (resolved: ResolvedTheme) => {
    document.documentElement.style.colorScheme = resolved.isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', resolved.isDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme-style', resolved.themeStyle);
  };

  const applyResolvedTheme = (themeMode: ThemeMode, config: ThemeConfig) => {
    const resolved = computeResolved(themeMode, config);
    set({ theme: themeMode, config, resolved });
    applyDocumentThemeAttrs(resolved);
  };

  const doApplyTheme = (themeMode: ThemeMode, configOverride?: Partial<ThemeConfig>) => {
    const { config } = get();
    const mergedConfig = mergeConfig(config, configOverride ?? null);
    const resolved = computeResolved(themeMode, mergedConfig);

    set({ theme: themeMode, config: mergedConfig, resolved });

    applyDocumentThemeAttrs(resolved);
  };

  const syncFromPreferences = (preferences: Record<string, any>) => {
    if (!preferences || typeof preferences !== 'object') return;
    const { theme, config } = resolveThemeFromPreferences(preferences);
    applyResolvedTheme(theme, config);
  };

  // 初始值：优先从 userPreferenceStore 缓存读取，否则用默认
  const cached = getThemeFromPreferenceCache();
  const initialTheme = (cached?.theme as ThemeMode) || 'light';
  const initialConfig = cached?.theme_config
    ? mergeConfig({}, cached.theme_config as Partial<ThemeConfig>)
    : normalizeThemeConfig({ ...DEFAULT_CONFIG });
  const initialResolved = computeResolved(initialTheme, initialConfig);

  // 初始化时同步设置 document 属性，确保首屏渲染时 data-theme 已正确
  if (typeof document !== 'undefined') {
    document.documentElement.style.colorScheme = initialResolved.isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', initialResolved.isDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme-style', initialResolved.themeStyle);
  }

  return {
    theme: initialTheme,
    config: initialConfig,
    resolved: initialResolved,
    initialized: false,
    loading: false,

    initFromApi: async () => {
      const { initialized, loading } = get();
      if (initialized || loading) return;

      if (!getToken()) {
        const cachedTheme = getThemeFromPreferenceCache();
        if (cachedTheme) {
          const { theme, config } = resolveThemeFromPreferences({
            theme: cachedTheme.theme,
            theme_config: cachedTheme.theme_config,
          });
          applyResolvedTheme(theme, config);
        } else {
          applyResolvedTheme('light', normalizeThemeConfig({ ...DEFAULT_CONFIG }));
        }
        set({ initialized: true });
        return;
      }

      set({ loading: true });
      try {
        const [siteSetting] = await Promise.all([
          getSiteSetting().catch(() => null),
          useUserPreferenceStore.getState().fetchPreferences(),
        ]);

        // 复用同一份 siteSetting 给 configStore，避免 app.tsx 再触发一次 /site-setting 请求；
        // 失败（siteSetting 为 null）时不 hydrate，保留 configStore.fetchConfigs 独立重试能力。
        if (siteSetting && siteSetting.settings) {
          try {
            useConfigStore.getState().hydrateFromSettings(siteSetting.settings);
          } catch {
            // 不阻塞主题流程
          }
        }

        const prefs = useUserPreferenceStore.getState().preferences || {};
        const { theme, config } = resolveThemeFromPreferences(prefs);
        applyResolvedTheme(theme, config);

        set({ initialized: true, loading: false });
      } catch (e) {
        console.warn('Theme init failed:', e);
        const cachedTheme = getThemeFromPreferenceCache();
        if (cachedTheme) {
          const { theme, config } = resolveThemeFromPreferences({
            theme: cachedTheme.theme,
            theme_config: cachedTheme.theme_config,
          });
          applyResolvedTheme(theme, config);
        } else {
          applyResolvedTheme('light', normalizeThemeConfig({ ...DEFAULT_CONFIG }));
        }
        set({ initialized: true, loading: false });
      }
    },

    applyTheme: (themeMode: ThemeMode, configOverride?: Partial<ThemeConfig>, options?: { persist?: boolean }) => {
      doApplyTheme(themeMode, configOverride);

      if (options?.persist && getToken()) {
        const persisted = get().config;
        useUserPreferenceStore
          .getState()
          .updatePreferences({
            theme: themeMode,
            theme_config: persisted,
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
      
      // ⚠️ 兼容性修复：Safari < 14 不支持 addEventListener，需使用 addListener
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handler);
      } else {
        (mediaQuery as any).addListener(handler);
      }

      return () => {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', handler);
        } else {
          (mediaQuery as any).removeListener(handler);
        }
      };
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
