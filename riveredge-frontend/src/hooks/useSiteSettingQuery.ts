import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  buildSiteSettingQueryKey,
  fetchSiteSettingRecord,
  siteSettingQueryOptions,
} from '../config/sessionQueries';
import { useConfigStore } from '../stores/configStore';
import { useThemeStore } from '../stores/themeStore';
import { updateLastActivity } from '../utils/activityUtils';
import { getToken } from '../utils/auth';

export interface UseSiteSettingQueryOptions {
  tenantId?: number | string | null;
  enabled?: boolean;
}

/** 站点设置 Query；成功后派生写入 configStore / themeStore */
export function useSiteSettingQuery(options: UseSiteSettingQueryOptions = {}) {
  const tenantId = options.tenantId ?? null;
  const enabled = (options.enabled ?? !!getToken()) && tenantId != null;

  const query = useQuery({
    queryKey: buildSiteSettingQueryKey(tenantId),
    queryFn: fetchSiteSettingRecord,
    enabled,
    retry: false,
    ...siteSettingQueryOptions,
  });

  useEffect(() => {
    const settings = query.data?.settings;
    if (!settings || typeof settings !== 'object') return;
    useConfigStore.getState().hydrateFromSettings(settings);
    useThemeStore.setState({ siteThemeSettings: settings });
    const inactivity = Number(
      (settings as { security?: { inactivity_timeout?: number } }).security?.inactivity_timeout,
    );
    if (Number.isFinite(inactivity) && inactivity > 0) {
      updateLastActivity(true);
    }
  }, [query.data]);

  return query;
}
