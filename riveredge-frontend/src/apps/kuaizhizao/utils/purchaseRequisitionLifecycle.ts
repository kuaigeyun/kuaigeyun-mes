/**
 * 采购申请生命周期：前端兜底，根据 status 映射。
 * 阶段：草稿→待审核→已通过/已驳回→部分转单→全部转单
 */

import type { LifecycleResult, SubStage } from '../../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

const STATUS_TO_STAGE: Record<string, string> = {
  草稿: '草稿',
  待审核: '待审核',
  已驳回: '已驳回',
  已通过: '已通过',
  部分转单: '部分转单',
  全部转单: '全部转单',
  draft: '草稿',
  pending_review: '待审核',
  rejected: '已驳回',
  approved: '已通过',
};

const MAIN_STAGE_KEYS = ['draft', 'pending_review', 'approved', 'partial', 'full'] as const;
const MAIN_STAGE_LABELS: Record<string, string> = {
  draft: '草稿',
  pending_review: '待审核',
  approved: '已通过',
  partial: '部分转单',
  full: '全部转单',
};

function buildMainStages(currentKey: string): SubStage[] {
  const order = ['draft', 'pending_review', 'approved', 'partial', 'full'];
  const stageToIndex: Record<string, number> = {
    草稿: 0,
    待审核: 1,
    已驳回: 1,
    已通过: 2,
    部分转单: 3,
    全部转单: 4,
  };
  const currentIdx = stageToIndex[currentKey] ?? 0;
  return order.map((key, idx) => {
    let status: SubStage['status'] = 'pending';
    if (idx < currentIdx) status = 'done';
    else if (idx === currentIdx) status = 'active';
    return { key, label: MAIN_STAGE_LABELS[key] ?? key, status };
  });
}

function buildFallbackLifecycle(record: Record<string, unknown>): BackendLifecycle {
  const status = norm(record?.status as string);
  const stageName = (STATUS_TO_STAGE[status] ?? status) || '草稿';
  const keyMap: Record<string, string> = {
    草稿: 'draft',
    待审核: 'pending_review',
    已驳回: 'pending_review',
    已通过: 'approved',
    部分转单: 'partial',
    全部转单: 'full',
  };
  const key = keyMap[stageName] ?? 'draft';

  const nextStepSuggestions: Record<string, string[]> = {
    draft: ['提交'],
    pending_review: ['审核通过', '驳回'],
    approved: ['转采购单'],
    partial: ['转采购单'],
    full: [],
  };

  return {
    current_stage_key: key,
    current_stage_name: stageName,
    status: stageName === '已驳回' ? 'exception' : stageName === '全部转单' ? 'success' : 'normal',
    main_stages: buildMainStages(stageName),
    next_step_suggestions: nextStepSuggestions[key] ?? [],
  };
}

export interface PurchaseRequisitionLike {
  status?: string;
  lifecycle?: unknown;
}

export function getPurchaseRequisitionLifecycle(
  record: PurchaseRequisitionLike | Record<string, unknown> | null | undefined
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const backend = (record?.lifecycle ?? (record as Record<string, unknown>).lifecycle) as BackendLifecycle | undefined;
  if (backend?.main_stages?.length) {
    return parseBackendLifecycle(backend);
  }
  return parseBackendLifecycle(buildFallbackLifecycle(record as Record<string, unknown>));
}
