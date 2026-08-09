import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  buildUserPreferenceQueryKey,
  fetchUserPreferenceRecord,
  userPreferenceQueryOptions,
} from '../config/sessionQueries';
import { useUserPreferenceStore } from '../stores/userPreferenceStore';
import { getToken } from '../utils/auth';

export interface UseUserPreferenceQueryOptions {
  tenantId?: number | string | null;
  userId?: number | string | null;
  enabled?: boolean;
}

/** 用户偏好 Query；成功后派生写入 userPreferenceStore */
export function useUserPreferenceQuery(options: UseUserPreferenceQueryOptions = {}) {
  const tenantId = options.tenantId ?? null;
  const userId = options.userId ?? null;
  const enabled =
    (options.enabled ?? !!getToken()) && tenantId != null && userId != null;

  const query = useQuery({
    queryKey: buildUserPreferenceQueryKey(tenantId, userId),
    queryFn: fetchUserPreferenceRecord,
    enabled,
    retry: false,
    ...userPreferenceQueryOptions,
  });

  useEffect(() => {
    const prefs = query.data?.preferences;
    if (!prefs || typeof prefs !== 'object') return;
    useUserPreferenceStore.getState().applyPreferencesFromServer(prefs);
  }, [query.data]);

  return query;
}
