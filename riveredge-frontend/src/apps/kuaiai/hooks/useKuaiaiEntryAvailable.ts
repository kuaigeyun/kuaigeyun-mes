/**
 * KU-AI 是否可用：已安装且启用，且当前用户具备入口权限。
 * 与 BasicLayout 顶栏 AI 助手门控一致。
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getInstalledApplicationList } from '../../../services/application';
import { useGlobalStore } from '../../../stores';
import { hasPermission, resolveUserForMenuPermission } from '../../../utils/permission';

export const KUAIAI_INSTALLED_APPS_QUERY_KEY = ['installedApplications', { is_active: true }] as const;

export function useKuaiaiEntryAvailable(): boolean {
  const currentUser = useGlobalStore((s) => s.currentUser);
  const { data: installedApps } = useQuery({
    queryKey: KUAIAI_INSTALLED_APPS_QUERY_KEY,
    queryFn: () => getInstalledApplicationList({ is_active: true }),
    staleTime: 60_000,
  });

  return useMemo(() => {
    const kuaiaiApp = (installedApps ?? []).find((app) => app.code === 'kuaiai');
    if (!kuaiaiApp) return false;
    if (kuaiaiApp.is_pro && kuaiaiApp.can_access === false) return false;
    const user = resolveUserForMenuPermission(currentUser);
    if (!user) return false;
    if (user.is_tenant_admin || user.is_infra_admin) return true;
    return hasPermission(user, 'kuaiai:entry:read');
  }, [installedApps, currentUser]);
}
