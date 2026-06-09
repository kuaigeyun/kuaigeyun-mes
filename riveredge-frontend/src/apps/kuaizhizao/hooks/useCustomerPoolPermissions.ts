import { useMemo } from 'react';
import { useGlobalStore } from '../../../stores/globalStore';
import { hasModulePermission } from '../../../utils/permissionContract';

const CUSTOMER_POOL_RESOURCE = 'kuaizhizao:customer-pool';

export function useCustomerPoolPermissions() {
  const currentUser = useGlobalStore((s) => s.currentUser);

  return useMemo(
    () => ({
      canRead: hasModulePermission(currentUser, CUSTOMER_POOL_RESOURCE, 'read'),
      canClaim: hasModulePermission(currentUser, CUSTOMER_POOL_RESOURCE, 'claim'),
      canAssign: hasModulePermission(currentUser, CUSTOMER_POOL_RESOURCE, 'assign'),
      canRelease: hasModulePermission(currentUser, CUSTOMER_POOL_RESOURCE, 'release'),
      canRecycle: hasModulePermission(currentUser, CUSTOMER_POOL_RESOURCE, 'recycle'),
      canUpdateRules: hasModulePermission(currentUser, CUSTOMER_POOL_RESOURCE, 'update'),
    }),
    [currentUser],
  );
}
