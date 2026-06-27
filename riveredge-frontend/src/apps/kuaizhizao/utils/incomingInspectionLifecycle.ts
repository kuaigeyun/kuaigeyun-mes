/**
 * 来料/工序/成品检验单生命周期：待检验→已检验→已确认
 * 优先使用后端 record.lifecycle；单据审核态由 record.audit 独立列展示。
 */

import type { LifecycleResult } from '../../../components/uni-lifecycle/types';
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

const MAIN_STAGES = [
  { key: 'pending_inspection', label: '待检验' },
  { key: 'inspected', label: '已检验' },
] as const;

function buildMainStages(currentKey: string, isException = false) {
  const order = MAIN_STAGES.map((s) => s.key);
  const idx = order.indexOf(currentKey);
  const currentIdx = idx >= 0 ? idx : 0;
  return MAIN_STAGES.map((s, i) => {
    let status: 'done' | 'active' | 'pending' = 'pending';
    if (i < currentIdx) status = 'done';
    else if (i === currentIdx) status = 'active';
    if (isException && s.key === currentKey) status = 'active';
    return { key: s.key, label: s.label, status };
  });
}

function buildFallbackLifecycle(record: Record<string, unknown>): BackendLifecycle {
  const status = norm(record?.status as string);
  const reviewStatus = norm(record?.review_status as string);

  if (isRejected(reviewStatus, status)) {
    return {
      current_stage_key: 'inspected',
      current_stage_name: '已驳回',
      status: 'exception',
      main_stages: buildMainStages('inspected', true),
      next_step_suggestions: [],
    };
  }
  if (isApproved(reviewStatus) || status === '已审核' || status === 'audited' || status === 'approved') {
    return {
      current_stage_key: 'inspected',
      current_stage_name: '已检验',
      status: 'success',
      main_stages: buildMainStages('inspected'),
      next_step_suggestions: [],
    };
  }
  if (status === '已检验' || status === 'inspected') {
    return {
      current_stage_key: 'inspected',
      current_stage_name: '已检验',
      status: 'normal',
      main_stages: buildMainStages('inspected'),
      next_step_suggestions: ['提交审核'],
    };
  }
  return {
    current_stage_key: 'pending_inspection',
    current_stage_name: '待检验',
    status: 'normal',
    main_stages: buildMainStages('pending_inspection'),
    next_step_suggestions: ['执行检验'],
  };
}

function normalizeInspectionLifecycle(result: LifecycleResult): LifecycleResult {
  const mainStages = (result.mainStages ?? []).filter((s) => s.key !== 'pending_review');
  let stageName = result.stageName ?? '';
  if (stageName === '待审核') stageName = '—';
  if (stageName === '已审核') stageName = '已检验';
  return { ...result, mainStages, stageName };
}

export function getIncomingInspectionLifecycle(
  record: Record<string, unknown> | null | undefined,
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const backend = (record as Record<string, unknown>).lifecycle as BackendLifecycle | undefined;
  if (backend?.main_stages?.length) {
    return normalizeInspectionLifecycle(parseBackendLifecycle(backend));
  }
  return normalizeInspectionLifecycle(parseBackendLifecycle(buildFallbackLifecycle(record)));
}
