/**
 * 采购申请生命周期：以后端 lifecycle 为唯一真源。
 */

import type { LifecycleResult, SubStage } from '../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';

const MAIN_STAGE_KEYS_AUDIT = ['draft', 'pending_review', 'approved', 'partial', 'full'] as const;
const MAIN_STAGE_KEYS_NO_AUDIT = ['draft', 'approved', 'partial', 'full'] as const;
const MAIN_STAGE_LABELS: Record<string, string> = {
  draft: '草稿',
  pending_review: '待审核',
  approved: '已通过',
  partial: '部分转单',
  full: '全部转单',
};

function buildMainStages(currentKey: string, auditRequired: boolean): SubStage[] {
  const order = auditRequired ? [...MAIN_STAGE_KEYS_AUDIT] : [...MAIN_STAGE_KEYS_NO_AUDIT];
  const stageToIndexAudit: Record<string, number> = {
    草稿: 0,
    待审核: 1,
    已驳回: 1,
    已通过: 2,
    部分转单: 3,
    全部转单: 4,
  };
  const stageToIndexNoAudit: Record<string, number> = {
    草稿: 0,
    待审核: 1,
    已驳回: 1,
    已通过: 1,
    部分转单: 2,
    全部转单: 3,
  };
  const stageToIndex = auditRequired ? stageToIndexAudit : stageToIndexNoAudit;
  const currentIdx = stageToIndex[currentKey] ?? 0;
  return order.map((key, idx) => {
    let status: SubStage['status'] = 'pending';
    if (idx < currentIdx) status = 'done';
    else if (idx === currentIdx) status = 'active';
    return { key, label: MAIN_STAGE_LABELS[key] ?? key, status };
  });
}

export interface PurchaseRequisitionLike {
  status?: string;
  lifecycle?: unknown;
}

/** 列表筛选 / 钉住 Tab：与生命周期主轴一致 */
export function getPurchaseRequisitionLifecycleStageLabels(auditRequired = true): string[] {
  return auditRequired
    ? ['草稿', '待审核', '已驳回', '已通过', '部分转单', '全部转单']
    : ['草稿', '已通过', '已驳回', '部分转单', '全部转单'];
}

import {
  LIST_LIFECYCLE_STAGE_FIELD,
  resolveListLifecycleStageFromSearch,
  toListLifecycleStageApiParams,
} from '../../../utils/listLifecycleStage';

/** @deprecated 使用 LIST_LIFECYCLE_STAGE_FIELD */
export const PURCHASE_REQUISITION_LIST_LIFECYCLE_FIELD = LIST_LIFECYCLE_STAGE_FIELD;

const PURCHASE_REQUISITION_STAGE_LABELS = [
  '草稿',
  '待审核',
  '已驳回',
  '已通过',
  '部分转单',
  '全部转单',
] as const;

/** 从搜索表单 / 钉住条件解析列表筛选；仅 lifecycle_stage，不传 status */
export function resolvePurchaseRequisitionListLifecycleParams(
  searchFormValues?: Record<string, unknown> | null,
  params?: Record<string, unknown> | null,
): { lifecycle_stage?: string } {
  const stage = resolveListLifecycleStageFromSearch(searchFormValues, params, {
    allowedStages: PURCHASE_REQUISITION_STAGE_LABELS,
  });
  return toListLifecycleStageApiParams(stage);
}

/** @deprecated 使用 resolvePurchaseRequisitionListLifecycleParams */
export function mapPurchaseRequisitionLifecycleStageToApiParams(
  stage: string,
): { lifecycle_stage?: string } {
  return resolvePurchaseRequisitionListLifecycleParams({ lifecycle_stage: stage });
}

/** 供 ProColumns.valueEnum 与 uni-query 生命周期 Tab 使用 */
export function buildPurchaseRequisitionLifecycleValueEnum(
  auditRequired = true,
): Record<string, { text: string; status?: 'Default' | 'Processing' | 'Error' | 'Success' | 'Warning' }> {
  const statusByStage: Record<string, 'Default' | 'Processing' | 'Error' | 'Success' | 'Warning'> = {
    草稿: 'Default',
    待审核: 'Processing',
    已驳回: 'Error',
    已通过: 'Success',
    部分转单: 'Warning',
    全部转单: 'Success',
  };
  return Object.fromEntries(
    getPurchaseRequisitionLifecycleStageLabels(auditRequired).map((stage) => [
      stage,
      { text: stage, status: statusByStage[stage] ?? 'Default' },
    ]),
  );
}

export function getPurchaseRequisitionLifecycle(
  record: PurchaseRequisitionLike | Record<string, unknown> | null | undefined,
  auditRequired = true
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const backend = (record?.lifecycle ?? (record as Record<string, unknown>).lifecycle) as BackendLifecycle | undefined;
  if (backend?.main_stages?.length) {
    return parseBackendLifecycle(backend);
  }
  return {
    percent: 0,
    stageName: '生命周期缺失',
    status: 'exception',
    mainStages: [],
  };
}
