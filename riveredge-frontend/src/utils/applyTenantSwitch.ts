/**
 * 租户软切换：更新会话上下文后清缓存并跳转首页，避免 location.reload() 重解析巨量 vendor。
 *
 * 频繁切换时必须：取消上一波请求 → 再清缓存；并串行化侧效，避免叠风暴打满后端连接池。
 */
import type { QueryClient } from '@tanstack/react-query';
import type { NavigateFunction } from 'react-router-dom';
import { useGlobalStore } from '../stores/globalStore';
import { useUserPreferenceStore } from '../stores/userPreferenceStore';
import { clearAllSessionTabs } from '../stores/sessionTabsCache';
import { clearTabsData } from '../stores/tabsStorage';
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

/** 组织选择器列表与当前租户无关（超管=平台列表，普通用户=账号可切换列表），清业务缓存后必须立刻回填 */
const TENANT_SELECTOR_OPTIONS_QUERY_ROOT = 'tenant-selector-options';

/** 切换租户后使侧栏/业务 Query 与主题语言按新租户重新拉取 */
export async function applyTenantSwitchSideEffects(
  queryClient: QueryClient,
  navigate: NavigateFunction,
): Promise<void> {
  const generation = ++tenantSwitchGeneration;

  const preservedTenantSelectorOptions = queryClient
    .getQueriesData<unknown>({ queryKey: [TENANT_SELECTOR_OPTIONS_QUERY_ROOT] })
    .filter(([, data]) => data != null);

  await queryClient.cancelQueries();
  if (generation !== tenantSwitchGeneration) return;

  abandonAppShellRefreshInFlight();
  queryClient.clear();
  // 标签会话/本地标签缓存按租户隔离；切换时清掉，避免上一组织打开的质检等页签残留
  clearAllSessionTabs();
  clearTabsData();

  for (const [queryKey, data] of preservedTenantSelectorOptions) {
    queryClient.setQueryData(queryKey, data);
  }

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
