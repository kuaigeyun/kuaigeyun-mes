import type { NavigateFunction } from 'react-router-dom';
import { getEffectiveHome } from '../services/menu';
import { getDefaultTenantHomePath, getPersistedConfigs, resolveEffectiveHomePath, useConfigStore } from '../stores/configStore';

/** 登录后 / 已登录访问登录页时的落地路径（与 UniTabs 首位首页一致）。 */
export async function resolvePostLoginHomePath(configs?: Record<string, any> | null): Promise<string> {
  const effectiveConfigs = configs ?? getPersistedConfigs() ?? useConfigStore.getState().configs ?? {};
  try {
    const effective = await getEffectiveHome();
    return resolveEffectiveHomePath(effective, null, effectiveConfigs);
  } catch {
    return resolveEffectiveHomePath(null, null, effectiveConfigs);
  }
}

/** 登录成功后立刻跳转的路径（不等待 effective-home API） */
export function getImmediatePostLoginHomePath(redirect?: string | null): string {
  const r = redirect?.trim();
  if (r) return r;
  return getDefaultTenantHomePath();
}

/** 后台解析自定义首页，与当前路径不同时 replace（不阻塞登录跳转） */
export function refinePostLoginHomeInBackground(navigate: NavigateFunction, currentPath: string): void {
  void resolvePostLoginHomePath()
    .then((resolvedPath) => {
      if (resolvedPath !== currentPath) {
        navigate(resolvedPath, { replace: true });
      }
    })
    .catch(() => {});
}
