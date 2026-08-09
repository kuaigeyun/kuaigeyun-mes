import { useEffect, useRef, useState } from 'react';
import { applyLanguageFromLocalCache, isLanguageInitialized } from '../config/i18n';
import { useGlobalStore } from '../stores/globalStore';
import { useThemeStore } from '../stores/themeStore';
import { useUserPreferenceStore } from '../stores/userPreferenceStore';
import { refreshAppShellFromApi } from '../utils/appShellSessionInit';

/**
 * 等待主题与语言就绪后再展示主界面，避免英文界面中文闪烁。
 * 登录/切换账户：本地缓存先占位并立刻放行，云端偏好在后台刷新，不阻塞进入工作台。
 */
export function useAppShellReady(): boolean {
  const currentUserId = useGlobalStore((s) => s.currentUser?.id);
  const currentTenantId = useGlobalStore((s) => s.currentUser?.tenant_id);
  const themeInitialized = useThemeStore((s) => s.initialized);
  const [localeReady, setLocaleReady] = useState(false);
  const prevUserIdRef = useRef<number | string | undefined>(undefined);
  const prevTenantIdRef = useRef<number | string | undefined | null>(undefined);

  useEffect(() => {
    const prevUserId = prevUserIdRef.current;
    const prevTenantId = prevTenantIdRef.current;
    prevUserIdRef.current = currentUserId;
    prevTenantIdRef.current = currentTenantId;

    // 登出：不重置壳层，避免全屏 Spin 阻塞跳转登录页
    if (prevUserId != null && currentUserId == null) {
      setLocaleReady(true);
      return;
    }

    const userChanged = currentUserId != null && prevUserId !== currentUserId;
    const tenantChanged =
      currentUserId != null &&
      prevUserId === currentUserId &&
      prevTenantId !== undefined &&
      prevTenantId !== currentTenantId;
    const sessionChanged = userChanged || tenantChanged;

    let cancelled = false;

    void (async () => {
      if (sessionChanged) {
        useUserPreferenceStore.getState().rehydrateFromStorage();
        useThemeStore.getState().applyFromLocalCache();
        await applyLanguageFromLocalCache();
        if (!cancelled) {
          setLocaleReady(true);
        }
        void refreshAppShellFromApi({ force: true });
        return;
      }

      if (themeInitialized && isLanguageInitialized()) {
        if (!cancelled) {
          setLocaleReady(true);
        }
        return;
      }

      setLocaleReady(false);
      try {
        await refreshAppShellFromApi();
      } catch {
        useUserPreferenceStore.getState().rehydrateFromStorage();
        useThemeStore.getState().applyFromLocalCache();
        await applyLanguageFromLocalCache();
      } finally {
        if (!cancelled) {
          setLocaleReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, currentTenantId, themeInitialized]);

  return themeInitialized && localeReady && isLanguageInitialized();
}
