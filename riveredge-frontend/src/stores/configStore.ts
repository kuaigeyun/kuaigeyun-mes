import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getSiteSetting, updateSiteSetting } from '../services/siteSetting';
import { getTenantId } from '../utils/auth';

/**
 * 系统配置状态接口
 */
interface ConfigState {
  configs: {
    // 安全与会话
    'security.token_check_interval': number;
    'security.inactivity_timeout': number;
    'security.user_cache_time': number;
    
    // 界面与交互
    'ui.max_tabs': number;
    'ui.default_page_size': number;
    'ui.table_loading_delay': number;
    'ui.theme.primary_color': string;
    
    // 网络与系统
    'network.timeout': number;
    'system.max_retries': number;
    
    // 允许任意其他配置
    [key: string]: any;
  };
  
  loading: boolean;
  initialized: boolean;
  
  // Actions（force=true 时忽略「已初始化」短路，用于站点设置保存后刷新全局配置）
  fetchConfigs: (force?: boolean) => Promise<void>;
  /**
   * 直接以外部已获取的 site settings 对象初始化 store（供 themeStore 复用）。
   * 标记 initialized=true 后，后续 fetchConfigs 会短路，避免重复请求 /site-setting。
   */
  hydrateFromSettings: (settings: Record<string, any> | null | undefined) => void;
  updateConfig: (key: string, value: any) => Promise<void>;
  updateConfigs: (settings: Record<string, any>) => Promise<void>;
  getConfig: <T>(key: string, defaultValue: T) => T;
}

// 默认配置
const DEFAULT_CONFIGS = {
  'security.token_check_interval': 60,
  'security.inactivity_timeout': 0, // 0=禁用无操作自动退出（与站点默认一致；仍以服务端站点设置为准）
  'security.user_cache_time': 300, // 5分钟
  
  'ui.max_tabs': 20,
  'ui.default_page_size': 20,
  'ui.table_loading_delay': 0, // 0ms，立即显示 loading
  'ui.theme.primary_color': '#1890ff',
  
  'network.timeout': 10000,
  'system.max_retries': 3,
};

/**
 * 递归展平对象为点分隔键的 Record
 */
function flattenObject(obj: any, prefix = ''): Record<string, any> {
  const flattened: Record<string, any> = {};
  if (!obj || typeof obj !== 'object') return flattened;
  
  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(flattened, flattenObject(value, newKey));
    } else {
      flattened[newKey] = value;
    }
  });
  
  return flattened;
}

/**
 * 当前租户对应的站点配置持久化键（与 zustand persist 一致）
 */
export function getConfigPersistStorageKey(): string {
  try {
    const tid = getTenantId();
    if (tid != null && String(tid).trim() !== '') {
      return `system-config-storage-${tid}`;
    }
  } catch {
    /* ignore */
  }
  return 'system-config-storage-no-tenant';
}

/** createJSONStorage 使用的 Storage 适配器：读写均落在当前租户键上（忽略 persist 传入的 name） */
const tenantScopedLocalStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
  getItem: (_key: string) => localStorage.getItem(getConfigPersistStorageKey()),
  setItem: (_key: string, value: string) => localStorage.setItem(getConfigPersistStorageKey(), value),
  removeItem: (_key: string) => localStorage.removeItem(getConfigPersistStorageKey()),
};

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      configs: { ...DEFAULT_CONFIGS },
      loading: false,
      initialized: false,
      
      fetchConfigs: async (force?: boolean) => {
        const { initialized, loading } = get();
        if (loading) return;
        if (!force && initialized) return;

        set({ loading: true });
        try {
          const response = await getSiteSetting();
          const backendConfigs = flattenObject(response.settings || {});
          // 不设 ...state.configs：后端 JSON 为增量键时，避免上一租户（或旧缓存）的 enable_* 等残留造成串租户
          set({
            configs: {
              ...DEFAULT_CONFIGS,
              ...backendConfigs,
            },
            initialized: true,
          });
        } catch (error) {
          console.error('获取系统配置失败:', error);
          set({ initialized: true });
        } finally {
          set({ loading: false });
        }
      },

      hydrateFromSettings: (settings) => {
        const backendConfigs = flattenObject(settings || {});
        set({
          configs: {
            ...DEFAULT_CONFIGS,
            ...backendConfigs,
          },
          initialized: true,
        });
      },
      
      updateConfig: async (key, value) => {
        set({ loading: true });
        try {
          const { configs } = get();
          // 更新单个配置项时，同时保持状态展平
          const newConfigs = { ...configs, [key]: value };
          
          // 发送给后端的仍是包含嵌套的对象（通过 updateSiteSetting 处理），但 store 内部保持展平
          // 为兼容后端，这里实际上应由 updateSiteSetting 处理嵌套逻辑，但我们至少保证 store 同步
          set({ configs: newConfigs });
          
          // 对站点设置而言，通常采用批量更新更安全，因为后端存储的是 JSON
          await updateSiteSetting({ settings: newConfigs });
        } catch (error) {
          console.error('更新系统配置失败:', error);
          throw error;
        } finally {
          set({ loading: false });
        }
      },
      
      updateConfigs: async (settings) => {
        set({ loading: true });
        try {
          const { configs } = get();
          const flattenedUpdates = flattenObject(settings);
          const newConfigs = { ...configs, ...flattenedUpdates };
          
          await updateSiteSetting({ settings: newConfigs });
          
          set({ configs: newConfigs });
        } catch (error) {
          console.error('批量更新系统配置失败:', error);
          throw error;
        } finally {
          set({ loading: false });
        }
      },
      
      getConfig: (key, defaultValue) => {
        const { configs } = get();
        return configs[key] !== undefined ? configs[key] : defaultValue;
      },
    }),
    {
      name: 'system-config-storage',
      /** 按当前租户隔离 localStorage，避免多组织切换或同浏览器多租户缓存串数据 */
      storage: createJSONStorage(() => tenantScopedLocalStorage),
      partialize: (state) => ({ configs: state.configs, initialized: state.initialized }),
    }
  )
);

/**
 * 同步从 localStorage 读取已持久化的 configs（用于首帧渲染，避免 persist 异步注水前的空白）
 */
export function getPersistedConfigs(): Record<string, any> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getConfigPersistStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { configs?: Record<string, any> }; configs?: Record<string, any> };
    const configs = parsed?.state?.configs ?? parsed?.configs ?? null;
    return configs && typeof configs === 'object' ? configs : null;
  } catch {
    return null;
  }
}

export const TENANT_HOME_WORKPLACE = '/system/dashboard/workplace';
/** 无角色/菜单首页且关闭系统工作台时的独立兜底页（不再使用应用中心） */
export const TENANT_HOME_FALLBACK = '/system/default-home';

/** 历史占位首页 path，切换有效首页时需从标签栏剔除 */
export const LEGACY_TENANT_DEFAULT_HOME_PATHS = [
  TENANT_HOME_WORKPLACE,
  '/system/applications',
  TENANT_HOME_FALLBACK,
] as const;

/** 根据配置对象解析租户默认首页（仅在后端 effective-home 不可用时的本地回退） */
export function getTenantHomePathFromConfigs(configs: Record<string, any> | null | undefined): string {
  return configs?.enable_system_dashboard !== false ? TENANT_HOME_WORKPLACE : TENANT_HOME_FALLBACK;
}

/** 租户菜单主页 + 站点工作台开关（不含角色首页；完整链路请用 effective-home API） */
export function resolveTenantHomePath(
  backendHomePath?: string | null,
  configs?: Record<string, any> | null,
): string {
  const custom = backendHomePath?.trim();
  if (custom) return custom;
  return getTenantHomePathFromConfigs(configs ?? getPersistedConfigs() ?? {});
}

export type EffectiveHomeSource = 'role' | 'menu' | 'workplace' | 'fallback';

/** 合并后端 effective-home 与本地回退 */
export function resolveEffectiveHomePath(
  effective: { path: string } | null | undefined,
  backendHomePath?: string | null,
  configs?: Record<string, any> | null,
): string {
  const p = effective?.path?.trim();
  if (p) return p;
  return resolveTenantHomePath(backendHomePath, configs);
}

/** 登录后默认落地（持久化 configs；关闭「系统级仪表盘」时为应用中心） */
export function getDefaultTenantHomePath(): string {
  return getTenantHomePathFromConfigs(getPersistedConfigs() ?? {});
}
