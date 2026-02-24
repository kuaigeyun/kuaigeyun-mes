/**
 * 后端下发的生命周期结构解析为前端 LifecycleResult。
 * 各单据的节点由后端控制，前端仅展示。
 */

import type { LifecycleResult, SubStage } from '../../../../components/uni-lifecycle/types';

export interface BackendLifecycleStage {
  key: string;
  label: string;
  status: 'done' | 'active' | 'pending';
}

export interface BackendLifecycle {
  current_stage_key?: string;
  current_stage_name?: string;
  status?: 'success' | 'exception' | 'normal' | 'active';
  main_stages?: BackendLifecycleStage[];
  sub_stages?: BackendLifecycleStage[];
}

const STAGE_PERCENT: Record<string, number> = {
  draft: 0,
  pending_review: 15,
  rejected: 15,
  audited: 50,
  pushed: 100,
  effective: 50,
  executing: 50,
  delivered: 75,
  completed: 100,
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
  }));
  const subStages: SubStage[] | undefined = lifecycle.sub_stages?.length
    ? lifecycle.sub_stages.map((s) => ({ key: s.key, label: s.label, status: s.status }))
    : undefined;
  const percent = lifecycle.current_stage_key
    ? (STAGE_PERCENT[lifecycle.current_stage_key] ?? 30)
    : 30;
  return {
    percent,
    stageName,
    status: lifecycle.status,
    mainStages: mainStages.length ? mainStages : undefined,
    subStages,
  };
}
