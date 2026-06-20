/**
 * 后端下发的生命周期结构解析为前端 LifecycleResult。
 * 各单据的节点由后端控制，前端仅展示。
 */

import type { LifecycleResult, SubStage } from '../../../components/uni-lifecycle/types';
import { deriveLifecycleRingPercent } from '../../../utils/lifecycleRingPercent';

export interface BackendLifecycleStage {
  key: string;
  label: string;
  status: 'done' | 'active' | 'pending';
  /** 该节点进度 0～100，可选 */
  percent?: number;
}

export interface BackendLifecycle {
  status_class?: string;
  flow_class?: string;
  current_stage_key?: string;
  current_stage_name?: string;
  status?: 'success' | 'exception' | 'normal' | 'active';
  main_stages?: BackendLifecycleStage[];
  sub_stages?: BackendLifecycleStage[];
  next_step_suggestions?: string[];
}

/** 无 main_stages 或无法从节点推导进度时的兜底（兼容旧接口） */
const LEGACY_STAGE_PERCENT_FALLBACK: Record<string, number> = {
  draft: 0,
  submitted: 25,
  reviewed: 50,
  send_or_push: 75,
  converted: 100,
  released: 25,
  in_progress: 50,
  completed: 100,
  cancelled: 0,
  pending: 0,
  inspected: 33,
  pending_review: 50,
  rejected: 15,
  audited: 50,
  pushed: 100,
  effective: 50,
  executing: 50,
  delivered: 75,
  invoicing: 88,
};

/**
 * 将后端返回的 lifecycle 转为 UniLifecycle/UniLifecycleStepper 使用的 LifecycleResult。
 */
export function parseBackendLifecycle(lifecycle: BackendLifecycle | null | undefined): LifecycleResult {
  if (!lifecycle) {
    return { percent: 0, stageName: '-', mainStages: [] };
  }
  const stageName = lifecycle.current_stage_name ?? '-';
  const mainStages: SubStage[] = (lifecycle.main_stages ?? []).map((s) => ({
    key: s.key,
    label: s.label,
    status: s.status,
    ...(s.percent != null && { percent: s.percent }),
  }));
  const subStages: SubStage[] | undefined = lifecycle.sub_stages?.length
    ? lifecycle.sub_stages.map((s) => ({
        key: s.key,
        label: s.label,
        status: s.status,
        ...(s.percent != null && { percent: s.percent }),
      }))
    : undefined;
  const computedPercent = deriveLifecycleRingPercent(lifecycle.main_stages ?? []);
  const percent =
    computedPercent ??
    (lifecycle.current_stage_key ? LEGACY_STAGE_PERCENT_FALLBACK[lifecycle.current_stage_key] ?? 30 : 30);
  return {
    percent,
    stageName,
    status: lifecycle.status,
    mainStages: mainStages.length ? mainStages : undefined,
    subStages,
    nextStepSuggestions: lifecycle.next_step_suggestions,
    statusClass: lifecycle.status_class,
    flowClass: lifecycle.flow_class ?? lifecycle.current_stage_key,
  };
}
