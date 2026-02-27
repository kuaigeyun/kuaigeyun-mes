/**
 * 销售出库生命周期：草稿→待审核→已审核→待出库→已出库
 */

import type { LifecycleResult } from '../../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

function buildFallbackLifecycle(record: Record<string, unknown>): BackendLifecycle {
  const status = norm(record?.status as string);
  const reviewStatus = norm(record?.review_status as string);
  let stageName = status;
  if (status === '待出库' && reviewStatus) {
    if (reviewStatus === '审核驳回') stageName = '审核驳回';
    else if (reviewStatus === '审核通过') stageName = '待出库';
    else stageName = '待审核';
  } else if (!stageName) {
    stageName = reviewStatus ? (reviewStatus === '审核通过' ? '待出库' : reviewStatus === '审核驳回' ? '审核驳回' : '待审核') : '草稿';
  }
  const keyMap: Record<string, string> = {
    草稿: 'draft',
    待审核: 'pending_review',
    审核驳回: 'rejected',
    待出库: 'pending_outbound',
    已出库: 'outbound',
    已取消: 'cancelled',
  };
  const key = keyMap[stageName] ?? 'draft';
  const stageDefs = [
    { key: 'draft', label: '草稿' },
    { key: 'pending_review', label: '待审核' },
    { key: 'pending_outbound', label: '待出库' },
    { key: 'outbound', label: '已出库' },
  ];
  const stageToIdx: Record<string, number> = {
    草稿: 0,
    待审核: 1,
    审核驳回: 1,
    待出库: 2,
    已出库: 3,
    已取消: 0,
  };
  const curIdx = stageToIdx[stageName] ?? 0;
  const isException = stageName === '审核驳回' || stageName === '已取消';
  const mainStages = stageDefs.map((s, idx) => {
    let st: 'done' | 'active' | 'pending' = 'pending';
    if (isException) st = idx === 1 && stageName === '审核驳回' ? 'active' : 'pending';
    else if (idx < curIdx) st = 'done';
    else if (idx === curIdx) st = 'active';
    return { key: s.key, label: s.label, status: st };
  });
  return {
    current_stage_key: key,
    current_stage_name: stageName,
    status: isException ? 'exception' : stageName === '已出库' ? 'success' : 'normal',
    main_stages: mainStages,
    next_step_suggestions: stageName === '待出库' ? ['确认出库'] : stageName === '待审核' ? ['审核'] : [],
  };
}

export function getSalesDeliveryLifecycle(
  record: Record<string, unknown> | null | undefined
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const backend = (record as Record<string, unknown>).lifecycle as BackendLifecycle | undefined;
  if (backend?.main_stages?.length) return parseBackendLifecycle(backend);
  return parseBackendLifecycle(buildFallbackLifecycle(record as Record<string, unknown>));
}
