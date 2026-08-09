import { useQuery } from '@tanstack/react-query';
import { getMyFieldMasks } from '../services/permissionPolicy';
import type { UserFieldMaskMap } from '../utils/fieldMaskPermission';
import { useCurrentUser } from './useCurrentUser';

export const USER_FIELD_MASKS_QUERY_KEY = 'userFieldMasks';

export function useUserFieldMasks(): UserFieldMaskMap | undefined {
  const currentUser = useCurrentUser();
  const tenantId = currentUser?.tenant_id ?? null;
  const permissionVersion = currentUser?.permission_version ?? 0;

  const { data } = useQuery({
    queryKey: [USER_FIELD_MASKS_QUERY_KEY, tenantId, permissionVersion] as const,
    queryFn: getMyFieldMasks,
    enabled: !!currentUser?.id && tenantId != null,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  return data;
}
