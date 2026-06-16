import { useEffect, useRef, useState } from 'react';
import { initLanguageFromApi, isLanguageInitialized, resetLanguageInitState } from '../config/i18n';
import { useGlobalStore } from '../stores/globalStore';
import { useThemeStore } from '../stores/themeStore';
import { useUserPreferenceStore } from '../stores/userPreferenceStore';

/**
 * 等待主题与语言（含 en-US 语言包、租户/个人偏好）就绪后再展示主界面，避免英文界面中文闪烁。
 */
export function useAppShellReady(): boolean {
  const currentUserId = useGlobalStore((s) => s.currentUser?.id);
  const themeInitialized = useThemeStore((s) => s.initialized);
  const [localeReady, setLocaleReady] = useState(false);
  const prevUserIdRef = useRef<number | string | undefined>(undefined);

  useEffect(() => {
    const prevUserId = prevUserIdRef.current;
    prevUserIdRef.current = currentUserId;

    // 登出：不重置壳层，避免全屏 Spin 阻塞跳转登录页
    if (prevUserId != null && currentUserId == null) {
      setLocaleReady(true);
      return;
    }

    let cancelled = false;
    setLocaleReady(false);

    void (async () => {
      // 登录或切换账户：强制重新拉取主题/偏好，避免沿用上一会话
      if (currentUserId != null && prevUserId !== currentUserId) {
        useThemeStore.setState({ initialized: false, siteThemeSettings: null });
        resetLanguageInitState();
      }

      useUserPreferenceStore.getState().rehydrateFromStorage();
      await Promise.all([
        useThemeStore.getState().initFromApi(),
        initLanguageFromApi(),
      ]);
      if (!cancelled) {
        setLocaleReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  return themeInitialized && localeReady && isLanguageInitialized();
}
