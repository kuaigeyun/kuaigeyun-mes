/**
 * 生命周期解析器工厂：将重复的「后端优先 + 前端兜底」逻辑收敛到统一工厂。
 * 适用于阶段线性、status 直接映射的单据（入库、出库、调拨、盘点等）。
 */

import type { LifecycleResult } from '../../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';

export interface LifecycleResolverConfig {
  /** 主阶段定义，顺序即展示顺序 */
  stageDefs: { key: string; label: string }[];
  /** status 值（中英文）映射到 stage key */
  statusToKey: Record<string, string>;
  /** 各阶段的下一步操作建议 */
  nextStepSuggestions: Record<string, string[]>;
  /** 异常分支的 key（如 cancelled、rejected），这些 key 会显示为 exception 样式 */
  exceptionKeys?: string[];
  /** 异常时「当前阶段」对应的 key，若与 stageDefs 中某 key 一致则高亮该节点 */
  exceptionStageKey?: string;
  /** 成功完成的 key（如 completed、full） */
  successKeys?: string[];
  /** 从 record 获取 status，默认 record.status */
  getStatus?: (r: Record<string, unknown>) => string;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

function buildFallbackFromConfig(
  record: Record<string, unknown>,
  config: LifecycleResolverConfig
): BackendLifecycle {
  const getStatus = config.getStatus ?? ((r) => (r?.status as string) ?? '');
  const status = norm(getStatus(record));
  const key = config.statusToKey[status] ?? config.statusToKey[''] ?? config.stageDefs[0]?.key ?? 'draft';
  const found = config.stageDefs.find((s) => s.key === key);
  const stageName = found?.label ?? status ?? config.stageDefs[0]?.label ?? '-';

  const exceptionKeys = new Set(config.exceptionKeys ?? []);
  const successKeys = new Set(config.successKeys ?? []);
  const isException = exceptionKeys.has(key);

  const curIdx = config.stageDefs.findIndex((s) => s.key === key);
  const resolvedCurIdx = curIdx >= 0 ? curIdx : 0;
  const exceptionStageKey = config.exceptionStageKey ?? (exceptionKeys.has(key) ? key : undefined);

  const mainStages = config.stageDefs.map((s, idx) => {
    let st: 'done' | 'active' | 'pending' = 'pending';
    if (isException && exceptionStageKey) {
      st = s.key === exceptionStageKey ? 'active' : 'pending';
    } else if (idx < resolvedCurIdx) {
      st = 'done';
    } else if (idx === resolvedCurIdx) {
      st = 'active';
    }
    return { key: s.key, label: s.label, status: st };
  });

  const lifecycleStatus = isException
    ? 'exception'
    : successKeys.has(key)
      ? 'success'
      : 'normal';

  return {
    current_stage_key: key,
    current_stage_name: stageName,
    status: lifecycleStatus,
    main_stages: mainStages,
    next_step_suggestions: config.nextStepSuggestions[key] ?? [],
  };
}

/**
 * 创建生命周期解析函数。优先使用后端下发的 lifecycle，无则按 config 前端兜底。
 */
export function createLifecycleResolver(config: LifecycleResolverConfig) {
  return function getLifecycle(
    record: Record<string, unknown> | null | undefined
  ): LifecycleResult {
    if (!record) return { percent: 0, stageName: '-', mainStages: [] };
    const backend = (record as Record<string, unknown>).lifecycle as BackendLifecycle | undefined;
    if (backend?.main_stages?.length) return parseBackendLifecycle(backend);
    return parseBackendLifecycle(buildFallbackFromConfig(record as Record<string, unknown>, config));
  };
}
