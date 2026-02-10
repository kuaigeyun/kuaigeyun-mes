import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getUserPreference, updateUserPreference } from '../services/userPreference';
import { useConfigStore } from './configStore';

const PREFERENCE_STORAGE_KEY = 'user-preference-storage';

/**
 * 从 localStorage 直接读取已持久化的偏好（与 zustand persist 使用相同 key）。
 * 用于 fetchPreferences 合并时避免与 persist 异步 rehydrate 的竞态，确保能拿到本地缓存。
 */
function getPersistedPreferences(): Record<string, any> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(PREFERENCE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { state?: { preferences?: Record<string, any> }; preferences?: Record<string, any> };
    return parsed?.state?.preferences ?? parsed?.preferences ?? {};
  } catch {
    return {};
  }
}

interface UserPreferenceState {
  preferences: Record<string, any>;
  loading: boolean;
  initialized: boolean;
  
  // Actions
  fetchPreferences: () => Promise<void>;
  updatePreferences: (newPrefs: Record<string, any>) => Promise<void>;
  getPreference: <T>(key: string, defaultValue?: T) => T;
  
  // Table sync helpers
  syncTablePreference: (tableId: string, state: Record<string, any>) => Promise<void>;
}

export const useUserPreferenceStore = create<UserPreferenceState>()(
  persist(
    (set, get) => ({
      preferences: {},
      loading: false,
      initialized: false,

      fetchPreferences: async () => {
        set({ loading: true });
        try {
          const data = await getUserPreference();
          const backendPrefs = data.preferences || {};
          
          // 从 localStorage 直接读取本地缓存，避免 persist 尚未 rehydrate 时 get().preferences 为空
          const localPrefs = getPersistedPreferences();
          
          // 深度合并函数
          const deepMerge = (target: any, source: any): any => {
            const output = { ...target };
            if (isObject(target) && isObject(source)) {
              Object.keys(source).forEach(key => {
                if (isObject(source[key])) {
                  if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                  } else {
                    output[key] = deepMerge(target[key], source[key]);
                  }
                } else {
                  Object.assign(output, { [key]: source[key] });
                }
              });
            }
            return output;
          };
          
          const isObject = (item: any) => {
            return (item && typeof item === 'object' && !Array.isArray(item));
          };

          // 合并策略：后端数据覆盖本地数据，但保留本地独有的数据（针对新用户场景）
          // 如果 backendPrefs 为空，则完全保留 localPrefs
          const mergedPrefs = Object.keys(backendPrefs).length === 0 
            ? localPrefs 
            : deepMerge(localPrefs, backendPrefs);

          set({ 
            preferences: mergedPrefs, 
            loading: false, 
            initialized: true 
          });
          
          // 如果后端为空但本地有值（新用户情况），则尝试同步一次到后端
          if (Object.keys(backendPrefs).length === 0 && Object.keys(localPrefs).length > 0) {
             updateUserPreference({ preferences: localPrefs }).catch(console.warn);
          }
          
        } catch (error) {
          console.warn('Failed to fetch user preferences:', error);
          set({ loading: false, initialized: true });
        }
      },

      updatePreferences: async (newPrefs) => {
        set({ loading: true });
        try {
          // 深拷贝当前偏好，避免直接修改状态
          const currentPrefs = JSON.parse(JSON.stringify(get().preferences));
          
          // 辅助函数：处理点号路径赋值
          const setDeep = (obj: any, path: string, value: any) => {
             const keys = path.split('.');
             let current = obj;
             for (let i = 0; i < keys.length - 1; i++) {
               // 如果路径不存在或不是对象，创建一个新对象
               if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
                 current[keys[i]] = {};
               }
               current = current[keys[i]];
             }
             current[keys[keys.length - 1]] = value;
          };

          // 遍历新偏好设置
          Object.keys(newPrefs).forEach(key => {
             if (key.includes('.')) {
                 // 如果键包含点号，使用深度赋值
                 setDeep(currentPrefs, key, newPrefs[key]);
             } else if (typeof newPrefs[key] === 'object' && newPrefs[key] !== null && !Array.isArray(newPrefs[key]) && currentPrefs[key]) {
                 // 如果是对象且当前也存在，进行浅层合并 (支持一级嵌套更新，如 { ui: { ... } })
                 // 为了更安全，这里也应该递归合并，但目前一级合并通常够用
                 // 实际上，为了完全安全，建议尽量使用点号路径更新单个值
                 currentPrefs[key] = { ...currentPrefs[key], ...newPrefs[key] };
             } else {
                 // 其他情况直接赋值
                 currentPrefs[key] = newPrefs[key];
             }
          });
          
          // 调用 API 更新
          await updateUserPreference({ preferences: currentPrefs });
          
          set({ 
            preferences: currentPrefs, 
            loading: false 
          });
          
          // 触发全局事件通知其他组件
          window.dispatchEvent(new CustomEvent('userPreferenceUpdated', {
            detail: { preferences: currentPrefs }
          }));
          
        } catch (error) {
          console.error('Failed to update user preferences:', error);
          set({ loading: false });
          throw error;
        }
      },

      getPreference: <T>(key: string, defaultValue?: T): T => {
        const { preferences } = get();
        // 支持点号路径访问，如 'ui.default_page_size'
        const keys = key.split('.');
        let value = preferences;
        
        for (const k of keys) {
          if (value === undefined || value === null) break;
          value = value[k];
        }
        
        // 如果用户偏好未设置，尝试从系统配置获取（如果是 ui.* 配置）
        if (value === undefined && key.startsWith('ui.')) {
           const systemConfig = useConfigStore.getState().getConfig(key, undefined);
           if (systemConfig !== undefined) {
             return systemConfig as unknown as T;
           }
        }

        return (value !== undefined ? value : defaultValue) as T;
      },
      
      syncTablePreference: async (tableId: string, state: Record<string, any>) => {
        // 防抖或节流逻辑应在组件层或此处实现，避免频繁调用 API
        // 这里简单实现直接更新
        const key = `ui.tables.${tableId}`;
        // 仅更新该表格的配置
        await get().updatePreferences({ [key]: state });
      }
    }),
    {
      name: PREFERENCE_STORAGE_KEY,
      partialize: (state) => ({ preferences: state.preferences }), // 只持久化偏好数据
    }
  )
);
