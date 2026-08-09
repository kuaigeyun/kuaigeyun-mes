import { useGlobalStore } from '../stores';
import type { CurrentUser } from '../types/api';
import { getToken } from '../utils/auth';
import { readCurrentUserFromQueryCache } from '../utils/sessionCurrentUser';
import { useCurrentUserQuery } from './useCurrentUserQuery';

/**
 * 当前登录用户（展示 / 权限门控优先读 Query，store 仅作首帧 fallback）。
 */
export function useCurrentUser(): CurrentUser | undefined {
  const storeUser = useGlobalStore((s) => s.currentUser);
  const queryUser = readCurrentUserFromQueryCache();
  // 订阅 Query 变更以触发重渲染（不重复发请求）
  useCurrentUserQuery({ enabled: !!getToken() });
  return queryUser ?? storeUser;
}
