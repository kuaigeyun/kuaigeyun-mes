import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfigStore } from '../stores/configStore';

/** 系统级仪表盘关闭时的默认落地页（侧栏首项「应用中心」） */
export const SYSTEM_DASHBOARD_FALLBACK_PATH = '/system/applications';

/**
 * 站点设置「系统级仪表盘是否显示」关闭时，将系统仪表盘路由重定向到 {@link SYSTEM_DASHBOARD_FALLBACK_PATH}。
 */
export function useRedirectIfSystemDashboardOff(fallbackPath = SYSTEM_DASHBOARD_FALLBACK_PATH) {
  const navigate = useNavigate();
  const initialized = useConfigStore((s) => s.initialized);
  const enabled = useConfigStore((s) => s.configs.enable_system_dashboard !== false);

  useEffect(() => {
    if (!initialized) return;
    if (!enabled) {
      navigate(fallbackPath, { replace: true });
    }
  }, [initialized, enabled, navigate, fallbackPath]);

  return { initialized, enabled };
}
