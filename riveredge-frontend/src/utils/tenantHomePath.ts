import { getTenantBackendHome } from '../services/menu';
import { getPersistedConfigs, resolveTenantHomePath, useConfigStore } from '../stores/configStore';

/**
 * 登录后 / 已登录访问登录页时的落地路径：自定义后台首页优先，否则工作台或应用中心。
 */
export async function resolvePostLoginHomePath(configs?: Record<string, any> | null): Promise<string> {
  const effectiveConfigs = configs ?? getPersistedConfigs() ?? useConfigStore.getState().configs ?? {};
  try {
    const backendHome = await getTenantBackendHome();
    return resolveTenantHomePath(backendHome?.path, effectiveConfigs);
  } catch {
    return resolveTenantHomePath(null, effectiveConfigs);
  }
}
