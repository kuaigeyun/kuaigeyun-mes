import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getUserPreference, updateUserPreference } from '../services/userPreference';
import { useConfigStore } from './configStore';
import { getTenantId, getUserInfo } from '../utils/auth';

const PREFERENCE_STORAGE_KEY_BASE = 'user-preference-storage';

/** 列偏好 id 统一后一次性清空本地/缓存中的 ui.tables（不做旧 key 映射） */
const TABLE_COLUMN_PREFS_PURGED_FLAG = 'riveredge-table-column-prefs-purged-20260520';

/** 清除 ProTable 列展示 localStorage（ui.tables.*.columns / columnsWidth） */
function clearTableColumnLocalStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('ui.tables.')) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (_) {}
}

function stripUiTablesFromPreferences(preferences: Record<string, any>): Record<string, any> {
  if (!preferences || typeof preferences !== 'object') return preferences;
  const prefs = JSON.parse(JSON.stringify(preferences)) as Record<string, any>;
  if (prefs.ui && typeof prefs.ui === 'object' && 'tables' in prefs.ui) {
    delete prefs.ui.tables;
  }
  return prefs;
}

/** 首次访问新版本时清空浏览器侧旧列偏好缓存 */
function purgeLegacyTableColumnPreferences(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(TABLE_COLUMN_PREFS_PURGED_FLAG)) return;

  clearTableColumnLocalStorage();

  const storageKey = getPreferenceStorageKey();
  if (storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          state?: { preferences?: Record<string, unknown> };
          preferences?: Record<string, unknown>;
        };
        const prefs = parsed?.state?.preferences ?? parsed?.preferences;
        if (prefs && typeof prefs === 'object') {
          const stripped = stripUiTablesFromPreferences(prefs as Record<string, any>);
          if (parsed.state) parsed.state.preferences = stripped;
          else parsed.preferences = stripped;
          localStorage.setItem(storageKey, JSON.stringify(parsed));
        }
      }
    } catch (_) {}
  }

  localStorage.setItem(TABLE_COLUMN_PREFS_PURGED_FLAG, '1');
}

/** 按租户+用户生成缓存 key，未登录返回空（不读写其他用户缓存） */
function getPreferenceStorageKey(): string | null {
  if (typeof window === 'undefined') return null;
  const userInfo = getUserInfo();
  if (!userInfo) return null;
  const tenantId = getTenantId() ?? userInfo?.tenant_id ?? userInfo?.tenantId;
  const userId = userInfo?.id ?? userInfo?.user_id ?? userInfo?.uuid;
  if (tenantId == null || userId == null) return null;
  return `${PREFERENCE_STORAGE_KEY_BASE}-${tenantId}-${userId}`;
}

/** 自定义 storage：按账户/租户多存一份，互不覆盖 */
const preferenceStorage: any = { // 使用 any 暂时规避类型检查，或者需要导入完整类型
  getItem: (_name: string) => {
    const key = getPreferenceStorageKey();
    if (!key) return null;
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  },
  setItem: (_name: string, value: any): void => {
    const key = getPreferenceStorageKey();
    if (!key) return;
    try {
      const str = JSON.stringify(value);
      localStorage.setItem(key, str);
    } catch (_) {}
  },
  removeItem: (_name: string): void => {
    const key = getPreferenceStorageKey();
    if (!key) return;
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  },
};

/** 将偏好中的表格列设置同步到 localStorage，供 ProTable 读取（跨设备/换机后恢复列展示） */
function syncTableColumnsToLocalStorage(preferences: Record<string, any>): void {
  if (typeof window === 'undefined') return;
  const tables = preferences?.ui?.tables;
  if (!tables || typeof tables !== 'object') return;
  Object.keys(tables).forEach((tableId) => {
    const tablePref = tables[tableId];
    const columns = tablePref?.columns ?? tablePref;
    if (columns && typeof columns === 'object') {
      try {
        localStorage.setItem(`ui.tables.${tableId}.columns`, JSON.stringify(columns));
      } catch (_) {}
    }
  });
}

/** 从 localStorage 当前用户 key 同步恢复偏好，供登录后立即展示缓存、再后台拉取最新（供偏好设置页首帧填表） */
export function readCachedPreferencesForCurrentUser(): Record<string, any> {
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

/** 从缓存中提取主题配置，供 themeStore 合并逻辑使用 */
export function getThemeFromPreferenceCache(): { theme: string; theme_config: Record<string, any> } | null {
  const prefs = readCachedPreferencesForCurrentUser();
  if (!prefs || Object.keys(prefs).length === 0) return null;
  const theme = prefs.theme;
  const theme_config = prefs.theme_config;
  if (!theme && (!theme_config || Object.keys(theme_config || {}).length === 0)) return null;
  return {
    theme: theme || 'light',
    theme_config: (theme_config && typeof theme_config === 'object') ? theme_config : {},
  };
}

/** 从缓存中提取语言设置，供 i18n 首帧占位使用 */
export function getLanguageFromPreferenceCache(): string | null {
  const prefs = readCachedPreferencesForCurrentUser();
  const language = prefs?.language;
  return typeof language === 'string' && language ? language : null;
}

interface UserPreferenceState {
  preferences: Record<string, any>;
  loading: boolean;
  initialized: boolean;

  fetchPreferences: (options?: { force?: boolean }) => Promise<void>;
  updatePreferences: (newPrefs: Record<string, any>) => Promise<void>;
  getPreference: <T>(key: string, defaultValue?: T) => T;
  syncTablePreference: (tableId: string, state: Record<string, any>) => Promise<void>;
  /** 登出时调用：仅清空内存状态，不删本地缓存（各账户缓存按 key 多存一份） */
  clearForLogout: () => void;
  /** 同步从当前账户缓存恢复偏好，用于登录后首帧展示；不标记 initialized，后续仍须 fetchPreferences 以数据库为准 */
  rehydrateFromStorage: () => void;
}

export const useUserPreferenceStore = create<UserPreferenceState>()(
  persist(
    (set, get) => ({
      preferences: {},
      loading: false,
      initialized: false,

      fetchPreferences: async (options?: { force?: boolean }) => {
        const { initialized, loading } = get();
        if (loading) return;
        if (!options?.force && initialized) return;

        purgeLegacyTableColumnPreferences();
        // 首帧占位：仅首次拉取前恢复本地缓存；force 或已 initialized 时跳过，避免本地覆盖云端
        if (!options?.force && !initialized) {
          get().rehydrateFromStorage();
        }
        set({ loading: true });
        try {
          const data = await getUserPreference();
          const backendPrefs = data.preferences || {};
          // 仅使用后端数据，保证与当前账户/租户一致，不做跨账户的本地合并
          const finalPrefs = typeof backendPrefs === 'object' && backendPrefs !== null ? backendPrefs : {};
          set({
            preferences: finalPrefs,
            loading: false,
            initialized: true,
          });
          syncTableColumnsToLocalStorage(finalPrefs);
        } catch (error) {
          console.warn('Failed to fetch user preferences:', error);
          // 拉取失败且尚无服务端数据时，才回退到本地缓存
          if (!initialized && Object.keys(get().preferences).length === 0) {
            get().rehydrateFromStorage();
          }
          set({ loading: false, initialized: true });
        }
      },

      clearForLogout: () => {
        set({ preferences: {}, loading: false, initialized: false });
        // 偏好缓存按 key 多存一份，不删；riveredge_theme_config 由 themeStore.clearForLogout 清除
        // 注意：不清除 riveredge_saved_tabs，以便同一用户再次登录时能恢复标签
        try {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('riveredge_tabs_persistence');
          }
        } catch (_) {}
      },

      rehydrateFromStorage: () => {
        purgeLegacyTableColumnPreferences();
        const cached = stripUiTablesFromPreferences(readCachedPreferencesForCurrentUser());
        if (Object.keys(cached).length === 0) return;
        // 仅恢复本地缓存供首帧展示；initialized 仅在 fetchPreferences 完成后置 true，避免跳过 API 拉取
        set((s) => ({ ...s, preferences: cached }));
        syncTableColumnsToLocalStorage(cached);
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
          syncTableColumnsToLocalStorage(currentPrefs);
          
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
      // 禁用启动时自动 rehydrate，避免异步 hydration 在 API 返回后覆盖云端偏好（主题等）
      skipHydration: true,
    }
  )
);
