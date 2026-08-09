/**
 * 从 localStorage 恢复 CurrentUser（与 AuthGuard 兜底逻辑一致），
 * 供 app 与 main 挂载前同步灌入 store，避免刷新首帧无用户态。
 *
 * 会话真源：JWT sub + user_info；zustand 内存态仅作运行时缓存，不再持久化 currentUser。
 */

import {
  getToken,
  getUserInfo,
  setUserInfo,
  setTenantId,
  isInfraSuperAdminUser,
  getTokenSubjectUserId,
} from './auth';
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

function writeRestoredUserToSession(restored: CurrentUser, savedUserInfo: ReturnType<typeof getUserInfo>): void {
  useGlobalStore.getState().setCurrentUser(restored);
  setUserInfo({
    ...savedUserInfo,
    ...restored,
    ...(isInfraSuperAdminUser(savedUserInfo) ? { user_type: 'infra_superadmin' as const } : {}),
  });
  if (restored.tenant_id != null) {
    setTenantId(restored.tenant_id);
  }
}

/** store 中用户与 JWT / user_info 不一致（常见于旧版 zustand 持久化残留体验账户） */
export function isPersistedUserStaleAgainstToken(
  currentUser: CurrentUser | undefined,
  tokenUserId: number | null,
  restored: CurrentUser | null,
): boolean {
  if (!currentUser || tokenUserId == null || !restored) {
    return false;
  }
  return currentUser.id !== tokenUserId || restored.id !== currentUser.id;
}

/** 登录成功：同步写入 localStorage 与 globalStore，避免 navigate 时 AuthGuard 仍无 currentUser */
export function applySessionUserAfterLogin(userInfo: Parameters<typeof setUserInfo>[0]): void {
  setUserInfo(userInfo);
  useGlobalStore.getState().setCurrentUser(userInfo as CurrentUser);
  if (userInfo?.tenant_id != null) {
    setTenantId(userInfo.tenant_id);
  }
}

/** 清理旧版 zustand 持久化的 currentUser，避免与 JWT / user_info 漂移 */
export function purgeLegacyGlobalStoreUser(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('riveredge-global-store');
    if (!raw) return;
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
    if (!parsed?.state || !('currentUser' in parsed.state)) return;
    delete parsed.state.currentUser;
    localStorage.setItem('riveredge-global-store', JSON.stringify(parsed));
  } catch {
    localStorage.removeItem('riveredge-global-store');
  }
}

/**
 * 在 React 首帧之前调用：以 JWT + user_info 灌入 currentUser。
 * 若 zustand 中残留旧用户（如体验账户），以 token 对应 user_info 覆盖。
 */
export function seedCurrentUserFromAuthStorage(): void {
  if (typeof window === 'undefined') return;
  const token = getToken();
  const savedUserInfo = getUserInfo();
  const restored = buildRestoredUserFromStorage();
  if (!token || !restored) return;

  const tokenUserId = getTokenSubjectUserId(token);
  const { currentUser } = useGlobalStore.getState();
  const stalePersistedUser = isPersistedUserStaleAgainstToken(currentUser, tokenUserId, restored);

  if (!currentUser || stalePersistedUser) {
    writeRestoredUserToSession(restored, savedUserInfo);
  }
}
