/**
 * 来料/工序/成品检验单生命周期：待检验→已检验→待审核→已审核/已驳回
 * 优先使用后端下发的 record.lifecycle，无则前端兜底。
 */

import type { LifecycleResult } from '../../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

const REJECTED_VALUES = ['REJECTED', '已驳回', '审核驳回', 'rejected'];
const APPROVED_VALUES = ['APPROVED', '审核通过', '通过', '已通过', '已审核'];

function isRejected(reviewStatus: string, status: string): boolean {
  const r = norm(reviewStatus);
  const s = norm(status);
  return REJECTED_VALUES.includes(r) || ['已驳回', 'rejected'].includes(s);
}

function isApproved(reviewStatus: string): boolean {
  return APPROVED_VALUES.includes(norm(reviewStatus));
}

function buildFallbackLifecycle(record: Record<string, unknown>): BackendLifecycle {
  const status = norm(record?.status as string);
  const reviewStatus = norm(record?.review_status as string);

  if (isRejected(reviewStatus, status)) {
    return {
      current_stage_key: 'pending_review',
      current_stage_name: '已驳回',
      status: 'exception',
      main_stages: [
        { key: 'pending', label: '待检验', status: 'done' },
        { key: 'inspected', label: '已检验', status: 'done' },
        { key: 'pending_review', label: '待审核', status: 'active' },
        { key: 'approved', label: '已审核', status: 'pending' },
      ],
      next_step_suggestions: [],
    };
  }
  if (isApproved(reviewStatus) || status === '已审核' || status === 'audited') {
    return {
      current_stage_key: 'approved',
      current_stage_name: '已审核',
      status: 'success',
      main_stages: [
        { key: 'pending', label: '待检验', status: 'done' },
        { key: 'inspected', label: '已检验', status: 'done' },
        { key: 'pending_review', label: '待审核', status: 'done' },
        { key: 'approved', label: '已审核', status: 'active' },
      ],
      next_step_suggestions: [],
    };
  }
  if (status === '已检验' || status === 'inspected') {
    return {
      current_stage_key: 'pending_review',
      current_stage_name: '待审核',
      status: 'normal',
      main_stages: [
        { key: 'pending', label: '待检验', status: 'done' },
        { key: 'inspected', label: '已检验', status: 'done' },
        { key: 'pending_review', label: '待审核', status: 'active' },
        { key: 'approved', label: '已审核', status: 'pending' },
      ],
      next_step_suggestions: ['审核'],
    };
  }
  return {
    current_stage_key: 'pending',
    current_stage_name: '待检验',
    status: 'normal',
    main_stages: [
      { key: 'pending', label: '待检验', status: 'active' },
      { key: 'inspected', label: '已检验', status: 'pending' },
      { key: 'pending_review', label: '待审核', status: 'pending' },
      { key: 'approved', label: '已审核', status: 'pending' },
    ],
    next_step_suggestions: ['执行检验'],
  };
}

export function getIncomingInspectionLifecycle(
  record: Record<string, unknown> | null | undefined
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const backend = (record as Record<string, unknown>).lifecycle as BackendLifecycle | undefined;
  if (backend?.main_stages?.length) return parseBackendLifecycle(backend);
  return parseBackendLifecycle(buildFallbackLifecycle(record as Record<string, unknown>));
}
