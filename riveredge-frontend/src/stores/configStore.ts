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
  'security.inactivity_timeout': 1800, // 30分钟
  'security.user_cache_time': 300, // 5分钟
  
  'ui.max_tabs': 20,
  'ui.default_page_size': 20,
  'ui.table_loading_delay': 800, // 800ms，快速请求不显示 loading
  'ui.theme.primary_color': '#1890ff',
  
  'network.timeout': 10000,
  'system.max_retries': 3,
};

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      configs: { ...DEFAULT_CONFIGS },
      loading: false,
      initialized: false,
      
      fetchConfigs: async () => {
        set({ loading: true });
        try {
          const response = await getSiteSetting();
          // 合并后端配置与默认配置
          set((state) => ({
            configs: {
              ...state.configs,
              ...(response.settings || {}),
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
          const newConfigs = { ...configs, [key]: value };
          
          await updateSiteSetting({ settings: newConfigs });
          
          set({ configs: newConfigs });
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
          const newConfigs = { ...configs, ...settings };
          
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
      partialize: (state) => ({ configs: state.configs }), // 只持久化配置数据
    }
  )
);
