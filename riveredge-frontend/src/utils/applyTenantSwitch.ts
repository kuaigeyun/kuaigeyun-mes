/**
 * 租户软切换：更新会话上下文后清缓存并跳转首页，避免 location.reload() 重解析巨量 vendor。
 *
 * 频繁切换时必须：取消上一波请求 → 再清缓存；并串行化侧效，避免叠风暴打满后端连接池。
 */
import type { QueryClient } from '@tanstack/react-query';
import type { NavigateFunction } from 'react-router-dom';
import { useGlobalStore } from '../stores/globalStore';
import { useUserPreferenceStore } from '../stores/userPreferenceStore';
import { applyAppShellFromLocalCache, abandonAppShellRefreshInFlight, refreshAppShellFromApi } from './appShellSessionInit';
import {
  getImmediatePostLoginHomePath,
  refinePostLoginHomeInBackground,
} from './tenantHomePath';
import { isRequestCancellation } from './requestCancellation';

let tenantSwitchGeneration = 0;

export function getTenantSwitchGeneration(): number {
  return tenantSwitchGeneration;
}

/** 切换租户后使侧栏/业务 Query 与主题语言按新租户重新拉取 */
export async function applyTenantSwitchSideEffects(
  queryClient: QueryClient,
  navigate: NavigateFunction,
): Promise<void> {
  const generation = ++tenantSwitchGeneration;

  await queryClient.cancelQueries();
  if (generation !== tenantSwitchGeneration) return;

  abandonAppShellRefreshInFlight();
  queryClient.clear();
  useGlobalStore.getState().incrementApplicationMenuVersion();

  useUserPreferenceStore.getState().rehydrateFromStorage();
  applyAppShellFromLocalCache();

  const homePath = getImmediatePostLoginHomePath();
  navigate(homePath, { replace: true });
  refinePostLoginHomeInBackground(navigate, homePath);

  try {
    await refreshAppShellFromApi({ force: true });
  } catch (error) {
    if (generation !== tenantSwitchGeneration && isRequestCancellation(error)) {
      return;
    }
    throw error;
  }
  if (generation !== tenantSwitchGeneration) return;
}
