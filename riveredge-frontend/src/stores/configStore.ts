import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getSiteSetting, updateSiteSetting } from '../services/siteSetting';

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
  
  // Actions
  fetchConfigs: () => Promise<void>;
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

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      configs: { ...DEFAULT_CONFIGS },
      loading: false,
      initialized: false,
      
      fetchConfigs: async () => {
        const { initialized, loading } = get();
        if (initialized || loading) return;
        
        set({ loading: true });
        try {
          const response = await getSiteSetting();
          const backendConfigs = flattenObject(response.settings || {});
          // 合并后端配置与默认配置
          set((state) => ({
            configs: {
              ...state.configs,
              ...backendConfigs,
            },
            initialized: true,
          }));
        } catch (error) {
          console.error('获取系统配置失败:', error);
          // 失败时保持使用缓存或默认配置，但也标记为已初始化以免阻塞应用
          set({ initialized: true });
        } finally {
          set({ loading: false });
        }
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
      partialize: (state) => ({ configs: state.configs, initialized: state.initialized }),
    }
  )
);

const PERSIST_KEY = 'system-config-storage';

/**
 * 同步从 localStorage 读取已持久化的 configs（用于首帧渲染，避免 persist 异步注水前的空白）
 */
export function getPersistedConfigs(): Record<string, any> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { configs?: Record<string, any> }; configs?: Record<string, any> };
    const configs = parsed?.state?.configs ?? parsed?.configs ?? null;
    return configs && typeof configs === 'object' ? configs : null;
  } catch {
    return null;
  }
}
