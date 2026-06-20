/**
 * 登录页面
 *
 * 遵循 Ant Design Pro 登录页面规范，采用左右分栏布局
 * 左侧：品牌展示区
 * 右侧：登录表单区
 */

import { Form, Input, App, Typography, Button, Space, Tooltip, ConfigProvider } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  UserOutlined,
  LockOutlined,
  ThunderboltOutlined,
  GlobalOutlined,
  WindowsFilled,
  AndroidFilled,
  DownloadOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
const LottiePlayer = lazy(() => import('lottie-react').then((m) => ({ default: m.default })));
import {
  registerPersonal,
  registerOrganization,
  searchTenants,
  login,
  guestLogin,
  wechatLoginCallback,
  type TenantCheckResponse,
  type TenantSearchOption,
  type OrganizationRegisterRequest,
  type LoginResponse,
  tenantNameFromLoginResponse,
} from '../../services/publicAuth';
import { setToken, setTenantId, setUserInfo } from '../../utils/auth';
import { clearSessionScopedQueries } from '../../utils/clearSessionQueries';
import { applySessionUserAfterLogin } from '../../utils/restoredUser';
import { getImmediatePostLoginHomePath, refinePostLoginHomeInBackground } from '../../utils/tenantHomePath';
const TenantSelectionModal = lazy(() => import('../../components/tenant-selection-modal'));
const TermsModal = lazy(() => import('../../components/terms-modal'));
const LongPressVerify = lazy(() => import('../../components/long-press-verify'));
import { Spin } from 'antd';

const LazyRegisterDrawer = lazy(() => import('./RegisterDrawer'));
import { theme } from 'antd';
import { getPlatformSettingsPublic, type PlatformSettings } from '../../services/publicPlatformSettings';
import { getLoginClientDownloads } from '../../services/clientRelease';
import { applyFavicon } from '../../utils/favicon';
import { LoginDescriptionContent } from '../../components/login-page-editor';
import { isLoginVisualLayerEnabled } from '../../utils/loginVisualLayers';
import {
  DEFAULT_SITE_LOGO_URL,
  EMBEDDED_FRAMEWORK_LOGO_DATA_URI,
  SITE_LOGO_FALLBACK_SVG_URL,
  nextSiteLogoUrlAfterImageError,
} from '../../constants/siteAssets';
import { prepareBackgroundLottie, prepareLoginDecorationLottie } from '../../utils/lottieTheme';
import './index.less';

const { Title, Text } = Typography;

/** 带重试的 fetch，提高 LOGO 等资源加载成功率 */
const fetchWithRetry = async (url: string, retries = 3): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw new Error('Fetch failed after retries');
};

/**
 * 登录表单数据接口
 */
interface LoginFormData {
  username: string;
  password: string;
}

const PLATFORM_SETTINGS_CACHE_PREFIX = 'platformSettingsPublic';

function resolveTenantDomain(pathname: string, search: string): string | null {
  try {
    const queryDomain = new URLSearchParams(search).get('tenant_domain');
    const normalized = (queryDomain || '').trim().toLowerCase();
    if (normalized) return normalized;
  } catch {
    /* ignore */
  }

  const segments = pathname.split('/').filter(Boolean);
  if (!segments.length) return null;
  const reserved = new Set([
    'login',
    'infra',
    'apps',
    'system',
    'personal',
    'init',
    'lock-screen',
  ]);
  if (!reserved.has(segments[0])) return segments[0].toLowerCase();
  if (segments[0] === 'login' && segments[1] && !reserved.has(segments[1])) return segments[1].toLowerCase();
  return null;
}

function getPlatformSettingsCacheKey(pathname: string, search: string): string {
  const tenantDomain = resolveTenantDomain(pathname, search);
  return `${PLATFORM_SETTINGS_CACHE_PREFIX}:${tenantDomain || 'global'}`;
}

function readPlatformSettingsPublicCache(cacheKey: string): PlatformSettings | null {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (p && typeof p === 'object') return p as PlatformSettings;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * 登录页面组件
 *
 * 遵循 Ant Design Pro 登录页面设计规范：
 * - 左右分栏布局（响应式设计）
 * - 左侧品牌展示区（包含 Logo、标题、描述）
 * - 右侧登录表单区（包含表单、链接等）
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { message } = App.useApp();
  const { token } = theme.useToken(); // 获取主题 token
  const queryClient = useQueryClient();
  const platformSettingsCacheKey = useMemo(
    () => getPlatformSettingsCacheKey(window.location.pathname, window.location.search),
    [],
  );

  /** 登录成功：同步用户态并清理会话级 query，避免 navigate 时 AuthGuard 竞态 */
  const syncUserStateAfterLogin = useCallback((userInfo: Parameters<typeof setUserInfo>[0]) => {
    applySessionUserAfterLogin(userInfo);
    clearSessionScopedQueries(queryClient);
    void import('../../stores/userPreferenceStore')
      .then(async ({ useUserPreferenceStore }) => {
        useUserPreferenceStore.getState().rehydrateFromStorage();
        const guestLang = sessionStorage.getItem('riveredge-guest-language');
        if (guestLang === 'zh-CN' || guestLang === 'en-US') {
          const currentLang = useUserPreferenceStore.getState().preferences?.language;
          if (currentLang !== guestLang) {
            try {
              await useUserPreferenceStore.getState().updatePreferences({ language: guestLang });
            } catch {
              // 不阻塞登录跳转
            }
          }
          sessionStorage.removeItem('riveredge-guest-language');
        }
      })
      .catch(() => {});
  }, [queryClient]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  /** 登录成功后立刻跳转本地首页；自定义首页与 init 向导在后台处理，不阻塞 navigate */
  const navigateToHomeAfterLogin = useCallback((options?: {
    redirect?: string | null;
    immediatePath?: string;
    tenantId?: number;
  }) => {
    const targetPath = options?.immediatePath ?? getImmediatePostLoginHomePath(options?.redirect);
    navigate(targetPath, { replace: true });
    if (!options?.immediatePath && !options?.redirect?.trim()) {
      refinePostLoginHomeInBackground(navigate, targetPath);
    }
    const tenantId = options?.tenantId;
    if (tenantId != null) {
      void (async () => {
        try {
          const { getInitSteps } = await import('../../services/init-wizard');
          const stepsRes = await getInitSteps(tenantId);
          if (stepsRes.init_completed === false) {
            navigate('/init/wizard', { replace: true });
          }
        } catch {
          // 忽略错误，用户已在目标页
        }
      })();
    }
  }, [navigate]);

  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(() =>
    readPlatformSettingsPublicCache(platformSettingsCacheKey),
  );
  const [isLoadingPlatformSettings, setIsLoadingPlatformSettings] = useState(
    () => readPlatformSettingsPublicCache(platformSettingsCacheKey) === null,
  );

  useEffect(() => {
    let cancelled = false;
    void getPlatformSettingsPublic()
      .then((data) => {
        if (!cancelled) {
          setPlatformSettings(data);
          void applyFavicon(data?.favicon);
        }
      })
      .catch(() => {
        if (!cancelled) void applyFavicon(undefined);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPlatformSettings(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 从缓存读取平台设置作为初始值，避免闪烁
  const [cachedPlatformName, setCachedPlatformName] = useState<string | null>(() => {
    try {
      const cachedSettings = localStorage.getItem(platformSettingsCacheKey);
      if (cachedSettings) {
        const parsed = JSON.parse(cachedSettings);
        if (i18n.language === 'en-US') {
          return parsed?.platform_name_en || parsed?.login_title_en || parsed?.platform_name || null;
        }
        return parsed?.platform_name || null;
      }
    } catch (error) {
      // 忽略解析错误
    }
    return null;
  });

  const localizedPlatformName = i18n.language === 'en-US' 
    ? (platformSettings?.platform_name_en || platformSettings?.login_title_en || platformSettings?.platform_name || cachedPlatformName || 'RiverEdge SaaS')
    : (platformSettings?.platform_name || cachedPlatformName || 'RiverEdge SaaS');

  const loginGuestEnabled = platformSettings?.login_guest_enabled !== false;
  const loginQuickEnabled = platformSettings?.login_quick_enabled !== false;
  const loginClientWinEnabled = platformSettings?.login_client_win_enabled !== false;
  const loginClientAndroidEnabled = platformSettings?.login_client_android_enabled !== false;
  const registerEnabled = platformSettings?.enable_register !== false;
  const showClientDownloads = loginClientWinEnabled || loginClientAndroidEnabled;

  const { data: loginClientDownloads } = useQuery({
    queryKey: ['loginClientDownloads'],
    queryFn: getLoginClientDownloads,
    enabled: showClientDownloads,
    staleTime: 60_000,
  });

  // LOGO URL状态（支持UUID和URL两种格式）
  // 初始值：尝试从 localStorage 读取缓存的设置，避免闪烁
  const [logoUrl, setLogoUrl] = useState<string>(() => {
    try {
      const cachedSettings = localStorage.getItem(platformSettingsCacheKey);
      if (cachedSettings) {
        const parsed = JSON.parse(cachedSettings);
        // 优先使用缓存的LOGO URL
        if (parsed?.platform_logo_url) {
          return parsed.platform_logo_url;
        }
        if (parsed?.platform_logo) {
          const logoValue = parsed.platform_logo.trim();
          // 如果是URL格式，直接返回；如果是UUID，需要异步加载，先用轻量 SVG 占位
          if (!logoValue.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            return logoValue;
          }
          return SITE_LOGO_FALLBACK_SVG_URL;
        }
      }
    } catch (error) {
      // 忽略解析错误
    }
    return DEFAULT_SITE_LOGO_URL;
  });

  /** 默认 SVG 仍加载失败时用浅色图标占位（避免出现深色字母） */
  const [logoBroken, setLogoBroken] = useState(false);
  useEffect(() => {
    setLogoBroken(false);
  }, [logoUrl]);

  const handleLogoImgLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.parentElement?.querySelector('.logo-placeholder')?.remove();
  }, [platformSettingsCacheKey]);

  const handleLogoImgError = useCallback(() => {
    const next = nextSiteLogoUrlAfterImageError(logoUrl);
    if (next !== logoUrl) {
      setLogoUrl(next);
      return;
    }
    setLogoBroken(true);
  }, [logoUrl]);

  // 预加载 LOGO 图片，提高首屏加载成功率
  useEffect(() => {
    if (!logoUrl || logoUrl.startsWith('blob:') || logoUrl.startsWith('data:')) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = logoUrl;
    document.head.appendChild(link);
    return () => link.remove();
  }, [logoUrl]);

  // 社交图标延后加载，减小登录 chunk 体积；空闲时再拉，避免抢首屏主线程
  const [socialIcons, setSocialIcons] = useState<Record<string, string>>({});
  useEffect(() => {
    if (typeof window === 'undefined') return () => {};
    let cancelled = false;
    const loadIcons = () => {
      Promise.all([
        import('../../assets/social/wechat.svg').then((m) => m.default),
        import('../../assets/social/qq.svg').then((m) => m.default),
        import('../../assets/social/qwei.svg').then((m) => m.default),
        import('../../assets/social/dingtalk.svg').then((m) => m.default),
        import('../../assets/social/feishu.svg').then((m) => m.default),
      ]).then(([w, q, qw, d, f]) => {
        if (!cancelled) setSocialIcons({ wechat: w, qq: q, qwei: qw, dingtalk: d, feishu: f });
      });
    };
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = (window as any).requestIdleCallback(loadIcons, { timeout: 1200 });
      return () => {
        cancelled = true;
        (window as any).cancelIdleCallback?.(id);
      };
    }
    const t = globalThis.setTimeout(loadIcons, 300);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(t);
    };
  }, []);

  // 背景 Lottie 源数据（空闲加载）；主题色在下方 useMemo 中注入
  const [lottieSourceBackground, setLottieSourceBackground] = useState<object | null>(null);
  // 装饰画 Lottie：保持原始配色，不跟随主题
  const [animationData, setAnimationData] = useState<object | null>(null);
  const [decorationImageUrl, setDecorationImageUrl] = useState<string | null>(null);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return () => {};
    if (window.matchMedia('(max-width: 992px)').matches) {
      return;
    }
    let cancelled = false;
    const loadAnimations = () => {
      void Promise.all([
        import('../../../static/lottie/background.json'),
        import('../../../static/lottie/login.json'),
      ]).then(([background, decoration]) => {
        if (cancelled) return;
        setLottieSourceBackground(background.default);
        setAnimationData(prepareLoginDecorationLottie(decoration.default));
      });
    };
    if ('requestIdleCallback' in window) {
      const id = (window as any).requestIdleCallback(loadAnimations, { timeout: 1800 });
      return () => {
        cancelled = true;
        (window as any).cancelIdleCallback?.(id);
      };
    }
    const t = globalThis.setTimeout(loadAnimations, 600);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(t);
    };
  }, []);

  /**
   * 判断字符串是否是UUID格式
   */
  const isUUID = (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // 缓存仅有 UUID、尚无预览 URL 时，与 getPlatformSettingsPublic 并行拉预览，缩短首屏
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = localStorage.getItem(platformSettingsCacheKey);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const pl = typeof parsed.platform_logo === 'string' ? parsed.platform_logo.trim() : '';
        const existingUrl =
          typeof parsed.platform_logo_url === 'string' ? parsed.platform_logo_url.trim() : '';
        if (!pl || existingUrl) return;
        if (!isUUID(pl)) return;
        const response = await fetchWithRetry(
          `/api/v1/core/files/${pl}/preview/public?category=platform-logo`,
        );
        const previewInfo = (await response.json()) as { preview_url?: string };
        if (cancelled || !previewInfo.preview_url) return;
        setLogoUrl(previewInfo.preview_url);
        const merged = { ...parsed, platform_logo: pl, platform_logo_url: previewInfo.preview_url };
        localStorage.setItem(platformSettingsCacheKey, JSON.stringify(merged));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 加载LOGO URL
  useEffect(() => {
    const loadLogo = async () => {
      // 平台设置加载中时不阻塞默认 logo 显示，避免 API 不可达时长期空白
      if (isLoadingPlatformSettings) {
        return;
      }

      // 如果平台设置加载完成但没有LOGO，使用默认值
      if (!platformSettings?.platform_logo) {
        setLogoUrl(DEFAULT_SITE_LOGO_URL);
        // 更新缓存
        try {
          localStorage.setItem(platformSettingsCacheKey, JSON.stringify({ platform_logo: null }));
        } catch (error) {
          // 忽略存储错误
        }
        return;
      }

      const logoValue = platformSettings.platform_logo.trim();
      
      // 如果是UUID格式，使用公开的文件预览接口（带重试）
      if (isUUID(logoValue)) {
        try {
          const response = await fetchWithRetry(
            `/api/v1/core/files/${logoValue}/preview/public?category=platform-logo`
          );
          const previewInfo = await response.json();
          setLogoUrl(previewInfo.preview_url);
          // 更新缓存
          try {
            localStorage.setItem(platformSettingsCacheKey, JSON.stringify({
              platform_logo: logoValue,
              platform_logo_url: previewInfo.preview_url,
            }));
          } catch (error) {
            // 忽略存储错误
          }
        } catch (error) {
          console.error('获取LOGO预览URL失败（已重试）:', error);
          setLogoUrl(DEFAULT_SITE_LOGO_URL);
        }
      } else {
        // 如果是URL格式，直接使用
        setLogoUrl(logoValue);
        // 更新缓存
        try {
          localStorage.setItem(platformSettingsCacheKey, JSON.stringify({
            platform_logo: logoValue,
            platform_logo_url: logoValue,
          }));
        } catch (error) {
          // 忽略存储错误
        }
      }
    };

    loadLogo();
  }, [platformSettings?.platform_logo, isLoadingPlatformSettings, platformSettingsCacheKey]);

  // 加载登录页装饰图（租户可配置）；未配置时回退到默认 Lottie
  useEffect(() => {
    const loadDecorationImage = async () => {
      if (isLoadingPlatformSettings) return;
      const rawValue = typeof platformSettings?.login_decoration_image === 'string'
        ? platformSettings.login_decoration_image.trim()
        : '';
      if (!rawValue) {
        setDecorationImageUrl(null);
        return;
      }
      if (!isUUID(rawValue)) {
        setDecorationImageUrl(rawValue);
        return;
      }
      try {
        const response = await fetchWithRetry(
          `/api/v1/core/files/${rawValue}/preview/public?category=site-logo`
        );
        const previewInfo = await response.json();
        setDecorationImageUrl(previewInfo?.preview_url || null);
      } catch {
        setDecorationImageUrl(null);
      }
    };
    void loadDecorationImage();
  }, [platformSettings?.login_decoration_image, isLoadingPlatformSettings]);

  const loginDecorationEnabled = isLoginVisualLayerEnabled(platformSettings?.login_decoration_enabled);
  const loginBackgroundEnabled = isLoginVisualLayerEnabled(platformSettings?.login_background_enabled);

  // 加载登录页背景图
  useEffect(() => {
    const loadBackgroundImage = async () => {
      if (isLoadingPlatformSettings) return;
      const rawValue = typeof platformSettings?.login_background_image === 'string'
        ? platformSettings.login_background_image.trim()
        : '';
      if (!rawValue) {
        setBackgroundImageUrl(null);
        return;
      }
      if (!isUUID(rawValue)) {
        setBackgroundImageUrl(rawValue);
        return;
      }
      try {
        const response = await fetchWithRetry(
          `/api/v1/core/files/${rawValue}/preview/public?category=site-logo`
        );
        const previewInfo = await response.json();
        setBackgroundImageUrl(previewInfo?.preview_url || null);
      } catch {
        setBackgroundImageUrl(null);
      }
    };
    void loadBackgroundImage();
  }, [platformSettings?.login_background_image, isLoadingPlatformSettings]);

  // 更新平台设置缓存（包含platform_name）
  useEffect(() => {
    if (platformSettings && !isLoadingPlatformSettings) {
      try {
        const cachedData: any = { ...platformSettings };
        // 如果有LOGO URL，也缓存
        if (
          logoUrl &&
          logoUrl !== DEFAULT_SITE_LOGO_URL &&
          logoUrl !== SITE_LOGO_FALLBACK_SVG_URL &&
          logoUrl !== EMBEDDED_FRAMEWORK_LOGO_DATA_URI
        ) {
          cachedData.platform_logo_url = logoUrl;
        }
        localStorage.setItem(platformSettingsCacheKey, JSON.stringify(cachedData));
        // 更新缓存的平台名称，用于显示
        const name = i18n.language === 'en-US' 
          ? (platformSettings.platform_name_en || platformSettings.login_title_en || platformSettings.platform_name) 
          : platformSettings.platform_name;
        if (name) {
          setCachedPlatformName(name);
        }
      } catch (error) {
        // 忽略存储错误
      }
    }
  }, [platformSettings, isLoadingPlatformSettings, logoUrl, platformSettingsCacheKey, i18n.language]);

  // 设置页面标题
  useEffect(() => {
    if (isLoadingPlatformSettings) {
      // 加载中时，尝试从缓存读取
      try {
        const cachedSettings = localStorage.getItem(platformSettingsCacheKey);
        if (cachedSettings) {
          const parsed = JSON.parse(cachedSettings);
          const name = i18n.language === 'en-US' 
            ? (parsed?.platform_name_en || parsed?.login_title_en || parsed?.platform_name) 
            : parsed?.platform_name;
          if (name) {
            document.title = `${name} - ${t('pages.login.pageTitleSuffix')}`;
            return;
          }
        }
      } catch (error) {
        // 忽略解析错误
      }
    } else {
      const platformName = localizedPlatformName || t('pages.login.defaultPlatformName');
      document.title = `${platformName} - ${t('pages.login.pageTitleSuffix')}`;
    }
    
    // 组件卸载时恢复默认标题
    return () => {
      document.title = t('pages.login.defaultDocTitle');
    };
  }, [platformSettings?.platform_name, isLoadingPlatformSettings, t, platformSettingsCacheKey]);

  // 组织选择弹窗状态
  const [tenantSelectionVisible, setTenantSelectionVisible] = useState(false);
  const [loginResponse, setLoginResponse] = useState<LoginResponse | null>(null);
  const [loginCredentials, setLoginCredentials] = useState<LoginFormData | null>(null);

  // 条款弹窗状态
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [termsModalType, setTermsModalType] = useState<'user' | 'privacy'>('user');

  // 注册抽屉状态
  const [registerDrawerVisible, setRegisterDrawerVisible] = useState(false);
  const [registerType, setRegisterType] = useState<'personal' | 'organization'>('personal');

  useEffect(() => {
    if (!registerEnabled && registerDrawerVisible) {
      setRegisterDrawerVisible(false);
    }
  }, [registerEnabled, registerDrawerVisible]);

  const showClientDownloadPlaceholder = useCallback(() => {
    message.info(t('pages.login.clientDownloadPlaceholder'));
  }, [message, t]);

  const handleClientDownload = useCallback(
    (slot: 'windows' | 'android_pda') => {
      const item = slot === 'windows' ? loginClientDownloads?.windows : loginClientDownloads?.android_pda;
      if (item?.url) {
        window.open(item.url, '_blank', 'noopener,noreferrer');
        return;
      }
      showClientDownloadPlaceholder();
    },
    [loginClientDownloads, showClientDownloadPlaceholder],
  );

  // 个人注册表单状态
  const [tenantCheckResult, setTenantCheckResult] = useState<TenantCheckResponse | null>(null);
  const [checkingTenant, setCheckingTenant] = useState(false);
  const [tenantSearchOptions, setTenantSearchOptions] = useState<TenantSearchOption[]>([]);
  const [searchingTenant, setSearchingTenant] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<TenantSearchOption | null>(null);

  // 频繁操作检测状态
  const [loginFailCount, setLoginFailCount] = useState(0);
  const [loginFailTimes, setLoginFailTimes] = useState<number[]>([]);
  const [requireVerification, setRequireVerification] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  
  // 频繁操作阈值：5分钟内失败3次触发验证
  const FAIL_COUNT_THRESHOLD = 3;
  const TIME_WINDOW = 5 * 60 * 1000; // 5分钟
  
  /**
   * 根据失败次数计算长按验证时间（递增惩罚机制）
   * 
   * @param failCount - 失败次数
   * @returns 长按验证时间（毫秒）
   */
  const calculateVerifyDuration = (failCount: number): number => {
    // 基础时间 2 秒
    const baseDuration = 2000;
    
    // 递增惩罚规则：
    // 3-4 次：2 秒
    // 5-6 次：3 秒
    // 7-8 次：5 秒
    // 9-10 次：8 秒
    // 11 次及以上：10 秒
    if (failCount <= 4) {
      return baseDuration; // 2 秒
    } else if (failCount <= 6) {
      return 3000; // 3 秒
    } else if (failCount <= 8) {
      return 5000; // 5 秒
    } else if (failCount <= 10) {
      return 8000; // 8 秒
    } else {
      return 10000; // 10 秒（最大）
    }
  };
  
  // localStorage 键名
  const STORAGE_KEY = 'login_fail_times';
  const VERIFIED_KEY = 'login_verified_token'; // 验证通过后的令牌
  
  /**
   * 个人注册表单数据接口
   */
  interface PersonalRegisterFormData {
    username: string;
    phone: string;
    password: string;
    confirm_password: string;
    full_name?: string;
    tenant_domain?: string;
  }
  
  /**
   * 组织注册表单数据接口
   */
  interface OrganizationRegisterFormData {
    tenant_name: string;
    full_name: string;
    phone: string;
    password: string;
    confirm_password: string;
    tenant_domain?: string;
  }
  
  /**
   * 搜索组织（支持组织代码或组织名模糊搜索）
   */
  const handleSearchTenant = async (keyword: string) => {
    if (!keyword || keyword.trim().length === 0) {
      setTenantSearchOptions([]);
      setSelectedTenant(null);
      setTenantCheckResult(null);
      return;
    }

    setSearchingTenant(true);
    try {
      const result = await searchTenants(keyword.trim());
      setTenantSearchOptions(result.items || []);
      
      // 如果找到唯一匹配的组织，自动选中
      if (result.items && result.items.length === 1) {
        setSelectedTenant(result.items[0]);
        setTenantCheckResult({
          exists: true,
          tenant_id: result.items[0].tenant_id,
          tenant_name: result.items[0].tenant_name,
        });
      } else if (result.items && result.items.length > 1) {
        // 多个匹配，不自动选中
        setSelectedTenant(null);
        setTenantCheckResult(null);
      } else {
        // 没有找到
        setSelectedTenant(null);
        setTenantCheckResult(null);
      }
    } catch (error: any) {
      setTenantSearchOptions([]);
      setSelectedTenant(null);
      setTenantCheckResult(null);
    } finally {
      setSearchingTenant(false);
    }
  };

  /**
   * 选择组织
   */
  const handleSelectTenant = (value: string, option: any) => {
    const tenant = option.tenant || tenantSearchOptions.find(t => 
      t.tenant_id === option.value || 
      t.tenant_domain === value || 
      t.tenant_name === value
    );
    if (tenant) {
      setSelectedTenant(tenant);
      setTenantCheckResult({
        exists: true,
        tenant_id: tenant.tenant_id,
        tenant_name: tenant.tenant_name,
      });
    }
  };

  /**
   * 处理个人注册提交
   */
  const handlePersonalRegister = async (values: PersonalRegisterFormData) => {
    try {
      // 验证密码确认
      if (values.password !== values.confirm_password) {
        message.error(t('pages.login.passwordMismatch'));
        return;
      }

      // 如果选择了组织，使用选中的组织ID
      let tenant_id: number | undefined = undefined;
      if (selectedTenant && selectedTenant.tenant_id) {
        tenant_id = selectedTenant.tenant_id;
      } else if (values.tenant_domain && values.tenant_domain.trim().length > 0) {
        // 如果没有选中组织但输入了组织代码，提示用户选择
        message.warning(t('pages.login.selectTenantHint'));
        return;
      }
      // 如果不填写组织代码，tenant_id 为 undefined，将注册到默认组织

      // 提交个人注册（邮箱、邀请码、短信验证码不在表单中收集）
      const registerResponse = await registerPersonal({
        username: values.username,
        phone: values.phone,
        password: values.password,
        full_name: values.full_name && values.full_name.trim() !== '' ? values.full_name : undefined,
        tenant_id: tenant_id,
      });

      if (registerResponse) {
        message.success(t('pages.login.registerSuccessLogin'));

        // 注册成功后自动登录
        try {
          const loginResponse = await login({
            username: values.username,
            password: values.password,
            tenant_id: tenant_id,
          });

          if (loginResponse && loginResponse.access_token) {
            setToken(loginResponse.access_token);
            // 优先使用登录响应中的 tenant_id（因为 Token 中包含的组织上下文）
            const tenantId = loginResponse.user?.tenant_id || tenant_id || loginResponse.default_tenant_id;
            if (tenantId) {
              setTenantId(tenantId);
            }
            
            // 从 tenants 数组中查找对应的租户名称
            const tenantName = tenantNameFromLoginResponse(loginResponse);

            const userInfo = {
              id: loginResponse.user.id,
              uuid: loginResponse.user.uuid,
              username: loginResponse.user.username,
              email: loginResponse.user.email,
              full_name: loginResponse.user.full_name,
              is_infra_admin: loginResponse.user.is_infra_admin,
              is_tenant_admin: loginResponse.user.is_tenant_admin,
              permissions: loginResponse.user.permissions || [],
              permission_version: loginResponse.user.permission_version || 1,
              department: loginResponse.user.department,
              position: loginResponse.user.position,
              roles: loginResponse.user.roles || [],
              tenant_id: tenantId,
              tenant_name: tenantName,
              user_type: 'user',
            };
      syncUserStateAfterLogin(userInfo);
      setRegisterDrawerVisible(false);
      setRegisterType('personal');
      message.success(t('pages.login.success'));
      navigateToHomeAfterLogin({ tenantId });
          }
        } catch (loginError: any) {
          message.warning(t('pages.login.registerSuccessManual'));
          setRegisterDrawerVisible(false);
          setRegisterType('personal');
        }
      }
    } catch (error: any) {
      let errorMessage = t('pages.login.registerFailed');
      if (error?.response?.data) {
        const errorData = error.response.data;
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        } else if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      message.error(errorMessage);
    }
  };
  
  /**
   * 处理组织注册提交
   */
  const handleOrganizationRegister = async (values: OrganizationRegisterFormData) => {
    try {
      // 验证密码确认
      if (values.password !== values.confirm_password) {
        message.error(t('pages.login.passwordMismatch'));
        return false;
      }

      const registerResponse = await registerOrganization({
        tenant_name: values.tenant_name,
        full_name: values.full_name?.trim() || undefined,
        phone: values.phone,
        password: values.password,
        tenant_domain: values.tenant_domain,
      });

      if (registerResponse && registerResponse.success) {
        message.success(t('pages.login.registerSuccessLogin'));

        // 注册成功后自动登录（使用手机号作为用户名）
        try {
          const loginResponse = await login({
            username: values.phone,  // 手机号即账号
            password: values.password,
            tenant_id: registerResponse.tenant_id,
          });

          if (loginResponse && loginResponse.access_token) {
            setToken(loginResponse.access_token);
            // 优先使用登录响应中的 tenant_id（因为 Token 中包含的组织上下文）
            const tenantId = loginResponse.user?.tenant_id || registerResponse.tenant_id || loginResponse.default_tenant_id;
            if (tenantId) {
              setTenantId(tenantId);
            }
            
            // 从 tenants 数组中查找对应的租户名称
            const tenantName = tenantNameFromLoginResponse(loginResponse);

            const userInfo = {
              id: loginResponse.user.id,
              uuid: loginResponse.user.uuid,
              username: loginResponse.user.username,
              email: loginResponse.user.email,
              full_name: loginResponse.user.full_name,
              is_infra_admin: loginResponse.user.is_infra_admin,
              is_tenant_admin: loginResponse.user.is_tenant_admin,
              permissions: loginResponse.user.permissions || [],
              permission_version: loginResponse.user.permission_version || 1,
              department: loginResponse.user.department,
              position: loginResponse.user.position,
              roles: loginResponse.user.roles || [],
              tenant_id: tenantId,
              tenant_name: tenantName,
              user_type: 'user',
            };
      syncUserStateAfterLogin(userInfo);
      setRegisterDrawerVisible(false);
      setRegisterType('personal');
      message.success(t('pages.login.success'));
      navigateToHomeAfterLogin({ tenantId });
          } else {
            message.warning(t('pages.login.registerSuccessManual'));
            setRegisterDrawerVisible(false);
            setRegisterType('personal');
          }
        } catch (loginError: any) {
          message.warning(t('pages.login.registerSuccessManual'));
          setRegisterDrawerVisible(false);
          setRegisterType('personal');
        }
      } else {
        message.error(registerResponse?.message || t('pages.login.registerFailed'));
      }
    } catch (error: any) {
      let errorMessage = t('pages.login.registerFailed');
      if (error?.response?.data) {
        const errorData = error.response.data;
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        } else if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      message.error(errorMessage);
    }
  };

  // 平台主题颜色（与 infra 登录页一致，从平台设置读取）
  /** 未拉到平台主题时与 Ant Design 5 默认主色一致（独立登录 MPA 无静态骨架，首帧由本页渲染） */
  const themeColor = platformSettings?.theme_color || '#1677ff';

  const backgroundAnimationData = useMemo(
    () =>
      lottieSourceBackground ? prepareBackgroundLottie(lottieSourceBackground) : null,
    [lottieSourceBackground],
  );

  /**
   * 处理登录成功后的逻辑
   * 
   * 统一处理登录成功后的逻辑，包括：
   * - 保存 Token
   * - 判断组织数量并处理跳转
   * - 更新用户状态
   * 
   * @param response - 登录响应数据
   * @param credentials - 登录凭据（用于多组织选择后重新登录）
   */
  const handleLoginSuccess = (response: LoginResponse, credentials?: LoginFormData) => {
    if (!response || !response.access_token) {
      message.error(t('pages.login.loginFailedCheck'));
      return;
    }

    // 保存 Token
    setToken(response.access_token);

    // 判断组织数量
    const tenants = response.tenants || [];
    const isPlatformAdmin = response.user?.is_infra_admin || false;

    // 平台管理：直接进入
    if (isPlatformAdmin) {
      // 保存组织 ID（如果有）
      if (response.default_tenant_id) {
        setTenantId(response.default_tenant_id);
      }

      const tenantName = tenantNameFromLoginResponse(response);

      // 更新用户状态
      const userInfo = {
        id: response.user.id,
        uuid: response.user.uuid,
        username: response.user.username,
        email: response.user.email,
        full_name: response.user.full_name,
        is_infra_admin: response.user.is_infra_admin,
        is_tenant_admin: response.user.is_tenant_admin,
        permissions: response.user.permissions || [],
        permission_version: response.user.permission_version || 1,
        department: response.user.department,
        position: response.user.position,
        roles: response.user.roles || [],
        tenant_id: response.default_tenant_id,
        tenant_name: tenantName,
        user_type: 'user',
      };
      syncUserStateAfterLogin(userInfo);

      message.success(t('pages.login.success'));
      navigateToHomeAfterLogin({ immediatePath: '/infra/operation' });
      return;
    }

    // 多组织：显示选择弹窗
    if (tenants.length > 1 || response.requires_tenant_selection) {
      setLoginResponse(response);
      if (credentials) {
        setLoginCredentials(credentials);
      }
      setTenantSelectionVisible(true);
      return;
    }

    // 单组织：直接进入
    const selectedTenantId = response.user?.tenant_id || response.default_tenant_id || tenants[0]?.id;

    if (selectedTenantId) {
      setTenantId(selectedTenantId);

      const tenantName = tenantNameFromLoginResponse(response);

      // 更新用户状态
      const userInfo = {
        id: response.user.id,
        uuid: response.user.uuid,
        username: response.user.username,
        email: response.user.email,
        full_name: response.user.full_name,
        is_infra_admin: response.user.is_infra_admin,
        is_tenant_admin: response.user.is_tenant_admin,
        permissions: response.user.permissions || [],
        permission_version: response.user.permission_version || 1,
        department: response.user.department,
        position: response.user.position,
        roles: response.user.roles || [],
        tenant_id: selectedTenantId,
        tenant_name: tenantName,
        user_type: 'user',
      };
      syncUserStateAfterLogin(userInfo);

      const urlParams = new URL(window.location.href).searchParams;
      const redirect = urlParams.get('redirect');
      message.success(t('pages.login.success'));
      navigateToHomeAfterLogin({ redirect, tenantId: selectedTenantId });
    } else {
      message.error(t('pages.login.loginFailed'));
    }
  };

  /**
   * 处理微信登录
   * 
   * 跳转到微信授权页面
   */
  const handleWechatLogin = async () => {
    try {
      // 微信授权 URL
      // 注意：需要配置微信开放平台的 AppID 和回调地址
      // 优先从环境变量获取，如果没有则提示配置
      // 从环境变量获取微信 AppID（需要在 .env 文件中配置 VITE_WECHAT_APPID）
      const WECHAT_APPID = (import.meta as any).env?.VITE_WECHAT_APPID || '';
      
      // 如果 AppID 未配置，提示用户
      if (!WECHAT_APPID) {
        message.warning(t('pages.login.wechatNotConfigured'));
        return;
      }

      // 生成回调地址（前端地址）
      const redirectUri = encodeURIComponent(`${window.location.origin}/login?provider=wechat`);
      
      // 生成随机 state，用于防止 CSRF 攻击
      const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // 保存 state 到 sessionStorage，用于回调时验证
      sessionStorage.setItem('wechat_login_state', state);

      // 跳转到微信授权页面
      // 微信开放平台网站应用授权地址
      const wechatAuthUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=${WECHAT_APPID}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`;
      window.location.href = wechatAuthUrl;
    } catch (error: any) {
      message.error(t('pages.login.wechatRedirectFailed'));
    }
  };

  /**
   * 处理社交登录
   * 
   * @param provider - 社交登录提供商（wechat, qq, wechat_work, dingtalk, feishu）
   */
  const handleSocialLogin = (provider: 'wechat' | 'qq' | 'wechat_work' | 'dingtalk' | 'feishu') => {
    if (provider === 'wechat') {
      handleWechatLogin();
    }
  };

  /**
   * 处理微信登录回调
   * 
   * 从 URL 中获取 code 和 state，验证后调用后端 API 完成登录
   */
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const provider = urlParams.get('provider');

    // 检查是否是微信登录回调
    if (provider === 'wechat' && code && state) {
      // 验证 state（防止 CSRF 攻击）
      const savedState = sessionStorage.getItem('wechat_login_state');
      if (savedState !== state) {
        message.error(t('pages.login.wechatVerifyFailed'));
        // 清除 URL 参数，避免重复处理
        window.history.replaceState({}, '', '/login');
        return;
      }

      // 清除 state
      sessionStorage.removeItem('wechat_login_state');

      // 调用后端 API 完成登录
      const handleWechatCallback = async () => {
        try {
          message.loading(t('pages.login.loading'), 0);
          const response = await wechatLoginCallback(code);
          message.destroy();
          handleLoginSuccess(response);
        } catch (error: any) {
          message.destroy();
          let errorMessage = t('pages.login.wechatLoginFailed');
          
          if (error?.response?.data) {
            const errorData = error.response.data;
            if (errorData.error?.message) {
              errorMessage = errorData.error.message;
            } else if (errorData.detail) {
              errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
            } else if (errorData.message) {
              errorMessage = errorData.message;
            }
          } else if (error?.message) {
            errorMessage = error.message;
          }
          
          message.error(errorMessage);
          // 清除 URL 参数
          window.history.replaceState({}, '', '/login');
        }
      };

      handleWechatCallback();
    }
  }, []);

  /**
   * 从 localStorage 加载失败记录
   */
  const loadFailTimesFromStorage = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const times = JSON.parse(stored) as number[];
        // 清理过期的记录
        const now = Date.now();
        const recentTimes = times.filter(time => now - time < TIME_WINDOW);
        if (recentTimes.length > 0) {
          setLoginFailTimes(recentTimes);
          // 如果还有有效记录，更新存储
          localStorage.setItem(STORAGE_KEY, JSON.stringify(recentTimes));
        } else {
          // 如果没有有效记录，清除存储
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error(t('ui.error.loadFailTimes'), error);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  /**
   * 保存失败记录到 localStorage
   */
  const saveFailTimesToStorage = (times: number[]) => {
    try {
      if (times.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(times));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error(t('ui.error.saveFailTimes'), error);
    }
  };

  /**
   * 检查验证令牌是否有效
   */
  const checkVerifyToken = (): boolean => {
    try {
      const stored = localStorage.getItem(VERIFIED_KEY);
      if (!stored) return false;
      
      const token = JSON.parse(stored) as { timestamp: number; expiresAt: number };
      const now = Date.now();
      
      // 检查是否过期
      if (now > token.expiresAt) {
        localStorage.removeItem(VERIFIED_KEY);
        return false;
      }
      
      return true;
    } catch (error) {
      localStorage.removeItem(VERIFIED_KEY);
      return false;
    }
  };

  /**
   * 组件加载时从 localStorage 恢复失败记录和验证状态
   */
  useEffect(() => {
    loadFailTimesFromStorage();
    // 检查是否有有效的验证令牌
    const hasValidToken = checkVerifyToken();
    if (hasValidToken) {
      // 如果验证令牌有效，说明用户已经完成验证，允许直接登录
      // 不需要再次显示验证按钮
      setIsVerified(true);
      // 注意：不清除 requireVerification，因为失败记录还在
      // 但在登录时会检查验证令牌，如果有效则允许登录
    }
  }, []);

  /**
   * 监听登录失败次数变化，自动检查是否需要验证并保存到 localStorage
   */
  useEffect(() => {
    if (loginFailTimes.length > 0) {
      saveFailTimesToStorage(loginFailTimes);
      checkRequireVerification();
    } else {
      // 如果失败记录为空，清除存储
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [loginFailTimes]);

  /**
   * 检查是否需要验证
   * 5分钟内失败3次或以上，需要长按验证
   * 
   * @param currentFailTimes - 当前失败时间数组（可选，用于同步检查）
   */
  const checkRequireVerification = (currentFailTimes?: number[]) => {
    const now = Date.now();
    const failTimesToCheck = currentFailTimes !== undefined ? currentFailTimes : loginFailTimes;
    
    // 清理超过时间窗口的失败记录
    const recentFailTimes = failTimesToCheck.filter(time => now - time < TIME_WINDOW);
    
    // 如果提供了新的失败时间数组，更新状态
    if (currentFailTimes !== undefined) {
      setLoginFailTimes(recentFailTimes);
    } else if (recentFailTimes.length !== failTimesToCheck.length) {
      // 如果有清理，更新状态
      setLoginFailTimes(recentFailTimes);
    }
    
    // 如果最近失败次数达到阈值，需要验证
    const needVerify = recentFailTimes.length >= FAIL_COUNT_THRESHOLD;
    
    // 调试日志
    if (recentFailTimes.length > 0) {
    }
    
    setRequireVerification(needVerify);
    
    // 如果需要验证但未通过，重置验证状态
    if (needVerify && !isVerified) {
      setIsVerified(false);
    }
    
    return needVerify;
  };

  /**
   * 处理验证通过
   * 
   * 验证通过后，生成一个验证令牌，只允许一次登录尝试
   * 如果登录失败，需要重新验证
   */
  const handleVerify = () => {
    setIsVerified(true);
    // 生成验证令牌（包含时间戳，有效期5分钟）
    const verifyToken = {
      timestamp: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5分钟有效期
    };
    // 保存验证令牌到 localStorage
    localStorage.setItem(VERIFIED_KEY, JSON.stringify(verifyToken));
    // 注意：不清除失败记录，验证后只允许一次尝试，如果失败需要重新验证
  };

  /**
   * 处理登录提交
   *
   * 登录成功后判断组织数量：
   * - 单组织：直接进入系统
   * - 多组织：显示组织选择弹窗
   * - 超级管理员：直接进入全功能后台
   *
   * @param values - 表单数据
   */
  const handleSubmit = async (values: LoginFormData) => {
    // 检查是否需要验证 - 如果需要验证但未通过，直接阻止登录请求，不发送到后端
    if (requireVerification && !isVerified) {
      message.warning(t('pages.login.verifyRequired'));
      return;
    }

    // 如果已验证，检查验证令牌是否有效
    if (isVerified) {
      const hasValidToken = checkVerifyToken();
      if (!hasValidToken) {
        setIsVerified(false);
        setRequireVerification(true);
        message.warning(t('pages.login.verifyExpired'));
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const response = await login(values);
      // 登录成功，清除所有记录和验证状态
      setLoginFailTimes([]);
      setLoginFailCount(0);
      setRequireVerification(false);
      setIsVerified(false);
      // 清除 localStorage 中的所有记录
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(VERIFIED_KEY);
      handleLoginSuccess(response, values);
    } catch (error: any) {
      // 登录失败，清除验证状态（验证后只允许一次尝试）
      if (isVerified) {
        setIsVerified(false);
        localStorage.removeItem(VERIFIED_KEY);
        message.warning(t('pages.login.verifyRetry'));
      }
      
      // 记录失败时间和次数
      const now = Date.now();
      const updatedFailTimes = [...loginFailTimes, now];
      setLoginFailTimes(updatedFailTimes);
      setLoginFailCount(prev => prev + 1);
      
      // 检查是否需要验证（使用更新后的失败时间数组）
      const needVerify = checkRequireVerification(updatedFailTimes);
      
      // 提取错误信息（支持多种错误格式）
      let errorMessage = t('pages.login.loginFailed');

      if (error?.response?.data) {
        const errorData = error.response.data;
        // 统一错误格式 { success: false, error: { message: ... } }
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }
        // FastAPI 错误格式 { detail: ... }
        else if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string'
            ? errorData.detail
            : JSON.stringify(errorData.detail);
        }
        // 旧格式 { message: ... }
        else if (errorData.message) {
          errorMessage = errorData.message;
        }
      }
      // 如果 error 本身是 Error 对象
      else if (error?.message) {
        errorMessage = error.message;
      }

      message.error(errorMessage);
      
      // 如果触发验证要求，提示用户
      if (needVerify) {
        message.warning(t('pages.login.verifyRetryTip'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * 处理免注册体验登录
   *
   * 直接使用预设的体验账户登录，进入后台（只有浏览权限）
   */
  const handleGuestLogin = async () => {
    try {
      const response = await guestLogin();

      if (response && response.access_token) {
        // 保存 Token
        setToken(response.access_token);

        // 获取组织 ID
        const tenantId = response.user?.tenant_id || response.default_tenant_id;

        if (tenantId) {
          setTenantId(tenantId);

          const tenantName = tenantNameFromLoginResponse(response);

          // 更新用户状态
          const userInfo = {
            id: response.user.id,
            uuid: response.user.uuid,
            username: response.user.username,
            email: response.user.email,
            full_name: response.user.full_name,
            is_infra_admin: response.user.is_infra_admin,
            is_tenant_admin: response.user.is_tenant_admin,
            permissions: response.user.permissions || [],
            permission_version: response.user.permission_version || 1,
            department: response.user.department,
            position: response.user.position,
            roles: response.user.roles || [],
            tenant_id: tenantId,
            tenant_name: tenantName,
            user_type: 'guest',
          };
          syncUserStateAfterLogin(userInfo);

          const urlParams = new URL(window.location.href).searchParams;
          message.success(t('pages.login.guestSuccess'));
          navigateToHomeAfterLogin({ redirect: urlParams.get('redirect') });
        } else {
          message.error(t('pages.login.guestFailedNoTenant'));
        }
      } else {
        message.error(t('pages.login.guestFailed'));
      }
    } catch (error: any) {
      // 提取错误信息
      let errorMessage = t('pages.login.guestFailed');

      if (error?.response?.data) {
        const errorData = error.response.data;
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        } else if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string'
            ? errorData.detail
            : JSON.stringify(errorData.detail);
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      message.error(errorMessage);
    }
  };

  /**
   * 处理组织选择
   *
   * 用户选择组织后，使用选中的 tenant_id 重新登录以获取包含该组织的 Token
   *
   * @param tenantId - 选中的组织 ID
   */
  const handleTenantSelect = async (tenantId: number) => {
    if (!loginResponse || !loginCredentials) {
      return;
    }

    try {
      // 使用选中的组织 ID 重新登录（后端会根据 tenant_id 生成新的 Token）
      const response = await login({
        username: loginCredentials.username,
        password: loginCredentials.password,
        tenant_id: tenantId, // 传递选中的组织 ID
      });

      if (response && response.access_token) {
        // 保存新的 Token（包含选中的组织 ID）
        setToken(response.access_token);

        // 保存组织 ID
        const selectedTenantId = response.user?.tenant_id || tenantId;
        setTenantId(selectedTenantId);

        const tenantName = tenantNameFromLoginResponse(response);

        // 更新用户状态
        const userInfo = {
          id: response.user.id,
          uuid: response.user.uuid,
          username: response.user.username,
          email: response.user.email,
          full_name: response.user.full_name,
          is_infra_admin: response.user.is_infra_admin,
          is_tenant_admin: response.user.is_tenant_admin,
          permissions: response.user.permissions || [],
          permission_version: response.user.permission_version || 1,
          department: response.user.department,
          position: response.user.position,
          roles: response.user.roles || [],
          tenant_id: selectedTenantId,
          tenant_name: tenantName,
          user_type: 'user',
        };
        syncUserStateAfterLogin(userInfo);
        setTenantSelectionVisible(false);
        setLoginResponse(null);
        setLoginCredentials(null);

        const urlParams = new URL(window.location.href).searchParams;
        const redirect = urlParams.get('redirect');
        message.success(t('pages.login.tenantSelected'));
        navigateToHomeAfterLogin({ redirect, tenantId: selectedTenantId });
      } else {
        message.error(t('pages.login.tenantSelectFailed'));
      }
    } catch (error: any) {
      let errorMessage = t('pages.login.tenantSelectFailed');

      if (error?.response?.data) {
        const errorData = error.response.data;
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        } else if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string'
            ? errorData.detail
            : JSON.stringify(errorData.detail);
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      message.error(errorMessage);
    }
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm, // 强制使用浅色模式，不受全局深色模式影响
        token: {
          colorPrimary: themeColor, // 固定主题色，不受全局主题影响
          // 聚焦环默认 lineWidth*2 偏粗；品牌色较深时边框+阴影叠加重。收紧为更接近系统默认的细环
          controlOutlineWidth: 1,
        },
        components: {
          Input: {
            hoverBorderColor: '#91caff',
            activeBorderColor: '#69b1ff',
            activeShadow: '0 0 0 1px rgba(22, 119, 255, 0.22)',
          },
          Select: {
            hoverBorderColor: '#91caff',
            activeBorderColor: '#69b1ff',
            activeOutlineColor: 'rgba(22, 119, 255, 0.22)',
          },
        },
      }}
    >
      <div 
        className={`login-container lang-${i18n.language}`}
        style={{
          background: themeColor, // 固定背景色，不受全局主题影响
        }}
      >
      {/* 右上角工具栏（语言切换） */}
      <div
        className="login-toolbar"
        style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <Tooltip
          title={t('pages.login.switchLanguage')}
          placement="bottomLeft"
          getPopupContainer={(triggerNode) => triggerNode.parentElement || document.body}
          styles={{ root: { maxWidth: '200px' } }}
        >
          <Button
            type="default"
            onClick={() => {
              const currentLang = i18n.language;
              const nextLang = currentLang === 'zh-CN' ? 'en-US' : 'zh-CN';
              i18n.changeLanguage(nextLang);
            }}
            style={{
              backgroundColor: '#fff',
              color: themeColor,
              borderColor: themeColor,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              minWidth: '72px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 12px',
              fontWeight: 600,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <GlobalOutlined style={{ fontSize: '16px' }} />
              <span style={{ fontSize: '14px', lineHeight: 1 }}>
                {i18n.language === 'zh-CN' ? '中' : 'EN'}
              </span>
            </div>
          </Button>
        </Tooltip>
      </div>

      {/* LOGO 和框架名称（手机端显示在顶部） */}
      <div 
        className="logo-header"
        style={{
          background: themeColor,
          opacity: 1, // 不再因平台设置加载中隐藏，避免 API 不可达时长期空白
          transition: 'opacity 0.3s ease-in-out',
        }}
      >
        {logoBroken ? (
          <div className="logo-img logo-img-fallback" aria-hidden>
            <AppstoreOutlined />
          </div>
        ) : (
          <img
            key={logoUrl}
            src={logoUrl}
            alt={localizedPlatformName}
            className="logo-img"
            width={48}
            height={48}
            loading="eager"
            fetchpriority="high"
            decoding="async"
            style={{
              opacity: 1,
              transition: 'opacity 0.3s ease-in-out',
            }}
            onLoad={handleLogoImgLoad}
            onError={handleLogoImgError}
          />
        )}
        <Title level={2} className="logo-title" style={{
          opacity: 1, // 不再因平台设置加载中隐藏，避免 API 不可达时长期空白
          transition: 'opacity 0.3s ease-in-out',
        }}>
          {localizedPlatformName}
        </Title>
      </div>

      {/* 左侧品牌展示区（桌面端显示，手机端隐藏） */}
      <div 
        className="login-left"
        style={{
          background: themeColor,
          ['--login-theme-color' as string]: themeColor,
        }}
      >
        {loginBackgroundEnabled && backgroundImageUrl ? (
          <div className="login-left-bg-image" aria-hidden>
            <img src={backgroundImageUrl} alt="" />
          </div>
        ) : null}
        {loginBackgroundEnabled && backgroundAnimationData && !backgroundImageUrl ? (
          <>
            <div className="login-left-bg-lottie" aria-hidden>
              <Suspense fallback={null}>
                <LottiePlayer
                  key="bg-white"
                  animationData={backgroundAnimationData}
                  loop
                  rendererSettings={{ preserveAspectRatio: 'xMidYMax slice' }}
                />
              </Suspense>
            </div>
          </>
        ) : null}
        {loginBackgroundEnabled ? <div className="login-left-bg-overlay" aria-hidden /> : null}

        {/* LOGO 和框架名称放在左上角（桌面端） */}
        <div className="logo-top-left" style={{
          opacity: 1, // 不再因平台设置加载中隐藏，避免 API 不可达时长期空白
          transition: 'opacity 0.3s ease-in-out',
        }}>
          {logoBroken ? (
            <div className="logo-img logo-img-fallback" aria-hidden>
              <AppstoreOutlined />
            </div>
          ) : (
            <img
              key={logoUrl}
              src={logoUrl}
              alt={localizedPlatformName}
              className="logo-img"
              width={48}
              height={48}
              loading="eager"
              fetchpriority="high"
              decoding="async"
              style={{
                opacity: 1,
                transition: 'opacity 0.3s ease-in-out',
              }}
              onLoad={handleLogoImgLoad}
              onError={handleLogoImgError}
            />
          )}
          <Title level={2} className="logo-title" style={{
            opacity: 1, // 不再因平台设置加载中隐藏，避免 API 不可达时长期空白
            transition: 'opacity 0.3s ease-in-out',
          }}>
            {localizedPlatformName}
          </Title>
        </div>

        <div className="login-left-content">
          {/* 装饰画显示在左侧上方（懒加载，未加载时显示占位） */}
          {loginDecorationEnabled ? (
          <div className="login-decoration-lottie">
            {decorationImageUrl ? (
              <img
                src={decorationImageUrl}
                alt={t('pages.system.siteSettings.loginDecorationImage')}
                className="login-decoration-image"
              />
            ) : animationData ? (
              <Suspense fallback={<div className="login-decoration-lottie-placeholder" />}>
                <LottiePlayer
                  animationData={animationData}
                  loop
                  style={{ width: '100%', maxWidth: '400px',height: 'auto' }}
                />
              </Suspense>
            ) : (
              <div className="login-decoration-lottie-placeholder" />
            )}
          </div>
          ) : null}

          {/* 框架简介显示在图片下方 */}
          <div className="login-description">
            {platformSettings?.login_title || platformSettings?.login_content ? (
              <>
                <Title level={3} className="description-title">
                  {i18n.language === 'en-US' 
                    ? (platformSettings.login_title_en || platformSettings.login_title || platformSettings.platform_name) 
                    : (platformSettings.login_title || platformSettings.platform_name)}
                </Title>
                {(platformSettings.login_content || platformSettings.login_content_en) && (
                  <LoginDescriptionContent
                    content={
                      i18n.language === 'en-US'
                        ? (platformSettings.login_content_en || platformSettings.login_content)
                        : platformSettings.login_content
                    }
                  />
                )}
              </>
            ) : (
              <>
                <Title level={3} className="description-title">
                  {t('pages.login.descriptionTitle')}
                </Title>
                <Text className="description-text">
                  {t('pages.login.descriptionText')}
                </Text>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 右侧登录表单区 */}
      <div className="login-right">
        <div className="login-form-wrapper">
          <div className="login-form-header">
            <Title level={2} className="form-title" style={{
              opacity: 1,
              transition: 'opacity 0.3s ease-in-out',
            }}>
              {localizedPlatformName ? t('pages.login.welcomeWithName', { name: localizedPlatformName }) : t('pages.login.welcome')}
            </Title>
            <Text className="form-subtitle">{t('pages.login.formSubtitle')}</Text>
          </div>

          <Form<LoginFormData>
            onFinish={handleSubmit}
            size="large"
            layout="vertical"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: t('pages.login.usernameRequired') }]}
            >
              <Input
                size="large"
                prefix={<UserOutlined />}
                placeholder={t('pages.login.usernamePlaceholder')}
                autoComplete="username"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: t('pages.login.passwordRequired') }]}
            >
              <Input.Password
                size="large"
                prefix={<LockOutlined />}
                placeholder={t('pages.login.passwordPlaceholder')}
                autoComplete="current-password"
              />
            </Form.Item>

            {/* 长按验证 - 仅在检测到频繁操作且未验证时显示，按需懒加载 */}
            {requireVerification && !isVerified && (() => {
              const verifyDuration = calculateVerifyDuration(loginFailTimes.length);
              return (
                <div style={{ marginBottom: 24 }}>
                  <Tooltip title={t('pages.login.verifyTip', { seconds: verifyDuration / 1000 })} placement="top">
                    <div>
                      <Suspense fallback={<Button size="large" block loading>{t('pages.login.verifyLoading')}</Button>}>
                        <LongPressVerify
                          duration={verifyDuration}
                          onVerify={handleVerify}
                          text={t('pages.login.longPressVerify', { seconds: verifyDuration / 1000 })}
                          size="large"
                          disabled={false}
                        />
                      </Suspense>
                    </div>
                  </Tooltip>
                </div>
              );
            })()}

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={isSubmitting}
                style={{
                  width: '100%',
                  height: '40px',
                  backgroundColor: themeColor,
                  borderColor: themeColor,
                }}
              >
                {t('pages.login.submit')}
              </Button>
            </Form.Item>
          </Form>

          <div className="login-form-footer">
            {/* 社交登录区域 */}
            {loginQuickEnabled && (
            <div style={{ marginTop: 24, marginBottom: 24 }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '12px',
                marginBottom: 12
              }}>
                {/* 左侧分割线 */}
                <div style={{ 
                  flex: 1, 
                  height: '1px', 
                  background: 'rgba(0, 0, 0, 0.1)',
                  maxWidth: '80px'
                }}></div>
                
                {/* 社交图标按钮 */}
                <div style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  alignItems: 'center',
                  flexWrap: 'wrap'
                }}>
                  {/* 微信登录 */}
                  <Tooltip title={t('pages.login.wechatLogin')}>
                    <Button
                      type="default"
                      shape="circle"
                      size="large"
                      onClick={() => handleSocialLogin('wechat')}
                      className="social-login-btn social-login-btn-wechat"
                      style={{
                        width: '40px',
                        height: '40px',
                        flexShrink: 0, // ⚠️ 关键修复：防止小屏下 Flex 挤压变形
                        backgroundColor: 'rgba(7, 193, 96, 0.7)',
                        borderColor: 'rgba(7, 193, 96, 0.7)',
                        borderWidth: '0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#07C160';
                        e.currentTarget.style.borderColor = '#07C160';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(7, 193, 96, 0.7)';
                        e.currentTarget.style.borderColor = 'rgba(7, 193, 96, 0.7)';
                      }}
                    >
                      {socialIcons.wechat && (
                        <img 
                          src={socialIcons.wechat} 
                          alt={t('pages.login.wechatLogin')} 
                          style={{ width: '24px', height: '24px', filter: 'brightness(0) invert(1)' }}
                        />
                      )}
                    </Button>
                  </Tooltip>
                  {/* QQ登录 */}
                  <Tooltip title={t('pages.login.qqLogin')}>
                    <Button
                      type="default"
                      shape="circle"
                      size="large"
                      onClick={() => handleSocialLogin('qq')}
                      className="social-login-btn social-login-btn-qq"
                      style={{
                        width: '40px',
                        height: '40px',
                        flexShrink: 0, // ⚠️ 关键修复：防止小屏下 Flex 挤压变形
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(18, 183, 245, 0.7)',
                        borderColor: 'rgba(18, 183, 245, 0.7)',
                        borderWidth: '0',
                        padding: 0,
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#12B7F5';
                        e.currentTarget.style.borderColor = '#12B7F5';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(18, 183, 245, 0.7)';
                        e.currentTarget.style.borderColor = 'rgba(18, 183, 245, 0.7)';
                      }}
                    >
                      {socialIcons.qq && (
                        <img 
                          src={socialIcons.qq} 
                          alt={t('pages.login.qqLogin')} 
                          style={{ width: '24px', height: '24px', filter: 'brightness(0) invert(1)' }}
                        />
                      )}
                    </Button>
                  </Tooltip>
                  {/* 企业微信登录 */}
                  <Tooltip title={t('pages.login.wechatWorkLogin')}>
                    <Button
                      type="default"
                      shape="circle"
                      size="large"
                      onClick={() => handleSocialLogin('wechat_work')}
                      className="social-login-btn social-login-btn-wechat-work"
                      style={{
                        width: '40px',
                        height: '40px',
                        flexShrink: 0, // ⚠️ 关键修复：防止小屏下 Flex 挤压变形
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(120, 195, 64, 0.5)',
                        borderColor: 'rgba(120, 195, 64, 0.5)',
                        borderWidth: '0',
                        padding: 0,
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#78C340';
                        e.currentTarget.style.borderColor = '#78C340';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(120, 195, 64, 0.7)';
                        e.currentTarget.style.borderColor = 'rgba(120, 195, 64, 0.7)';
                      }}
                    >
                      {socialIcons.qwei && (
                        <img 
                          src={socialIcons.qwei} 
                          alt={t('pages.login.wechatWorkLogin')} 
                          style={{ width: '24px', height: '24px', filter: 'brightness(0) invert(1)' }}
                        />
                      )}
                    </Button>
                  </Tooltip>
                  {/* 钉钉登录 */}
                  <Tooltip title={t('pages.login.dingtalkLogin')}>
                    <Button
                      type="default"
                      shape="circle"
                      size="large"
                      onClick={() => handleSocialLogin('dingtalk')}
                      className="social-login-btn social-login-btn-dingtalk"
                      style={{
                        width: '40px',
                        height: '40px',
                        flexShrink: 0, // ⚠️ 关键修复：防止小屏下 Flex 挤压变形
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(0, 117, 255, 0.5)',
                        borderColor: 'rgba(0, 117, 255, 0.5)',
                        borderWidth: '0',
                        padding: 0,
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#0075FF';
                        e.currentTarget.style.borderColor = '#0075FF';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(0, 117, 255, 0.5)';
                        e.currentTarget.style.borderColor = 'rgba(0, 117, 255, 0.5)';
                      }}
                    >
                      {socialIcons.dingtalk && (
                        <img 
                          src={socialIcons.dingtalk} 
                          alt={t('pages.login.dingtalkLogin')} 
                          style={{ width: '24px', height: '24px', filter: 'brightness(0) invert(1)' }}
                        />
                      )}
                    </Button>
                  </Tooltip>
                  {/* 飞书登录 */}
                  <Tooltip title={t('pages.login.feishuLogin')}>
                    <Button
                      type="default"
                      shape="circle"
                      size="large"
                      onClick={() => handleSocialLogin('feishu')}
                      className="social-login-btn social-login-btn-feishu"
                      style={{
                        width: '40px',
                        height: '40px',
                        flexShrink: 0, // ⚠️ 关键修复：防止小屏下 Flex 挤压变形
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(51, 112, 255, 0.5)',
                        borderColor: 'rgba(51, 112, 255, 0.5)',
                        borderWidth: '0',
                        padding: 0,
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#3370FF';
                        e.currentTarget.style.borderColor = '#3370FF';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(51, 112, 255, 0.5)';
                        e.currentTarget.style.borderColor = 'rgba(51, 112, 255, 0.5)';
                      }}
                    >
                      {socialIcons.feishu && (
                        <img 
                          src={socialIcons.feishu} 
                          alt={t('pages.login.feishuLogin')} 
                          style={{ width: '24px', height: '24px', filter: 'brightness(0) invert(1)' }}
                        />
                      )}
                    </Button>
                  </Tooltip>
                </div>
                
                {/* 右侧分割线 */}
                <div style={{ 
                  flex: 1, 
                  height: '1px', 
                  background: 'rgba(0, 0, 0, 0.1)',
                  maxWidth: '80px'
                }}></div>
              </div>
            </div>
            )}

            {loginGuestEnabled && (
            <div style={{ marginBottom: 16 }}>
                <Button
                  type="default"
                  size="large"
                  className="login-guest-login-btn"
                  icon={<ThunderboltOutlined className="login-guest-login-btn-icon" aria-hidden />}
                  block
                  onClick={handleGuestLogin}
                  style={{ height: 40 }}
                >
                  {t('pages.login.guestLogin')}
                </Button>
            </div>
            )}

            {registerEnabled && (
              <Text
                className="register-link"
                style={{
                  color: themeColor,
                }}
              >
                {t('pages.login.noAccount')}
                <Button
                  type="link"
                  style={{ padding: 0, color: themeColor, textDecoration: 'underline', textUnderlineOffset: '4px' }}
                  onClick={() => {
                    setRegisterDrawerVisible(true);
                    setRegisterType('personal');
                  }}
                >
                  {t('pages.login.registerNow')}
                </Button>
              </Text>
            )}
          </div>

          {showClientDownloads && (
          <div
            className="login-client-downloads"
            aria-label={`${t('pages.login.clientDownloadWinTitle')}, ${t('pages.login.clientDownloadAndroidTitle')}`}
          >
            <div className="login-client-downloads-grid">
              {loginClientWinEnabled && (
              <button
                type="button"
                className="login-client-download-tile"
                onClick={() => handleClientDownload('windows')}
                style={{ ['--client-tile-accent' as string]: themeColor }}
              >
                <WindowsFilled className="login-client-download-tile-brand login-client-download-tile-brand--win" aria-hidden />
                <div className="login-client-download-tile-body">
                  <span className="login-client-download-tile-name">{t('pages.login.clientDownloadWinTitle')}</span>
                  <span className="login-client-download-tile-meta">{t('pages.login.clientDownloadWinMeta')}</span>
                </div>
                <DownloadOutlined className="login-client-download-tile-arrow" aria-hidden />
              </button>
              )}
              {loginClientAndroidEnabled && (
              <button
                type="button"
                className="login-client-download-tile"
                onClick={() => handleClientDownload('android_pda')}
                style={{ ['--client-tile-accent' as string]: themeColor }}
              >
                <AndroidFilled className="login-client-download-tile-brand login-client-download-tile-brand--android" aria-hidden />
                <div className="login-client-download-tile-body">
                  <span className="login-client-download-tile-name">{t('pages.login.clientDownloadAndroidTitle')}</span>
                  <span className="login-client-download-tile-meta">{t('pages.login.clientDownloadAndroidMeta')}</span>
                </div>
                <DownloadOutlined className="login-client-download-tile-arrow" aria-hidden />
              </button>
              )}
            </div>
          </div>
          )}
        </div>

        <div className="login-bottom-fixed">
          <p className="login-browser-hint-footnote" role="note">
            {t('pages.login.browserHintShort')}
          </p>
          <div className="login-footer-links">
            <Space separator={<span style={{ color: '#d9d9d9' }}>|</span>} size="small">
              {(platformSettings?.icp_license || platformSettings?.icp_license_en) && (
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  {t('pages.login.icpLicense')}
                  {i18n.language === 'en-US' 
                    ? (platformSettings.icp_license_en || platformSettings.icp_license) 
                    : platformSettings.icp_license}
                </Text>
              )}
              <Button
                type="link"
                size="small"
                style={{ padding: 0, fontSize: '11px', height: 'auto', color: themeColor }}
                onClick={() => {
                  setTermsModalType('user');
                  setTermsModalVisible(true);
                }}
              >
                {t('pages.login.userTerms')}
              </Button>
              <Button
                type="link"
                size="small"
                style={{ padding: 0, fontSize: '11px', height: 'auto', color: themeColor }}
                onClick={() => {
                  setTermsModalType('privacy');
                  setTermsModalVisible(true);
                }}
              >
                {t('pages.login.privacyTerms')}
              </Button>
            </Space>
          </div>
        </div>
      </div>

      {/* 组织选择弹窗 - 懒加载，仅多组织登录时加载 */}
      {loginResponse && (
        <Suspense fallback={null}>
          <TenantSelectionModal
            open={tenantSelectionVisible}
            tenants={loginResponse.tenants || []}
            defaultTenantId={loginResponse.default_tenant_id}
            onSelect={handleTenantSelect}
            onCancel={() => {
              setTenantSelectionVisible(false);
              setToken('');
              message.info(t('pages.login.pleaseLoginAgain'));
            }}
          />
        </Suspense>
      )}

      {/* 条款弹窗 - 懒加载，仅点击条款链接时加载 */}
      {termsModalVisible && (
        <Suspense fallback={null}>
          <TermsModal
            open={termsModalVisible}
            type={termsModalType}
            onClose={() => setTermsModalVisible(false)}
          />
        </Suspense>
      )}

      {/* 注册选择抽屉（按需懒加载） */}
      {registerDrawerVisible && (
        <Suspense fallback={<Spin style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />}>
          <LazyRegisterDrawer
            open={registerDrawerVisible}
            onClose={() => {
              setRegisterDrawerVisible(false);
              setRegisterType('personal');
            }}
            registerType={registerType}
            setRegisterType={setRegisterType}
            themeColor={themeColor}
            token={token}
            handlePersonalRegister={handlePersonalRegister}
            handleOrganizationRegister={handleOrganizationRegister}
            tenantCheckResult={tenantCheckResult}
            tenantSearchOptions={tenantSearchOptions}
            selectedTenant={selectedTenant}
            searchingTenant={searchingTenant}
            handleSearchTenant={handleSearchTenant}
            handleSelectTenant={handleSelectTenant}
            setTenantSearchOptions={setTenantSearchOptions}
            setSelectedTenant={setSelectedTenant}
            setTenantCheckResult={setTenantCheckResult}
          />
        </Suspense>
      )}

    </div>
    </ConfigProvider>
  );
}
