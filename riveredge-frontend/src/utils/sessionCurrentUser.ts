/**
 * 会话当前用户（非 Hook 场景）：Query 缓存 > globalStore > user_info。
 */
import type { CurrentUser } from '../types/api';
import {
  buildCurrentUserQueryKey,
  fetchCurrentUserRecord,
} from '../config/sessionQueries';
import { queryClient } from '../queryClient';
import { useGlobalStore } from '../stores/globalStore';
import { buildRestoredUserFromStorage } from './restoredUser';
import { resolveIsInfraSuperAdminSession } from './infraSuperAdminSession';

export function readCurrentUserFromQueryCache(): CurrentUser | undefined {
  const isInfraSuperAdmin = resolveIsInfraSuperAdminSession();
  return queryClient.getQueryData<CurrentUser>(buildCurrentUserQueryKey(isInfraSuperAdmin));
}

/** 同步读取当前用户：优先 React Query，其次内存 store，最后 localStorage user_info */
export function getSessionCurrentUser(): CurrentUser | undefined {
  return (
    readCurrentUserFromQueryCache() ??
    useGlobalStore.getState().currentUser ??
    buildRestoredUserFromStorage() ??
    undefined
  );
}

/** 强制刷新当前用户 Query 并返回最新数据 */
export async function refetchSessionCurrentUser(): Promise<CurrentUser> {
  const isInfraSuperAdmin = resolveIsInfraSuperAdminSession();
  const queryKey = buildCurrentUserQueryKey(isInfraSuperAdmin);
  await queryClient.invalidateQueries({ queryKey });
  const user = await queryClient.fetchQuery({
    queryKey,
    queryFn: () => fetchCurrentUserRecord(isInfraSuperAdmin),
  });
  const { setUserInfo } = await import('./auth');
  useGlobalStore.getState().setCurrentUser(user);
  setUserInfo(user);
  return user;
}

/** 局部更新会话用户（个人资料保存等）：同步 Query / store / user_info */
export function patchSessionCurrentUser(patch: Partial<CurrentUser>): CurrentUser | undefined {
  const current = getSessionCurrentUser();
  if (!current) return undefined;
  const next = { ...current, ...patch } as CurrentUser;
  useGlobalStore.getState().setCurrentUser(next);
  void import('./auth').then(({ setUserInfo }) => setUserInfo(next));
  queryClient.setQueryData(buildCurrentUserQueryKey(resolveIsInfraSuperAdminSession()), next);
  return next;
}
