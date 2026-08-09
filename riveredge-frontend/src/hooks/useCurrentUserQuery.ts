import { useQuery } from '@tanstack/react-query';
import { currentUserQueryOptions } from '../config/reactQuery';
import {
  buildCurrentUserQueryKey,
  fetchCurrentUserRecord,
} from '../config/sessionQueries';
import { getToken } from '../utils/auth';
import { resolveIsInfraSuperAdminSession } from '../utils/infraSuperAdminSession';

export interface UseCurrentUserQueryOptions {
  enabled?: boolean;
}

export { resolveIsInfraSuperAdminSession };

/** /auth/me（或平台超管接口）统一 Query */
export function useCurrentUserQuery(options: UseCurrentUserQueryOptions = {}) {
  const isInfraSuperAdmin = resolveIsInfraSuperAdminSession();
  const enabled = options.enabled ?? !!getToken();

  return useQuery({
    queryKey: buildCurrentUserQueryKey(isInfraSuperAdmin),
    queryFn: () => fetchCurrentUserRecord(isInfraSuperAdmin),
    enabled,
    retry: false,
    ...currentUserQueryOptions,
  });
}
