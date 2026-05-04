/**
 * 销售预测生命周期：优先使用后端下发的 record.lifecycle；无则前端兜底。
 * 主轴与销售订单对齐：草稿→待审核→已审核→已生效→执行中→已交货→已完成。
 */

import type { LifecycleResult, SubStage } from '../../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';
import { deriveLifecycleRingPercent } from '../../../utils/lifecycleRingPercent';

/** 后端主轴 key：含历史四段式（含 pushed）与订单对齐七段式 */
const SALES_FORECAST_BACKEND_KEYS = new Set([
  'draft',
  'pending_review',
  'audited',
  'pushed',
  'rejected',
  'effective',
  'executing',
  'delivered',
  'completed',
]);

function isSalesForecastLifecycle(backend: BackendLifecycle): boolean {
  const stages = backend?.main_stages ?? [];
  if (stages.length === 0) return false;
  return stages.some((s) => SALES_FORECAST_BACKEND_KEYS.has(s.key));
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
  return (
    r === 'APPROVED' ||
    r === '审核通过' ||
    r === '通过' ||
    r === '已通过' ||
    r === '已审核' ||
    r === 'audited'
  );
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
  return s === 'AUDITED' || s === '已审核' || s === 'audited';
}

function isConfirmed(status: string | undefined): boolean {
  const s = norm(status);
  return s === 'CONFIRMED' || s === '已确认' || s === '已生效';
}

function isCancelled(status: string | undefined): boolean {
  const s = norm(status);
  return s === '已取消' || s === 'CANCELLED' || s === 'cancelled';
}

const MAIN_STAGE_KEYS = [
  'draft',
  'pending_review',
  'audited',
  'pushed',
  'effective',
  'executing',
  'delivered',
  'completed',
] as const;
const MAIN_STAGE_LABELS: Record<(typeof MAIN_STAGE_KEYS)[number], string> = {
  draft: '草稿',
  pending_review: '待审核',
  audited: '已审核',
  pushed: '已下推',
  effective: '已生效',
  executing: '执行中',
  delivered: '发货出库',
  completed: '已完成',
};

function computationPushed(record: Record<string, unknown>): boolean {
  const p = record?.planning_pushed_to_computation ?? record?.pushed_to_computation;
  return p === true || p === 'true' || p === 1;
}

function isEffective(record: Record<string, unknown>): boolean {
  if (!isApproved(record?.review_status as string)) return false;
  return isConfirmed(record?.status as string) || computationPushed(record);
}

function buildMainStages(currentStageName: string, _isException: boolean): SubStage[] {
  const stageToIndex: Record<string, number> = {
    草稿: 0,
    待审核: 1,
    已审核: 2,
    已下推: 3,
    PUSHED: 3,
    pushed: 3,
    已生效: 4,
    执行中: 5,
    已交货: 6,
    发货出库: 6,
    已完成: 7,
    已驳回: 1,
    已取消: 0,
  };
  const currentIdx = stageToIndex[currentStageName] ?? 0;
  const isCompleted = currentStageName === '已完成';
  return MAIN_STAGE_KEYS.map((key, idx) => {
    let status: SubStage['status'] = 'pending';
    if (isCompleted) status = 'done';
    else if (idx < currentIdx) status = 'done';
    else if (idx === currentIdx) status = 'active';
    return { key, label: MAIN_STAGE_LABELS[key], status };
  });
}

/** 预测下推后以需求计算为主线，弱化工单/出库细拆（与销售订单列表粒度区分） */
function buildForecastExecutionSubStages(record: Record<string, unknown>): SubStage[] {
  const linked = computationPushed(record);
  return [
    { key: 'demand_compute', label: '需求计算', status: linked ? 'done' : 'active' },
    { key: 'supply_execution', label: '供应执行', status: linked ? 'active' : 'pending' },
    { key: 'forecast_review', label: '预测复盘', status: 'pending' },
  ];
}

function adaptForAuditSwitch(result: LifecycleResult, auditRequired: boolean): LifecycleResult {
  if (auditRequired) return result;
  const stageName = result.stageName === '待审核' ? '已审核' : result.stageName;
  const mainStages = (result.mainStages ?? []).filter((s) => s.key !== 'pending_review');
  const hasActive = mainStages.some((s) => s.status === 'active');
  if (!hasActive) {
    const auditedIdx = mainStages.findIndex((s) => s.key === 'audited');
    if (auditedIdx >= 0) {
      mainStages.forEach((s, idx) => {
        if (idx < auditedIdx) s.status = 'done';
        else if (idx === auditedIdx) s.status = 'active';
        else s.status = 'pending';
      });
    }
  }
  const nextStepSuggestions = (result.nextStepSuggestions ?? [])
    .map((s) => s.replace('提交审核', '提交').replace('审核通过', '确认'))
    .filter((s) => !s.includes('驳回'));
  return { ...result, stageName, mainStages, nextStepSuggestions };
}

function buildFallbackLifecycle(record: Record<string, unknown>): BackendLifecycle {
  const status = norm(record?.status as string);
  const reviewStatus = norm(record?.review_status as string);

  if (isRejected(reviewStatus)) {
    return {
      current_stage_key: 'pending_review',
      current_stage_name: '已驳回',
      status: 'exception',
      main_stages: buildMainStages('待审核', true).map((s) => ({
        key: s.key,
        label: s.label,
        status: s.status,
      })),
      next_step_suggestions: ['修改预测后重新提交审核'],
    };
  }
  if (status === '已驳回' || status === 'REJECTED' || status === 'rejected') {
    return {
      current_stage_key: 'pending_review',
      current_stage_name: '已驳回',
      status: 'exception',
      main_stages: buildMainStages('待审核', true).map((s) => ({
        key: s.key,
        label: s.label,
        status: s.status,
      })),
      next_step_suggestions: ['修改预测后重新提交审核'],
    };
  }
  if (isCancelled(status)) {
    return {
      current_stage_key: 'draft',
      current_stage_name: '已取消',
      status: 'exception',
      main_stages: buildMainStages('已取消', true).map((s) => ({
        key: s.key,
        label: s.label,
        status: s.status,
      })),
      next_step_suggestions: [],
    };
  }
  if (isDraft(status)) {
    return {
      current_stage_key: 'draft',
      current_stage_name: '草稿',
      status: 'normal',
      main_stages: buildMainStages('草稿', false).map((s) => ({
        key: s.key,
        label: s.label,
        status: s.status,
      })),
      next_step_suggestions: ['提交审核'],
    };
  }
  if (isPendingReview(status) && !isApproved(reviewStatus)) {
    return {
      current_stage_key: 'pending_review',
      current_stage_name: '待审核',
      status: 'normal',
      main_stages: buildMainStages('待审核', false).map((s) => ({
        key: s.key,
        label: s.label,
        status: s.status,
      })),
      next_step_suggestions: ['审核通过', '驳回', '撤回提交（回到草稿）'],
    };
  }
  if (isPendingReview(status) && isApproved(reviewStatus)) {
    return {
      current_stage_key: 'audited',
      current_stage_name: '已审核',
      status: 'normal',
      main_stages: buildMainStages('已审核', false).map((s) => ({
        key: s.key,
        label: s.label,
        status: s.status,
      })),
      next_step_suggestions: ['下推需求计算'],
    };
  }
  if (isAudited(status) && !isEffective(record)) {
    return {
      current_stage_key: 'audited',
      current_stage_name: '已审核',
      status: 'normal',
      main_stages: buildMainStages('已审核', false).map((s) => ({
        key: s.key,
        label: s.label,
        status: s.status,
      })),
      next_step_suggestions: ['下推需求计算'],
    };
  }
  if (status === 'COMPLETED' || status === '已完成' || status === 'completed') {
    return {
      current_stage_key: 'completed',
      current_stage_name: '已完成',
      status: 'success',
      main_stages: buildMainStages('已完成', false).map((s) => ({
        key: s.key,
        label: s.label,
        status: s.status,
      })),
      next_step_suggestions: [],
    };
  }
  if (isEffective(record)) {
    const pushed = computationPushed(record);
    if (!pushed) {
      return {
        current_stage_key: 'effective',
        current_stage_name: '已生效',
        status: 'normal',
        main_stages: buildMainStages('已生效', false).map((s) => ({
          key: s.key,
          label: s.label,
          status: s.status,
        })),
        next_step_suggestions: ['下推需求计算', '前往需求计算执行 MRP'],
      };
    }
    const stRaw = norm(record?.status as string);
    if (stRaw === 'PUSHED' || stRaw === '已下推' || stRaw === 'pushed') {
      return {
        current_stage_key: 'pushed',
        current_stage_name: '已下推',
        status: 'normal',
        main_stages: buildMainStages('已下推', false).map((s) => ({
          key: s.key,
          label: s.label,
          status: s.status,
        })),
        next_step_suggestions: ['在需求计算中查看关联需求', '必要时更新预测明细'],
      };
    }
    const subStages = buildForecastExecutionSubStages(record).map((s) => ({
      key: s.key,
      label: s.label,
      status: s.status as 'done' | 'active' | 'pending',
    }));
    const activeKey = subStages.find((s) => s.status === 'active')?.key;
    const execSuggestions: Record<string, string[]> = {
      demand_compute: ['执行或核对需求计算（MRP）'],
      supply_execution: ['跟进工单与出库进度'],
      forecast_review: ['复盘预测与实际需求偏差'],
    };
    return {
      current_stage_key: 'executing',
      current_stage_name: '执行中',
      status: 'normal',
      main_stages: buildMainStages('执行中', false).map((s) => ({
        key: s.key,
        label: s.label,
        status: s.status,
      })),
      sub_stages: subStages,
      next_step_suggestions: (activeKey && execSuggestions[activeKey]) || ['推进需求与供应协同'],
    };
  }

  return {
    current_stage_key: 'audited',
    current_stage_name: '已审核',
    status: 'normal',
    main_stages: buildMainStages('已审核', false).map((s) => ({
      key: s.key,
      label: s.label,
      status: s.status,
    })),
    next_step_suggestions: ['下推需求计算'],
  };
}

function finalizeForecastLifecyclePercent(result: LifecycleResult): LifecycleResult {
  const stages = result.mainStages;
  if (!stages?.length) return result;
  const p = deriveLifecycleRingPercent(stages.map(({ status }) => ({ status })));
  return p != null ? { ...result, percent: p } : result;
}

export interface SalesForecastLike {
  status?: string;
  review_status?: string;
  planning_pushed_to_computation?: boolean;
  pushed_to_computation?: boolean;
  lifecycle?: unknown;
}

/**
 * 根据销售预测获取生命周期结果，供 UniLifecycleStepper 使用。
 */
export function getSalesForecastLifecycle(
  record: SalesForecastLike | Record<string, unknown> | null | undefined,
  auditRequired = true
): LifecycleResult {
  if (!record) {
    return { percent: 0, stageName: '-', mainStages: [] };
  }
  const backend = (record?.lifecycle ?? (record as Record<string, unknown>).lifecycle) as
    | BackendLifecycle
    | undefined;
  if (backend?.main_stages?.length && isSalesForecastLifecycle(backend)) {
    return finalizeForecastLifecyclePercent(adaptForAuditSwitch(parseBackendLifecycle(backend), auditRequired));
  }
  return finalizeForecastLifecyclePercent(
    adaptForAuditSwitch(
      parseBackendLifecycle(buildFallbackLifecycle(record as Record<string, unknown>)),
      auditRequired
    )
  );
}
