import { getEffectiveHome } from '../services/menu';
import { getPersistedConfigs, resolveEffectiveHomePath, useConfigStore } from '../stores/configStore';

/**
 * 登录后 / 已登录访问登录页时的落地路径（与 UniTabs 首位首页一致）。
 */
export async function resolvePostLoginHomePath(configs?: Record<string, any> | null): Promise<string> {
  const effectiveConfigs = configs ?? getPersistedConfigs() ?? useConfigStore.getState().configs ?? {};
  try {
    const effective = await getEffectiveHome();
    return resolveEffectiveHomePath(effective, null, effectiveConfigs);
  } catch {
    return resolveEffectiveHomePath(null, null, effectiveConfigs);
  }
}
