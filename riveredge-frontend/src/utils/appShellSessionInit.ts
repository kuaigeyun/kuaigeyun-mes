/**
 * 应用壳层（主题 + 语言 + 偏好）会话初始化。
 *
 * 登录后：先用本地缓存占位立刻进入工作台，再经 React Query 单次拉取并刷新。
 */
import { applyAppShellLanguageFromCloud, applyLanguageFromLocalCache } from '../config/i18n';
import { getToken, getTenantId } from './auth';
import { getSessionCurrentUser } from './sessionCurrentUser';
import { isKuaireportSharedBrowsePath } from './kuaireportSharedPath';
import { useConfigStore } from '../stores/configStore';
import { resolveThemeFromCloud, useThemeStore } from '../stores/themeStore';
import { useUserPreferenceStore } from '../stores/userPreferenceStore';
import { queryClient } from '../queryClient';
import {
  buildSiteSettingQueryKey,
  buildUserPreferenceQueryKey,
  fetchActiveLanguageList,
  fetchSiteSettingRecord,
  fetchUserPreferenceRecord,
  languageListQueryKey,
} from '../config/sessionQueries';
import { isRequestCancellation } from './requestCancellation';

let refreshInFlight: Promise<void> | null = null;
let refreshInFlightKey: string | null = null;
let refreshGeneration = 0;

function resolveSessionTenantUserIds(): { tenantId: number | string | null; userId: number | string | null } {
  const user = getSessionCurrentUser();
  const tenantId = getTenantId() ?? user?.tenant_id ?? (user as any)?.tenantId ?? null;
  const userId = user?.id ?? (user as any)?.user_id ?? (user as any)?.uuid ?? null;
  return { tenantId, userId };
}

/** 同步：恢复当前账户偏好缓存并应用主题/语言占位 */
export function applyAppShellFromLocalCache(): void {
  useUserPreferenceStore.getState().rehydrateFromStorage();
  useThemeStore.getState().applyFromLocalCache();
  void applyLanguageFromLocalCache();
}

function sessionRefreshKey(): string {
  const { tenantId, userId } = resolveSessionTenantUserIds();
  return `${String(tenantId ?? '')}:${String(userId ?? '')}`;
}

/** cancelQueries 之后调用：丢弃旧壳层 Promise，避免新租户 await 到 CancelledError */
export function abandonAppShellRefreshInFlight(): void {
  refreshGeneration += 1;
  refreshInFlight = null;
  refreshInFlightKey = null;
}

/** 经 Query 缓存拉取站点设置/偏好并刷新主题与语言（可重复调用，内部去重） */
export function refreshAppShellFromApi(options?: { force?: boolean }): Promise<void> {
  const key = sessionRefreshKey();
  // 同一会话可复用进行中的拉取；换租户后 key 变了，不得接上已被 cancelQueries 打成 CancelledError 的旧 Promise
  if (refreshInFlight && refreshInFlightKey === key) {
    return refreshInFlight;
  }

  const generation = ++refreshGeneration;
  let run!: Promise<void>;
  run = (async () => {
    if (!getToken() || isKuaireportSharedBrowsePath()) {
      applyAppShellFromLocalCache();
      return;
    }

    const { tenantId, userId } = resolveSessionTenantUserIds();
    const siteSettingQueryKey = buildSiteSettingQueryKey(tenantId);
    const userPreferenceQueryKey = buildUserPreferenceQueryKey(tenantId, userId);

    const [siteSetting, languageListResponse, userPreference] = await Promise.all([
      queryClient.fetchQuery({
        queryKey: siteSettingQueryKey,
        queryFn: fetchSiteSettingRecord,
        staleTime: options?.force ? 0 : undefined,
      }),
      queryClient.fetchQuery({
        queryKey: languageListQueryKey,
        queryFn: fetchActiveLanguageList,
        staleTime: options?.force ? 0 : undefined,
      }),
      userId != null && tenantId != null
        ? queryClient.fetchQuery({
            queryKey: userPreferenceQueryKey,
            queryFn: fetchUserPreferenceRecord,
            staleTime: options?.force ? 0 : undefined,
          })
        : Promise.resolve(null),
    ]);
    if (generation !== refreshGeneration) return;

    const siteSettings =
      siteSetting?.settings && typeof siteSetting.settings === 'object'
        ? siteSetting.settings
        : null;

    if (siteSettings) {
      try {
        useConfigStore.getState().hydrateFromSettings(siteSettings);
      } catch {
        // 不阻塞壳层
      }
      useThemeStore.setState({ siteThemeSettings: siteSettings });
    }

    const prefs =
      userPreference?.preferences && typeof userPreference.preferences === 'object'
        ? userPreference.preferences
        : useUserPreferenceStore.getState().preferences || {};

    if (userPreference?.preferences) {
      useUserPreferenceStore.getState().applyPreferencesFromServer(userPreference.preferences);
    } else if (options?.force) {
      await useUserPreferenceStore.getState().fetchPreferences({ force: true });
    }

    const mergedPrefs = useUserPreferenceStore.getState().preferences || prefs;
    const { theme, config } = resolveThemeFromCloud(mergedPrefs, siteSettings);
    useThemeStore.getState().applyTheme(theme, config);
    useThemeStore.setState({ initialized: true, loading: false, siteThemeSettings: siteSettings });

    await applyAppShellLanguageFromCloud(
      siteSettings,
      languageListResponse?.items ?? null,
      mergedPrefs,
    );
  })()
    .catch((error) => {
      if (generation !== refreshGeneration && isRequestCancellation(error)) {
        return;
      }
      throw error;
    })
    .finally(() => {
      if (refreshInFlight === run) {
        refreshInFlight = null;
        refreshInFlightKey = null;
      }
    });

  refreshInFlight = run;
  refreshInFlightKey = key;
  return run;
}
