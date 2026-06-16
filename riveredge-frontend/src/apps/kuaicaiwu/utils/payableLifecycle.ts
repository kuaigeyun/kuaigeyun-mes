/**
 * 应付单生命周期：待审核→已审核→已结清
 * 优先使用后端下发的 record.lifecycle，无则前端兜底。
 */

import type { LifecycleResult } from '../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';
import { applyLifecycleI18n, type LifecycleTranslateFn } from './lifecycleI18n';

const PL = 'app.kuaicaiwu.payable.lifecycle';

const STAGE_LABEL_KEYS: Record<string, string> = {
  pending_review: `${PL}.pendingReview`,
  approved: `${PL}.approved`,
  settled: `${PL}.settled`,
  rejected: `${PL}.rejected`,
};

const NEXT_STEP_KEYS: Record<string, string[]> = {
  pending_review: [`${PL}.suggestionReview`],
  approved: [`${PL}.suggestionRecordPayment`],
};

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

function buildFallbackLifecycle(record: Record<string, unknown>): BackendLifecycle {
  const status = norm(record?.status as string);
  const reviewStatus = norm(record?.review_status as string);

  if (reviewStatus === '已驳回' || reviewStatus === '驳回') {
    return {
      current_stage_key: 'pending_review',
      current_stage_name: '已驳回',
      status: 'exception',
      main_stages: [
        { key: 'pending_review', label: '待审核', status: 'done' },
        { key: 'approved', label: '已审核', status: 'active' },
        { key: 'settled', label: '已结清', status: 'pending' },
      ],
      next_step_suggestions: [],
    };
  }
  if (status === '已结清') {
    return {
      current_stage_key: 'settled',
      current_stage_name: '已结清',
      status: 'success',
      main_stages: [
        { key: 'pending_review', label: '待审核', status: 'done' },
        { key: 'approved', label: '已审核', status: 'done' },
        { key: 'settled', label: '已结清', status: 'active' },
      ],
      next_step_suggestions: [],
    };
  }
  if (reviewStatus === '已审核' || reviewStatus === '通过') {
    return {
      current_stage_key: 'approved',
      current_stage_name: '已审核',
      status: 'normal',
      main_stages: [
        { key: 'pending_review', label: '待审核', status: 'done' },
        { key: 'approved', label: '已审核', status: 'active' },
        { key: 'settled', label: '已结清', status: 'pending' },
      ],
      next_step_suggestions: ['登记付款'],
    };
  }
  return {
    current_stage_key: 'pending_review',
    current_stage_name: '待审核',
    status: 'normal',
    main_stages: [
      { key: 'pending_review', label: '待审核', status: 'active' },
      { key: 'approved', label: '已审核', status: 'pending' },
      { key: 'settled', label: '已结清', status: 'pending' },
    ],
    next_step_suggestions: ['审核'],
  };
}

export function getPayableLifecycle(
  record: Record<string, unknown> | null | undefined,
  t?: LifecycleTranslateFn,
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const backend = (record as Record<string, unknown>).lifecycle as BackendLifecycle | undefined;
  const parsed =
    backend?.main_stages?.length
      ? parseBackendLifecycle(backend)
      : parseBackendLifecycle(buildFallbackLifecycle(record as Record<string, unknown>));
  if (!t) return parsed;
  return applyLifecycleI18n(parsed, t, STAGE_LABEL_KEYS, NEXT_STEP_KEYS);
}
