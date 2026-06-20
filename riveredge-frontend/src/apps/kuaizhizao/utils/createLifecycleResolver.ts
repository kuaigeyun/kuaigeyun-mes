/**
 * 生命周期解析器工厂：以后端 lifecycle 为唯一真源。
 */

import type { LifecycleResult } from '../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';
import { applyLifecycleI18n, type LifecycleTranslateFn } from './lifecycleI18n';
import { getGlobalLifecycleStageLabelKeys } from '../../../utils/globalLifecycleI18n';

export interface LifecycleStageDef {
  key: string;
  label: string;
  labelKey?: string;
}

export interface LifecycleResolverConfig {
  /** 主阶段定义，顺序即展示顺序 */
  stageDefs: LifecycleStageDef[];
  /** status 值（中英文）映射到 stage key */
  statusToKey: Record<string, string>;
  /** 各阶段的下一步操作建议（无 t 时的兜底文案） */
  nextStepSuggestions: Record<string, string[]>;
  /** 各阶段 next-step 的 i18n key（传入 t 时使用） */
  nextStepSuggestionKeys?: Record<string, string[]>;
  /** 异常分支的 key（如 cancelled、rejected），这些 key 会显示为 exception 样式 */
  exceptionKeys?: string[];
  /** 异常时「当前阶段」对应的 key，若与 stageDefs 中某 key 一致则高亮该节点 */
  exceptionStageKey?: string;
  /** 成功完成的 key（如 completed、full） */
  successKeys?: string[];
  /** 从 record 获取 status，默认 record.status */
  getStatus?: (r: Record<string, unknown>) => string;
}

function stageLabelKeysFromConfig(config: LifecycleResolverConfig): Record<string, string> {
  const map: Record<string, string> = {};
  for (const def of config.stageDefs) {
    if (def.labelKey) map[def.key] = def.labelKey;
  }
  return map;
}

/**
 * 创建生命周期解析函数。仅使用后端下发的 lifecycle。
 */
export function createLifecycleResolver(config: LifecycleResolverConfig) {
  const stageLabelKeys = stageLabelKeysFromConfig(config);

  return function getLifecycle(
    record: Record<string, unknown> | null | undefined,
    t?: LifecycleTranslateFn,
  ): LifecycleResult {
    if (!record) return { percent: 0, stageName: '-', mainStages: [] };
    const backend = (record as Record<string, unknown>).lifecycle as BackendLifecycle | undefined;
    const result: LifecycleResult = backend?.main_stages?.length
      ? parseBackendLifecycle(backend)
      : { percent: 0, stageName: '生命周期缺失', status: 'exception', mainStages: [] };
    if (t) {
      return applyLifecycleI18n(
        result,
        t,
        { ...getGlobalLifecycleStageLabelKeys(), ...stageLabelKeys },
        config.nextStepSuggestionKeys,
      );
    }
    return result;
  };
}
