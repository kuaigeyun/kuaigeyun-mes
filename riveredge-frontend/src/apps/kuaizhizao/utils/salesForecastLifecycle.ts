/**
 * 销售预测生命周期：优先使用后端下发的 record.lifecycle；无则前端兜底。
 * 主轴与销售订单对齐：草稿→待审核→已审核→已生效→执行中→已交货→已完成。
 */

import type { LifecycleResult, SubStage } from '../../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';

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
  'effective',
  'executing',
  'delivered',
  'completed',
] as const;
const MAIN_STAGE_LABELS: Record<(typeof MAIN_STAGE_KEYS)[number], string> = {
  draft: '草稿',
  pending_review: '待审核',
  audited: '已审核',
  effective: '已生效',
  executing: '执行中',
  delivered: '已交货',
  completed: '已完成',
};

const EXEC_SUB_STAGE_KEYS = [
  'bom_check',
  'demand_compute',
  'production_plan',
  'work_order_released',
  'shipment_waiting',
  'delivered',
] as const;

const EXEC_SUB_STAGE_LABELS: Record<(typeof EXEC_SUB_STAGE_KEYS)[number], string> = {
  bom_check: 'BOM检查',
  demand_compute: '需求计算',
  production_plan: '生产计划',
  work_order_released: '工单下达',
  shipment_waiting: '待出库',
  delivered: '已送货',
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
    已生效: 3,
    执行中: 4,
    已交货: 5,
    已完成: 6,
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

function buildExecutionSubStages(record: Record<string, unknown>): SubStage[] {
  const pushed = computationPushed(record);
  const stages: SubStage[] = [
    { key: EXEC_SUB_STAGE_KEYS[0], label: EXEC_SUB_STAGE_LABELS.bom_check, status: 'done' },
    { key: EXEC_SUB_STAGE_KEYS[1], label: EXEC_SUB_STAGE_LABELS.demand_compute, status: pushed ? 'done' : 'active' },
    { key: EXEC_SUB_STAGE_KEYS[2], label: EXEC_SUB_STAGE_LABELS.production_plan, status: 'pending' },
    { key: EXEC_SUB_STAGE_KEYS[3], label: EXEC_SUB_STAGE_LABELS.work_order_released, status: 'pending' },
    { key: EXEC_SUB_STAGE_KEYS[4], label: EXEC_SUB_STAGE_LABELS.shipment_waiting, status: 'pending' },
    { key: EXEC_SUB_STAGE_KEYS[5], label: EXEC_SUB_STAGE_LABELS.delivered, status: 'pending' },
  ];
  if (!stages.some((s) => s.status === 'active')) {
    const first = stages.find((s) => s.status === 'pending');
    if (first) first.status = 'active';
  }
  return stages;
}

function currentSubStageLabel(subStages: SubStage[]): string {
  const active = subStages.find((s) => s.status === 'active');
  if (active) return active.label;
  return subStages[subStages.length - 1]?.label ?? '';
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
        next_step_suggestions: ['前往需求计算执行 MRP', '建立工单'],
      };
    }
    const subStages = buildExecutionSubStages(record).map((s) => ({
      key: s.key,
      label: s.label,
      status: s.status as 'done' | 'active' | 'pending',
    }));
    const activeKey = subStages.find((s) => s.status === 'active')?.key;
    const execSuggestions: Record<string, string[]> = {
      bom_check: ['完成 BOM 检查'],
      demand_compute: ['执行需求计算（MRP）'],
      production_plan: ['制定生产计划'],
      work_order_released: ['下达工单'],
      shipment_waiting: ['准备出库'],
      delivered: ['销售交货'],
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
      next_step_suggestions: (activeKey && execSuggestions[activeKey]) || ['推进执行进度'],
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
    return adaptForAuditSwitch(parseBackendLifecycle(backend), auditRequired);
  }
  return adaptForAuditSwitch(
    parseBackendLifecycle(buildFallbackLifecycle(record as Record<string, unknown>)),
    auditRequired
  );
}
