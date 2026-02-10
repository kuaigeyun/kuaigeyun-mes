import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getUserPreference, updateUserPreference } from '../services/userPreference';
import { useConfigStore } from './configStore';
import { getTenantId, getUserInfo } from '../utils/auth';

const PREFERENCE_STORAGE_KEY_BASE = 'user-preference-storage';

/** 按租户+用户生成缓存 key，未登录返回空（不读写其他用户缓存） */
function getPreferenceStorageKey(): string | null {
  if (typeof window === 'undefined') return null;
  const tenantId = getTenantId();
  const userInfo = getUserInfo();
  const userId = userInfo?.id ?? userInfo?.user_id ?? userInfo?.uuid;
  if (tenantId == null || userId == null) return null;
  return `${PREFERENCE_STORAGE_KEY_BASE}-${tenantId}-${userId}`;
}

/** 自定义 storage：按账户/租户多存一份，互不覆盖 */
const preferenceStorage = {
  getItem: (name: string): string | null => {
    const key = getPreferenceStorageKey();
    if (!key) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    const key = getPreferenceStorageKey();
    if (!key) return;
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
  },
  removeItem: (name: string): void => {
    const key = getPreferenceStorageKey();
    if (!key) return;
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  },
};

/** 从 localStorage 当前用户 key 同步恢复偏好，供登录后立即展示缓存、再后台拉取最新 */
function readCachedPreferencesForCurrentUser(): Record<string, any> {
  const key = getPreferenceStorageKey();
  if (!key) return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { state?: { preferences?: Record<string, any> }; preferences?: Record<string, any> };
    const prefs = parsed?.state?.preferences ?? parsed?.preferences;
    return typeof prefs === 'object' && prefs !== null ? prefs : {};
  } catch {
    return {};
  }
}

interface UserPreferenceState {
  preferences: Record<string, any>;
  loading: boolean;
  initialized: boolean;

  fetchPreferences: () => Promise<void>;
  updatePreferences: (newPrefs: Record<string, any>) => Promise<void>;
  getPreference: <T>(key: string, defaultValue?: T) => T;
  syncTablePreference: (tableId: string, state: Record<string, any>) => Promise<void>;
  /** 登出时调用：仅清空内存状态，不删本地缓存（各账户缓存按 key 多存一份） */
  clearForLogout: () => void;
  /** 同步从当前账户缓存恢复偏好，用于登录后立即生效、避免等接口再刷新 */
  rehydrateFromStorage: () => void;
}

export const useUserPreferenceStore = create<UserPreferenceState>()(
  persist(
    (set, get) => ({
      preferences: {},
      loading: false,
      initialized: false,

      fetchPreferences: async () => {
        // 先按当前账户 key 恢复本地缓存，再拉接口，避免换账号后首帧读到旧数据
        get().rehydrateFromStorage();
        set({ loading: true });
        try {
          const data = await getUserPreference();
          const backendPrefs = data.preferences || {};
          // 仅使用后端数据，保证与当前账户/租户一致，不做跨账户的本地合并
          set({
            preferences: typeof backendPrefs === 'object' && backendPrefs !== null ? backendPrefs : {},
            loading: false,
            initialized: true,
          });
        } catch (error) {
          console.warn('Failed to fetch user preferences:', error);
          set({ loading: false, initialized: true });
        }
      },

      clearForLogout: () => {
        set({ preferences: {}, loading: false, initialized: false });
        // 偏好缓存按 key 多存一份，不删；主题相关为全局 key，登出时清除避免下一账户沿用
        try {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('riveredge_theme_config');
            localStorage.removeItem('riveredge_tabs_persistence');
          }
        } catch (_) {}
      },

      rehydrateFromStorage: () => {
        const cached = readCachedPreferencesForCurrentUser();
        if (Object.keys(cached).length === 0) return;
        set((s) => ({ ...s, preferences: cached, initialized: true }));
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
      name: PREFERENCE_STORAGE_KEY_BASE,
      storage: preferenceStorage,
      partialize: (state) => ({ preferences: state.preferences }),
    }
  )
);
