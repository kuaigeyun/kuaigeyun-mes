/**
 * 采购订单生命周期：优先使用后端 lifecycle，无则前端兜底。
 * 主轴：草稿→待审核→已审核→已确认→执行中→账款发票→已完成
 */

import dayjs from 'dayjs';
import type { LifecycleResult, SubStage } from '../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';
import { deriveLifecycleRingPercent } from '../../../utils/lifecycleRingPercent';
import { resolveListLifecycleStageFromSearch } from '../../../utils/listLifecycleStage';
import { mapAuditLifecycleStageToApiParams } from './auditListFilter';

const MAIN_STAGE_KEYS = [
  'draft',
  'confirmed',
  'executing',
  'invoicing',
  'completed',
] as const;
const MAIN_STAGE_KEYS_NO_AUDIT = MAIN_STAGE_KEYS;

const MAIN_STAGE_LABELS = {
  draft: '草稿',
  confirmed: '已确认',
  executing: '执行中',
  invoicing: '账款发票',
  completed: '已完成',
} as const;

const PURCHASE_ORDER_STAGE_KEYS = new Set([
  'draft',
  'pending_review',
  'audited',
  'confirmed',
  'executing',
  'invoicing',
  'completed',
  'pushed',
  'rejected',
  'cancelled',
]);

function isPurchaseOrderLifecycle(backend: BackendLifecycle): boolean {
  const stages = backend?.main_stages ?? [];
  if (stages.length === 0) return false;
  return stages.some((s) => PURCHASE_ORDER_STAGE_KEYS.has(s.key));
}

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

function normalizeStageName(name: string | undefined): string {
  const n = norm(name);
  if (n === '已下推' || n === '已下推入库') return '执行中';
  if (n === '账款发票处理') return '账款发票';
  return n || '';
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
  return s === 'AUDITED' || s === '已审核' || s === 'audited';
}

function isConfirmed(status: string | undefined): boolean {
  const s = norm(status);
  return s === 'CONFIRMED' || s === '已确认' || s === '已生效';
}

function isCancelled(status: string | undefined): boolean {
  const s = norm(status);
  return s === 'CANCELLED' || s === '已取消' || s === 'cancelled';
}

function isCompleted(status: string | undefined): boolean {
  const s = norm(status);
  return s === 'COMPLETED' || s === '已完成' || s === 'completed';
}

function isInProgress(status: string | undefined): boolean {
  const s = norm(status);
  return s === 'IN_PROGRESS' || s === '执行中' || s === '进行中';
}

const CN_STAGE_NAMES = new Set([
  '草稿',
  '待审核',
  '已审核',
  '已确认',
  '执行中',
  '账款发票',
  '已完成',
  '已驳回',
  '已取消',
]);

function buildMainStages(stageName: string): SubStage[] {
  const normalized = normalizeStageName(stageName);
  const order = [...MAIN_STAGE_KEYS];

  const stageToIndex: Record<string, number> = {
    草稿: 0,
    已确认: 1,
    执行中: 2,
    账款发票: 3,
    已完成: 4,
    已驳回: 0,
    已取消: 0,
    待审核: 0,
    已审核: 0,
  };

  const currentIdx = stageToIndex[normalized] ?? 0;
  const isCompletedStage = normalized === '已完成';

  return order.map((key, idx) => {
    let status: SubStage['status'] = 'pending';
    if (isCompletedStage) status = 'done';
    else if (idx < currentIdx) status = 'done';
    else if (idx === currentIdx) status = 'active';
    return { key, label: MAIN_STAGE_LABELS[key], status };
  });
}

function ringPercentFromStages(stages: SubStage[]): number {
  const p = deriveLifecycleRingPercent(stages.map(({ status }) => ({ status })));
  return p ?? 0;
}

function adaptForAuditSwitch(result: LifecycleResult, auditRequired: boolean): LifecycleResult {
  const base: LifecycleResult = { ...result, subStages: result.subStages };
  const stageRaw = normalizeStageName(base.stageName);
  let stageName = stageRaw;
  if (stageName === '待审核' || stageName === '已审核') {
    stageName = '草稿';
  }

  let next = [...(base.nextStepSuggestions ?? [])];
  if (!auditRequired) {
    next = next
      .map((s) => s.replace(/提交审核/g, '提交').replace(/审核通过/g, '确认'))
      .filter((s) => !s.includes('审核'));
  }

  const mainStages = (base.mainStages ?? []).filter(
    (s) => s.key !== 'pending_review' && s.key !== 'audited',
  );

  if (stageRaw && CN_STAGE_NAMES.has(stageRaw)) {
    return {
      ...base,
      stageName,
      mainStages: mainStages.length ? mainStages : buildMainStages(stageName),
      nextStepSuggestions: next,
    };
  }

  return { ...base, stageName, mainStages, nextStepSuggestions: next };
}

export const PURCHASE_ORDER_EXCEPTION_LIFECYCLE_STAGES = ['已驳回', '已取消'] as const;

export function getPurchaseOrderLifecycleStageLabels(auditRequired = true): string[] {
  void auditRequired;
  return [...MAIN_STAGE_KEYS.map((k) => MAIN_STAGE_LABELS[k]), ...PURCHASE_ORDER_EXCEPTION_LIFECYCLE_STAGES];
}

type LifecycleTranslate = (key: string, defaultValue?: string) => string;

const PURCHASE_ORDER_LIFECYCLE_STAGE_I18N: Record<string, string> = {
  草稿: 'app.kuaizhizao.purchaseOrder.lifecycleDraft',
  待审核: 'app.kuaizhizao.purchaseOrder.lifecyclePendingReview',
  已审核: 'app.kuaizhizao.purchaseOrder.lifecycleAudited',
  已确认: 'app.kuaizhizao.purchaseOrder.lifecycleConfirmed',
  执行中: 'app.kuaizhizao.purchaseOrder.lifecycleExecuting',
  账款发票: 'app.kuaizhizao.purchaseOrder.lifecycleInvoicing',
  已完成: 'app.kuaizhizao.purchaseOrder.lifecycleCompleted',
  已驳回: 'app.kuaizhizao.purchaseOrder.lifecycleRejected',
  已取消: 'app.kuaizhizao.purchaseOrder.lifecycleCancelled',
};

export function buildPurchaseOrderLifecycleValueEnum(
  t: LifecycleTranslate,
  auditRequired = true,
): Record<string, { text: string }> {
  return Object.fromEntries(
    getPurchaseOrderLifecycleStageLabels(auditRequired).map((stage) => [
      stage,
      { text: t(PURCHASE_ORDER_LIFECYCLE_STAGE_I18N[stage] ?? stage, stage) },
    ]),
  );
}

/** 从搜索表单解析阶段并映射为采购订单列表 API 的 status/review_status（无 lifecycle_stage 接口） */
export function resolvePurchaseOrderListLifecycleParams(
  searchFormValues?: Record<string, unknown> | null,
  params?: Record<string, unknown> | null,
): { status?: string; review_status?: string } {
  const stage = resolveListLifecycleStageFromSearch(searchFormValues, params);
  if (!stage) {
    return {};
  }
  return mapPurchaseOrderLifecycleStageToApiParams(stage);
}

export function mapPurchaseOrderLifecycleStageToApiParams(
  stage: string,
): { status?: string; review_status?: string } {
  const normalized = normalizeStageName(stage);
  switch (normalized) {
    case '草稿':
      return { status: 'DRAFT' };
    case '待审核':
      return { status: 'PENDING_REVIEW' };
    case '已审核':
      return { status: 'AUDITED' };
    case '已确认':
      return { status: 'CONFIRMED' };
    case '执行中':
      return { status: 'IN_PROGRESS' };
    case '账款发票':
      return { status: 'IN_PROGRESS' };
    case '已完成':
      return { status: 'COMPLETED' };
    case '已驳回':
      return { review_status: 'REJECTED' };
    case '已取消':
      return { status: 'CANCELLED' };
    default:
      return { status: stage };
  }
}

export interface PurchaseOrderLike {
  status?: string;
  review_status?: string;
  delivery_date?: string;
  lifecycle?: unknown;
}

export function getPurchaseOrderLifecycle(
  record: PurchaseOrderLike | Record<string, unknown> | null | undefined,
  auditRequired = true,
): LifecycleResult {
  if (!record) {
    return { percent: 0, stageName: '-', mainStages: [] };
  }

  const backend = (record?.lifecycle ?? (record as Record<string, unknown>).lifecycle) as
    | BackendLifecycle
    | undefined;
  if (backend?.main_stages?.length && isPurchaseOrderLifecycle(backend)) {
    const result = parseBackendLifecycle(backend);
    const stageName = normalizeStageName(result.stageName);
    return adaptForAuditSwitch({ ...result, stageName: stageName || result.stageName }, auditRequired);
  }

  const status = norm(record?.status as string);
  const reviewStatus = norm(record?.review_status as string);

  if (isRejected(reviewStatus) || status === 'REJECTED' || status === '已驳回') {
    const mainStages = buildMainStages('已驳回');
    return adaptForAuditSwitch(
      {
        percent: ringPercentFromStages(mainStages),
        stageName: '已驳回',
        status: 'exception',
        mainStages,
        nextStepSuggestions: auditRequired ? ['修改后重新提交审核'] : ['修改后重新提交'],
      },
      auditRequired,
    );
  }
  if (isCancelled(status)) {
    const mainStages = buildMainStages('已取消');
    return adaptForAuditSwitch(
      {
        percent: ringPercentFromStages(mainStages),
        stageName: '已取消',
        status: 'exception',
        mainStages,
        nextStepSuggestions: [],
      },
      auditRequired,
    );
  }
  if (isDraft(status)) {
    const mainStages = buildMainStages('草稿');
    return adaptForAuditSwitch(
      {
        percent: ringPercentFromStages(mainStages),
        stageName: '草稿',
        mainStages,
        nextStepSuggestions: auditRequired ? ['提交审核'] : ['提交确认'],
      },
      auditRequired,
    );
  }
  if (isPendingReview(status) && !isApproved(reviewStatus)) {
    const mainStages = buildMainStages('待审核');
    return adaptForAuditSwitch(
      {
        percent: ringPercentFromStages(mainStages),
        stageName: '待审核',
        mainStages,
        nextStepSuggestions: auditRequired ? ['审核通过', '驳回'] : ['确认订单'],
      },
      auditRequired,
    );
  }
  if (isAudited(status) && isApproved(reviewStatus) && !isConfirmed(status)) {
    const mainStages = buildMainStages('已审核');
    return adaptForAuditSwitch(
      {
        percent: ringPercentFromStages(mainStages),
        stageName: '已审核',
        mainStages,
        nextStepSuggestions: ['确认订单'],
      },
      auditRequired,
    );
  }
  if (isCompleted(status)) {
    const mainStages = buildMainStages('已完成');
    return adaptForAuditSwitch(
      {
        percent: ringPercentFromStages(mainStages),
        stageName: '已完成',
        status: 'success',
        mainStages,
        nextStepSuggestions: [],
      },
      auditRequired,
    );
  }
  if (isInProgress(status)) {
    const mainStages = buildMainStages('执行中');
    return adaptForAuditSwitch(
      {
        percent: ringPercentFromStages(mainStages),
        stageName: '执行中',
        mainStages,
        nextStepSuggestions: ['下推收货通知', '下推采购入库'],
      },
      auditRequired,
    );
  }
  if (isApproved(reviewStatus) && (isConfirmed(status) || isAudited(status))) {
    const mainStages = buildMainStages('已确认');
    return adaptForAuditSwitch(
      {
        percent: ringPercentFromStages(mainStages),
        stageName: '已确认',
        mainStages,
        nextStepSuggestions: ['下推收货通知', '下推采购入库'],
      },
      auditRequired,
    );
  }

  const fallback = buildMainStages('草稿');
  return adaptForAuditSwitch(
    {
      percent: ringPercentFromStages(fallback),
      stageName: status || '草稿',
      mainStages: fallback,
      nextStepSuggestions: auditRequired ? ['提交审核'] : ['提交确认'],
    },
    auditRequired,
  );
}

/** 不视为「交货逾期」高亮的生命周期阶段（与列表 KPI 语义一致） */
const PURCHASE_DELIVERY_OVERDUE_EXCLUDED_STAGES = new Set([
  '已完成',
  '已取消',
  '草稿',
  '已驳回',
  '账款发票',
]);

function isPurchaseOrderDeliveryHighlightExcluded(
  record: PurchaseOrderLike,
  auditRequired: boolean,
): boolean {
  if (isCompleted(record.status) || isCancelled(record.status)) return true;
  const lifecycle = getPurchaseOrderLifecycle(record, auditRequired);
  const stage = (lifecycle.stageName ?? '').trim();
  return PURCHASE_DELIVERY_OVERDUE_EXCLUDED_STAGES.has(stage);
}

/**
 * 要求到货日已早于今天，且订单仍在履约链路中（与 purchase-orders/statistics overdue_count 口径一致）。
 */
export function isPurchaseOrderDeliveryOverdue(
  record: PurchaseOrderLike,
  auditRequired = true,
): boolean {
  const raw = record.delivery_date;
  if (raw == null || String(raw).trim() === '') return false;
  const d = dayjs(raw);
  if (!d.isValid() || !d.isBefore(dayjs(), 'day')) return false;

  const reviewStatus = norm(record.review_status as string);
  if (isRejected(reviewStatus)) return false;

  if (isPurchaseOrderDeliveryHighlightExcluded(record, auditRequired)) return false;

  const status = norm(record.status as string);
  if (isDraft(status)) return false;
  if (isPendingReview(status) && !isApproved(reviewStatus)) return false;

  return (
    isAudited(status)
    || isConfirmed(status)
    || isInProgress(status)
    || isApproved(reviewStatus)
  );
}
