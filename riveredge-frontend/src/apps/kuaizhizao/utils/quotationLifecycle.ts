/**
 * 报价单生命周期：前端兜底，根据 status 映射。
 * 阶段：草稿→已发送→已接受/已拒绝→已转订单
 */

import type { LifecycleResult, SubStage } from '../../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

const STATUS_TO_STAGE: Record<string, string> = {
  草稿: '草稿',
  已发送: '已发送',
  已接受: '已接受',
  已拒绝: '已拒绝',
  已转订单: '已转订单',
};

const MAIN_STAGE_KEYS = ['draft', 'sent', 'accepted', 'converted'] as const;
const MAIN_STAGE_LABELS: Record<string, string> = {
  draft: '草稿',
  sent: '已发送',
  accepted: '已接受',
  converted: '已转订单',
};

function buildMainStages(currentKey: string): SubStage[] {
  const stageToIndex: Record<string, number> = {
    草稿: 0,
    已发送: 1,
    已接受: 2,
    已拒绝: 1,
    已转订单: 3,
  };
  const currentIdx = stageToIndex[currentKey] ?? 0;
  const isCompleted = currentKey === '已转订单' || currentKey === '已接受';
  return MAIN_STAGE_KEYS.map((key, idx) => {
    let status: SubStage['status'] = 'pending';
    if (isCompleted) status = 'done';
    else if (idx < currentIdx) status = 'done';
    else if (idx === currentIdx) status = 'active';
    return { key, label: MAIN_STAGE_LABELS[key] ?? key, status };
  });
}

function buildFallbackLifecycle(record: Record<string, unknown>): BackendLifecycle {
  const status = norm(record?.status as string);
  const stageName = (STATUS_TO_STAGE[status] ?? status) || '草稿';
  const keyMap: Record<string, string> = {
    草稿: 'draft',
    已发送: 'sent',
    已接受: 'accepted',
    已拒绝: 'sent',
    已转订单: 'converted',
  };
  const key = keyMap[stageName] ?? 'draft';

  return {
    current_stage_key: key,
    current_stage_name: stageName,
    status: stageName === '已拒绝' ? 'exception' : stageName === '已转订单' ? 'success' : 'normal',
    main_stages: buildMainStages(stageName),
    next_step_suggestions: stageName === '草稿' ? ['发送', '转订单'] : stageName === '已发送' ? ['转订单'] : [],
  };
}

export interface QuotationLike {
  status?: string;
  lifecycle?: unknown;
}

export function getQuotationLifecycle(
  record: QuotationLike | Record<string, unknown> | null | undefined
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const backend = (record?.lifecycle ?? (record as Record<string, unknown>).lifecycle) as BackendLifecycle | undefined;
  if (backend?.main_stages?.length) {
    return parseBackendLifecycle(backend);
  }
  return parseBackendLifecycle(buildFallbackLifecycle(record as Record<string, unknown>));
}
