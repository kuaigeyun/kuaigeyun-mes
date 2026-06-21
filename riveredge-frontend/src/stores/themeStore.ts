/**
 * 主题状态 Store（派生层）
 *
 * 从 userPreferenceStore 读取主题，合并站点默认，计算 resolved 供 ConfigProvider 使用。
 * 主题数据源：userPreferenceStore.preferences（theme / theme_config）
 * 解析顺序：用户 preferences.theme_config（云端）> 站点 settings.theme_config / theme_color（云端）> DEFAULT_CONFIG
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
  themeStyle: 'vivid' as ThemeStyle,
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
    colorBorderSecondary?: string;
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

function buildSiteThemeConfig(site: Record<string, unknown>): Partial<ThemeConfig> {
  const siteThemeConfig = (site.theme_config || {}) as Partial<ThemeConfig>;
  const legacyThemeColor = site.theme_color;
  if (
    typeof legacyThemeColor === 'string' &&
    legacyThemeColor.trim() &&
    !siteThemeConfig.colorPrimary
  ) {
    return { ...siteThemeConfig, colorPrimary: legacyThemeColor.trim() };
  }
  return siteThemeConfig;
}

/** 从云端解析主题：用户偏好 theme_config 优先，其次站点 theme_config / theme_color */
export function resolveThemeFromCloud(
  userPreferences: Record<string, unknown> | null | undefined,
  siteSettings?: Record<string, unknown> | null | undefined,
): { theme: ThemeMode; config: ThemeConfig } {
  const prefs = userPreferences && typeof userPreferences === 'object' ? userPreferences : {};
  const userTheme = (prefs.theme as ThemeMode) || 'light';
  const userConfig = (prefs.theme_config || {}) as Partial<ThemeConfig>;
  const site = siteSettings && typeof siteSettings === 'object' ? siteSettings : {};
  const siteConfig = buildSiteThemeConfig(site);

  if (hasCloudThemeConfig(userConfig)) {
    const config = mergeConfig({}, userConfig);
    // 旧偏好无 themeStyle 时继承站点级简约/多彩，避免永选回 vivid
    if (userConfig.themeStyle == null || userConfig.themeStyle === '') {
      config.themeStyle = normalizeThemeStyle(siteConfig.themeStyle);
    }
    return { theme: userTheme, config };
  }

  if (hasCloudThemeConfig(siteConfig)) {
    return { theme: userTheme, config: mergeConfig({}, siteConfig) };
  }

  return { theme: 'light', config: normalizeThemeConfig({ ...DEFAULT_CONFIG }) };
}

/** @deprecated 请使用 resolveThemeFromCloud；保留别名供既有调用方使用 */
export function resolveThemeFromPreferences(
  preferences: Record<string, unknown> | null | undefined,
  siteSettings?: Record<string, unknown> | null | undefined,
): { theme: ThemeMode; config: ThemeConfig } {
  return resolveThemeFromCloud(preferences, siteSettings);
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
      /** Card / 次级容器边框：比 Ant Design 默认 (#f0f0f0 / #303030) 深/亮一级，全局统一 */
      colorBorderSecondary: isDark ? '#424242' : '#d9d9d9',
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
  /** 最近一次从站点设置 API 拉取的 settings，供偏好无 theme_config 时回退 */
  siteThemeSettings: Record<string, unknown> | null;
  initFromApi: () => Promise<void>;
  applyTheme: (themeMode: ThemeMode, config?: Partial<ThemeConfig>, options?: { persist?: boolean }) => void;
  /** 偏好变更时按云端 theme_config 应用；无个人配置时回退站点云端主题 */
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
    const { siteThemeSettings, config: liveConfig } = get();
    const { theme, config } = resolveThemeFromCloud(preferences, siteThemeSettings);
    const userCfg = (preferences.theme_config || {}) as Partial<ThemeConfig>;
    const mergedConfig =
      (userCfg.themeStyle == null || userCfg.themeStyle === '') &&
      liveConfig.themeStyle === 'plain' &&
      config.themeStyle !== 'plain'
        ? mergeConfig(config, { themeStyle: 'plain' })
        : config;
    applyResolvedTheme(theme, mergedConfig);
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
    siteThemeSettings: null,

    initFromApi: async () => {
      const { initialized, loading } = get();
      if (initialized || loading) return;

      if (!getToken()) {
        const cachedTheme = getThemeFromPreferenceCache();
        if (cachedTheme) {
          const { theme, config } = resolveThemeFromCloud({
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
        const siteSetting = await getSiteSetting().catch(() => null);
        const siteSettings =
          siteSetting?.settings && typeof siteSetting.settings === 'object'
            ? siteSetting.settings
            : null;

        if (siteSettings) {
          set({ siteThemeSettings: siteSettings });
          try {
            useConfigStore.getState().hydrateFromSettings(siteSettings);
          } catch {
            // 不阻塞主题流程
          }
        }

        // 先写入 siteThemeSettings，再拉偏好，避免 subscribe 用空站点配置覆盖主题
        await useUserPreferenceStore.getState().fetchPreferences();

        const prefs = useUserPreferenceStore.getState().preferences || {};
        const { theme, config } = resolveThemeFromCloud(prefs, siteSettings);
        applyResolvedTheme(theme, config);

        set({ initialized: true, loading: false, siteThemeSettings: siteSettings });
      } catch (e) {
        console.warn('Theme init failed:', e);
        const cachedTheme = getThemeFromPreferenceCache();
        if (cachedTheme) {
          const { siteThemeSettings } = get();
          const { theme, config } = resolveThemeFromCloud(
            {
              theme: cachedTheme.theme,
              theme_config: cachedTheme.theme_config,
            },
            siteThemeSettings,
          );
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
        // 保持 initialized，避免登出时 App 壳层全屏 Spin 阻塞跳转登录页
        initialized: true,
        siteThemeSettings: null,
      });
      doApplyTheme('light', DEFAULT_CONFIG);
    },
  };
});
