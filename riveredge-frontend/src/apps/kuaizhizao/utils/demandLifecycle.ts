/**
 * 需求生命周期：唯一来源为后端下发的 record.lifecycle，前端仅解析展示。
 * 无兜底逻辑；且仅当后端返回的是「需求专用 4 阶段」时才展示 Stepper，否则视为无效。
 */

import type { LifecycleResult } from '../../../../components/uni-lifecycle/types';
import type { Demand } from '../services/demand';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';

/** 需求专用阶段 key 集合（与后端 document_lifecycle_service.DEMAND_MAIN_STAGES 一致） */
const DEMAND_STAGE_KEYS = new Set(['pending_review', 'rejected', 'audited', 'pushed']);

/** 判断是否为需求专用 lifecycle（4 阶段），避免误用销售订单的 7 阶段 */
function isDemandLifecycle(backend: BackendLifecycle): boolean {
  const stages = backend?.main_stages ?? [];
  if (stages.length === 0) return false;
  const keys = new Set(stages.map((s) => s.key));
  return keys.size === DEMAND_STAGE_KEYS.size && [...keys].every((k) => DEMAND_STAGE_KEYS.has(k));
}

/**
 * 根据需求获取生命周期结果，供 UniLifecycleStepper 使用。
 * 仅使用后端下发的 lifecycle；且仅当为需求 4 阶段（待审核/已驳回/已审核/已下推计算）时才返回节点，否则返回空。
 */
export function getDemandLifecycle(record: Demand): LifecycleResult {
  const backend = (record?.lifecycle ?? (record as Record<string, unknown>).lifecycle) as
    | BackendLifecycle
    | undefined;
  if (backend?.main_stages?.length && isDemandLifecycle(backend)) {
    return parseBackendLifecycle(backend);
  }
  return { percent: 0, stageName: '-', mainStages: [] };
}
