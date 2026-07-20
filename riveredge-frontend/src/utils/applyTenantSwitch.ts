/**
 * 租户软切换：更新会话上下文后清缓存并跳转首页，避免 location.reload() 重解析巨量 vendor。
 */
import type { QueryClient } from '@tanstack/react-query';
import type { NavigateFunction } from 'react-router-dom';
import { resetLanguageInitState } from '../config/i18n';
import { useGlobalStore } from '../stores/globalStore';
import { useThemeStore } from '../stores/themeStore';
import { useUserPreferenceStore } from '../stores/userPreferenceStore';
import {
  getImmediatePostLoginHomePath,
  refinePostLoginHomeInBackground,
} from './tenantHomePath';

/** 切换租户后使侧栏/业务 Query 与主题语言按新租户重新拉取 */
export function applyTenantSwitchSideEffects(
  queryClient: QueryClient,
  navigate: NavigateFunction,
): void {
  queryClient.clear();
  useGlobalStore.getState().incrementApplicationMenuVersion();

  useThemeStore.setState({ initialized: false, siteThemeSettings: null, loading: false });
  resetLanguageInitState();
  useUserPreferenceStore.getState().rehydrateFromStorage();

  const homePath = getImmediatePostLoginHomePath();
  navigate(homePath, { replace: true });
  refinePostLoginHomeInBackground(navigate, homePath);
}
