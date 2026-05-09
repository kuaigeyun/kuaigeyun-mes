import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfigStore, getDefaultTenantHomePath } from '../stores/configStore';

/**
 * 站点设置「上线向导是否开启」关闭时，将当前页重定向到系统默认首页（防止收藏夹直达；与「系统级仪表盘」开关一致）。
 */
export function useRedirectIfLaunchWizardOff(workplacePath = getDefaultTenantHomePath()) {
  const navigate = useNavigate();
  const initialized = useConfigStore((s) => s.initialized);
  const enabled = useConfigStore((s) => s.configs.enable_launch_wizard !== false);

  useEffect(() => {
    if (!initialized) return;
    if (!enabled) {
      navigate(workplacePath, { replace: true });
    }
  }, [initialized, enabled, navigate, workplacePath]);

  return { initialized, enabled };
}
