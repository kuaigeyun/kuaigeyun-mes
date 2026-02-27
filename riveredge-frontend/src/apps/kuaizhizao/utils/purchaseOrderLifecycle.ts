/**
 * 采购订单生命周期：优先使用后端下发的 record.lifecycle，无则前端兜底。
 * 阶段：草稿→待审核→已审核→下推入库→已完成，异常：已驳回、已取消
 */

import type { LifecycleResult, SubStage } from '../../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';

const PURCHASE_ORDER_STAGE_KEYS = new Set(['draft', 'pending_review', 'audited', 'pushed', 'completed', 'rejected', 'cancelled']);

function isPurchaseOrderLifecycle(backend: BackendLifecycle): boolean {
  const stages = backend?.main_stages ?? [];
  if (stages.length === 0) return false;
  const keys = new Set(stages.map((s) => s.key));
  return [...keys].some((k) => PURCHASE_ORDER_STAGE_KEYS.has(k));
}

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

function isRejected(reviewStatus: string | undefined): boolean {
  const r = norm(reviewStatus);
  return r === 'REJECTED' || r === '已驳回' || r === 'rejected' || r === '审核驳回';
}

function isApproved(reviewStatus: string | undefined): boolean {
  const r = norm(reviewStatus);
  return r === 'APPROVED' || r === '审核通过' || r === '通过' || r === '已通过' || r === '已审核' || r === 'audited';
}

function isDraft(status: string | undefined): boolean {
  const s = norm(status);
  return s === 'DRAFT' || s === '草稿' || s === 'draft';
}

function isPendingReview(status: string | undefined): boolean {
  const s = norm(status);
  return s === 'PENDING_REVIEW' || s === '待审核' || s === 'pending_review' || s === '已提交';
}

function isAudited(status: string | undefined): boolean {
  const s = norm(status);
  return s === 'AUDITED' || s === '已审核' || s === 'audited' || s === 'CONFIRMED' || s === '已确认';
}

function isCancelled(status: string | undefined): boolean {
  const s = norm(status);
  return s === 'CANCELLED' || s === '已取消' || s === 'cancelled';
}

const MAIN_STAGE_KEYS = ['draft', 'pending_review', 'audited', 'pushed', 'completed'] as const;
const MAIN_STAGE_LABELS: Record<(typeof MAIN_STAGE_KEYS)[number], string> = {
  draft: '草稿',
  pending_review: '待审核',
  audited: '已审核',
  pushed: '已下推入库',
  completed: '已完成',
};

function buildMainStages(currentKey: string): SubStage[] {
  const stageToIndex: Record<string, number> = {
    草稿: 0,
    待审核: 1,
    已审核: 2,
    已下推入库: 3,
    已完成: 4,
    已驳回: 1,
    已取消: 0,
  };
  const currentIdx = stageToIndex[currentKey] ?? 0;
  const isCompleted = currentKey === '已完成';
  return MAIN_STAGE_KEYS.map((key, idx) => {
    let status: SubStage['status'] = 'pending';
    if (isCompleted) status = 'done';
    else if (idx < currentIdx) status = 'done';
    else if (idx === currentIdx) status = 'active';
    return { key, label: MAIN_STAGE_LABELS[key], status };
  });
}

function buildFallbackLifecycle(record: Record<string, unknown>): BackendLifecycle {
  const status = norm(record?.status as string);
  const reviewStatus = norm(record?.review_status as string);

  if (isRejected(reviewStatus)) {
    return {
      current_stage_key: 'rejected',
      current_stage_name: '已驳回',
      status: 'exception',
      main_stages: buildMainStages('待审核'),
      next_step_suggestions: ['修改订单后重新提交审核'],
    };
  }
  if (isCancelled(status)) {
    return {
      current_stage_key: 'cancelled',
      current_stage_name: '已取消',
      status: 'exception',
      main_stages: buildMainStages('草稿'),
      next_step_suggestions: [],
    };
  }
  if (isDraft(status)) {
    return {
      current_stage_key: 'draft',
      current_stage_name: '草稿',
      status: 'normal',
      main_stages: buildMainStages('草稿'),
      next_step_suggestions: ['提交审核'],
    };
  }
  if (isPendingReview(status) && !isApproved(reviewStatus)) {
    return {
      current_stage_key: 'pending_review',
      current_stage_name: '待审核',
      status: 'normal',
      main_stages: buildMainStages('待审核'),
      next_step_suggestions: ['审核通过', '驳回'],
    };
  }
  if (isAudited(status) || isApproved(reviewStatus)) {
    return {
      current_stage_key: 'audited',
      current_stage_name: '已审核',
      status: 'normal',
      main_stages: buildMainStages('已审核'),
      next_step_suggestions: ['下推入库'],
    };
  }

  return {
    current_stage_key: 'draft',
    current_stage_name: status || '草稿',
    status: 'normal',
    main_stages: buildMainStages('草稿'),
    next_step_suggestions: ['提交审核'],
  };
}

export interface PurchaseOrderLike {
  status?: string;
  review_status?: string;
  lifecycle?: unknown;
}

/**
 * 根据采购订单获取生命周期结果，供 UniLifecycleStepper 使用。
 * 优先使用后端下发的 lifecycle；无则前端根据 status/review_status 兜底。
 */
export function getPurchaseOrderLifecycle(
  record: PurchaseOrderLike | Record<string, unknown> | null | undefined
): LifecycleResult {
  if (!record) {
    return { percent: 0, stageName: '-', mainStages: [] };
  }
  const backend = (record?.lifecycle ?? (record as Record<string, unknown>).lifecycle) as BackendLifecycle | undefined;
  if (backend?.main_stages?.length && isPurchaseOrderLifecycle(backend)) {
    return parseBackendLifecycle(backend);
  }
  return parseBackendLifecycle(buildFallbackLifecycle(record as Record<string, unknown>));
}
