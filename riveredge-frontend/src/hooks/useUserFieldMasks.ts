import { useQuery } from '@tanstack/react-query';
import { useGlobalStore } from '../stores';
import { getMyFieldMasks } from '../services/permissionPolicy';
import type { UserFieldMaskMap } from '../utils/fieldMaskPermission';

export const USER_FIELD_MASKS_QUERY_KEY = 'userFieldMasks';

export function useUserFieldMasks(): UserFieldMaskMap | undefined {
  const currentUser = useGlobalStore((s) => s.currentUser);
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
