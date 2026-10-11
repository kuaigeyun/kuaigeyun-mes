import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getInstalledApplicationList } from '../services/application';
import { useCurrentUser } from './useCurrentUser';
import { hasPermission, resolveUserForMenuPermission } from '../utils/permission';

export const KUAIAI_INSTALLED_APPS_QUERY_KEY = ['installedApplications', { is_active: true }] as const;

export function useKuaiaiEntryAvailable(): boolean {
  const currentUser = useCurrentUser();
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
