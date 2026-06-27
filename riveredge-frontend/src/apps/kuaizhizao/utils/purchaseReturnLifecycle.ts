/**
 * 采购退货单生命周期：待退货 → 已退货；已取消为异常分支。
 */

import type { LifecycleResult } from '../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

function buildFallback(record: Record<string, unknown>): BackendLifecycle {
  const status = norm(record.status as string);
  if (status === '已取消') {
    return {
      current_stage_key: 'cancelled',
      current_stage_name: '已取消',
      status: 'exception',
      main_stages: [
        { key: 'pending_return_goods', label: '待退货', status: 'done' },
        { key: 'cancelled', label: '已取消', status: 'active' },
      ],
      next_step_suggestions: [],
    };
  }
  if (status === '已退货') {
    return {
      current_stage_key: 'done',
      current_stage_name: '已退货',
      status: 'success',
      main_stages: [
        { key: 'pending_return_goods', label: '待退货', status: 'done' },
        { key: 'done', label: '已退货', status: 'done' },
      ],
      next_step_suggestions: [],
    };
  }
  return {
    current_stage_key: 'pending_return_goods',
    current_stage_name: '待退货',
    status: 'normal',
    main_stages: [
      { key: 'pending_return_goods', label: '待退货', status: 'active' },
      { key: 'done', label: '已退货', status: 'pending' },
    ],
    next_step_suggestions: ['确认退货'],
  };
}

export interface PurchaseReturnLike {
  status?: string;
  lifecycle?: unknown;
}

export function getPurchaseReturnLifecycle(
  record: PurchaseReturnLike | Record<string, unknown> | null | undefined
): LifecycleResult {
  if (!record) {
    return { percent: 0, stageName: '-', mainStages: [] };
  }
  const backend = (record as Record<string, unknown>).lifecycle as BackendLifecycle | undefined;
  if (backend?.main_stages?.length) {
    return parseBackendLifecycle(backend);
  }
  return parseBackendLifecycle(buildFallback(record as Record<string, unknown>));
}
