/**
 * 从 localStorage 恢复 CurrentUser（与 AuthGuard 兜底逻辑一致），
 * 供 app 与 main 挂载前同步灌入 store，避免刷新首帧无用户态。
 */

import { getToken, getUserInfo, setUserInfo, setTenantId, isInfraSuperAdminUser } from './auth';
import { useGlobalStore } from '../stores/globalStore';
import type { CurrentUser } from '../types/api';

export function buildRestoredUserFromStorage(): CurrentUser | null {
  const savedUserInfo = getUserInfo();
  if (!savedUserInfo) return null;
  return {
    id: savedUserInfo.id || 1,
    username: savedUserInfo.username || 'admin',
    email: savedUserInfo.email,
    full_name: savedUserInfo.full_name,
    is_infra_admin:
      isInfraSuperAdminUser(savedUserInfo) ||
      savedUserInfo.is_infra_admin ||
      false,
    is_tenant_admin: savedUserInfo.is_tenant_admin || false,
    tenant_id: savedUserInfo.tenant_id,
    tenant_name: savedUserInfo.tenant_name,
    permissions: Array.isArray(savedUserInfo.permissions) ? savedUserInfo.permissions : [],
    permission_version: savedUserInfo.permission_version || 1,
    department: savedUserInfo.department,
    position: savedUserInfo.position,
    roles: Array.isArray(savedUserInfo.roles) ? savedUserInfo.roles : [],
    user_type: isInfraSuperAdminUser(savedUserInfo)
      ? ('infra_superadmin' as const)
      : savedUserInfo.user_type,
  };
}

/** 登录成功：同步写入 localStorage 与 globalStore，避免 navigate 时 AuthGuard 仍无 currentUser */
export function applySessionUserAfterLogin(userInfo: Parameters<typeof setUserInfo>[0]): void {
  setUserInfo(userInfo);
  useGlobalStore.getState().setCurrentUser(userInfo as CurrentUser);
  if (userInfo?.tenant_id != null) {
    setTenantId(userInfo.tenant_id);
  }
}

/** 在 React 首帧之前调用：有 token 且 store 尚无用户时，用 user_info 填满 currentUser */
export function seedCurrentUserFromAuthStorage(): void {
  if (typeof window === 'undefined') return;
  const token = getToken();
  const savedUserInfo = getUserInfo();
  const restored = buildRestoredUserFromStorage();
  if (!token || !restored) return;

  const { currentUser, setCurrentUser } = useGlobalStore.getState();
  if (currentUser) return;

  setCurrentUser(restored);
  setUserInfo({
    ...savedUserInfo,
    ...restored,
    ...(isInfraSuperAdminUser(savedUserInfo) ? { user_type: 'infra_superadmin' as const } : {}),
  });
  if (restored.tenant_id != null) {
    setTenantId(restored.tenant_id);
  }
}
