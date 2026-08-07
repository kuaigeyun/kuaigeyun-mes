import type { CurrentUser } from '../types/api';

/** 判断 /auth/me 响应是否与 store 中用户等价，避免无意义的全局重渲染 */
export function isEquivalentCurrentUser(
  prev: CurrentUser | undefined,
  next: CurrentUser,
): boolean {
  if (!prev) return false;
  return (
    prev.id === next.id &&
    prev.uuid === next.uuid &&
    prev.tenant_id === next.tenant_id &&
    prev.permission_version === next.permission_version &&
    prev.username === next.username &&
    prev.full_name === next.full_name &&
    prev.email === next.email &&
    prev.avatar === next.avatar &&
    prev.is_tenant_admin === next.is_tenant_admin &&
    prev.is_infra_admin === next.is_infra_admin &&
    prev.user_type === next.user_type
  );
}
