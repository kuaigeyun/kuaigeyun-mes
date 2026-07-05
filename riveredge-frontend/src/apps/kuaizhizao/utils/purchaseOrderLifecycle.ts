/**
 * 采购订单生命周期：优先使用后端 lifecycle，无则前端兜底。
 * 主轴：草稿→待审核→已审核→已确认→执行中→账款发票→已完成
 */

import dayjs from 'dayjs';
import type { LifecycleResult, SubStage } from '../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';
import { deriveLifecycleRingPercent } from '../../../utils/lifecycleRingPercent';
import { applyLifecycleI18n, requireI18nText, type LifecycleTranslateFn } from './lifecycleI18n';
import { LIFECYCLE_DOCUMENT_ACTION_LABEL_KEYS as DA } from '../constants/lifecycleDocumentActionLabelKeys';
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

  const mainStages = (base.mainStages ?? []).filter(
    (s) => s.key !== 'pending_review' && s.key !== 'audited',
  );

  if (stageRaw && CN_STAGE_NAMES.has(stageRaw)) {
    return {
      ...base,
      stageName,
      mainStages: mainStages.length ? mainStages : buildMainStages(stageName),
      nextStepSuggestions: [],
    };
  }

  return { ...base, stageName, mainStages, nextStepSuggestions: [] };
}

export const PURCHASE_ORDER_EXCEPTION_LIFECYCLE_STAGES = ['已驳回', '已取消'] as const;

export function getPurchaseOrderLifecycleStageLabels(auditRequired = true): string[] {
  void auditRequired;
  return [...MAIN_STAGE_KEYS.map((k) => MAIN_STAGE_LABELS[k]), ...PURCHASE_ORDER_EXCEPTION_LIFECYCLE_STAGES];
}

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
  t: LifecycleTranslateFn,
  auditRequired = true,
): Record<string, { text: string }> {
  return Object.fromEntries(
    getPurchaseOrderLifecycleStageLabels(auditRequired).map((stage) => [
      stage,
      { text: requireI18nText(t, PURCHASE_ORDER_LIFECYCLE_STAGE_I18N[stage]!) },
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

const PURCHASE_ORDER_STAGE_I18N_BY_KEY: Record<string, string> = {
  draft: 'app.kuaizhizao.purchaseOrder.lifecycleDraft',
  pending_review: 'app.kuaizhizao.purchaseOrder.lifecyclePendingReview',
  audited: 'app.kuaizhizao.purchaseOrder.lifecycleAudited',
  confirmed: 'app.kuaizhizao.purchaseOrder.lifecycleConfirmed',
  executing: 'app.kuaizhizao.purchaseOrder.lifecycleExecuting',
  invoicing: 'app.kuaizhizao.purchaseOrder.lifecycleInvoicing',
  completed: 'app.kuaizhizao.purchaseOrder.lifecycleCompleted',
};

const PO = 'app.kuaizhizao.purchaseOrder';

const PURCHASE_RECEIPT_ACTION_KEYS = [
  DA.receiptNoticeFromPurchaseOrder,
  DA.purchaseReceiptFromPurchaseOrder,
] as const;

function purchaseOrderNextStepKeys(auditRequired: boolean) {
  return {
    rejected: auditRequired ? [`${PO}.lifecycleNextResubmitAfterReject`] : [`${PO}.lifecycleNextResubmit`],
    draft: auditRequired ? [`${PO}.lifecycleNextSubmitReview`] : [`${PO}.lifecycleNextSubmit`],
    pendingReview: auditRequired
      ? [`${PO}.lifecycleNextApprove`, `${PO}.lifecycleNextReject`]
      : [`${PO}.lifecycleNextConfirmOrder`],
    audited: [`${PO}.lifecycleNextConfirmOrder`],
    receipt: [...PURCHASE_RECEIPT_ACTION_KEYS],
    none: [] as string[],
  };
}

function resolvePurchaseOrderNextStepKeys(
  result: LifecycleResult,
  auditRequired: boolean,
): string[] {
  const keys = purchaseOrderNextStepKeys(auditRequired);
  const activeKey = result.mainStages?.find((s) => s.status === 'active')?.key;
  if (activeKey === 'pending_review') return keys.pendingReview;
  if (activeKey === 'audited') return keys.audited;
  if (activeKey === 'confirmed' || activeKey === 'executing') return keys.receipt;
  if (activeKey === 'draft') return keys.draft;
  return keys.none;
}

function finalizePurchaseOrderLifecycle(
  result: LifecycleResult,
  auditRequired: boolean,
  t: LifecycleTranslateFn,
  explicitNextStepKeys?: string[],
): LifecycleResult {
  const adapted = adaptForAuditSwitch(result, auditRequired);
  const localized = applyLifecycleI18n(adapted, t, PURCHASE_ORDER_STAGE_I18N_BY_KEY, {});
  const nextStepKeys =
    explicitNextStepKeys ?? resolvePurchaseOrderNextStepKeys(adapted, auditRequired);
  return {
    ...localized,
    nextStepSuggestions: nextStepKeys.map((key) => requireI18nText(t, key)),
  };
}

export function getPurchaseOrderLifecycle(
  record: PurchaseOrderLike | Record<string, unknown> | null | undefined,
  auditRequired = true,
  t: LifecycleTranslateFn,
): LifecycleResult {
  if (!record) {
    return { percent: 0, stageName: '-', mainStages: [] };
  }

  const backend = (record?.lifecycle ?? (record as Record<string, unknown>).lifecycle) as
    | BackendLifecycle
    | undefined;
  if (backend?.main_stages?.length && isPurchaseOrderLifecycle(backend)) {
    const parsed = parseBackendLifecycle(backend);
    const stageName = normalizeStageName(parsed.stageName);
    return finalizePurchaseOrderLifecycle(
      { ...parsed, stageName: stageName || parsed.stageName },
      auditRequired,
      t,
    );
  }

  const status = norm(record?.status as string);
  const reviewStatus = norm(record?.review_status as string);

  if (isRejected(reviewStatus) || status === 'REJECTED' || status === '已驳回') {
    const mainStages = buildMainStages('已驳回');
    return finalizePurchaseOrderLifecycle(
      {
        percent: ringPercentFromStages(mainStages),
        stageName: '已驳回',
        status: 'exception',
        mainStages,
      },
      auditRequired,
      t,
      purchaseOrderNextStepKeys(auditRequired).rejected,
    );
  }
  if (isCancelled(status)) {
    const mainStages = buildMainStages('已取消');
    return finalizePurchaseOrderLifecycle(
      {
        percent: ringPercentFromStages(mainStages),
        stageName: '已取消',
        status: 'exception',
        mainStages,
      },
      auditRequired,
      t,
      purchaseOrderNextStepKeys(auditRequired).none,
    );
  }
  if (isDraft(status)) {
    const mainStages = buildMainStages('草稿');
    return finalizePurchaseOrderLifecycle(
      {
        percent: ringPercentFromStages(mainStages),
        stageName: '草稿',
        mainStages,
      },
      auditRequired,
      t,
      purchaseOrderNextStepKeys(auditRequired).draft,
    );
  }
  if (isPendingReview(status) && !isApproved(reviewStatus)) {
    const mainStages = buildMainStages('待审核');
    return finalizePurchaseOrderLifecycle(
      {
        percent: ringPercentFromStages(mainStages),
        stageName: '待审核',
        mainStages,
      },
      auditRequired,
      t,
      purchaseOrderNextStepKeys(auditRequired).pendingReview,
    );
  }
  if (isAudited(status) && isApproved(reviewStatus) && !isConfirmed(status)) {
    const mainStages = buildMainStages('已审核');
    return finalizePurchaseOrderLifecycle(
      {
        percent: ringPercentFromStages(mainStages),
        stageName: '已审核',
        mainStages,
      },
      auditRequired,
      t,
      purchaseOrderNextStepKeys(auditRequired).audited,
    );
  }
  if (isCompleted(status)) {
    const mainStages = buildMainStages('已完成');
    return finalizePurchaseOrderLifecycle(
      {
        percent: ringPercentFromStages(mainStages),
        stageName: '已完成',
        status: 'success',
        mainStages,
      },
      auditRequired,
      t,
      purchaseOrderNextStepKeys(auditRequired).none,
    );
  }
  if (isInProgress(status)) {
    const mainStages = buildMainStages('执行中');
    return finalizePurchaseOrderLifecycle(
      {
        percent: ringPercentFromStages(mainStages),
        stageName: '执行中',
        mainStages,
      },
      auditRequired,
      t,
      purchaseOrderNextStepKeys(auditRequired).receipt,
    );
  }
  if (isApproved(reviewStatus) && (isConfirmed(status) || isAudited(status))) {
    const mainStages = buildMainStages('已确认');
    return finalizePurchaseOrderLifecycle(
      {
        percent: ringPercentFromStages(mainStages),
        stageName: '已确认',
        mainStages,
      },
      auditRequired,
      t,
      purchaseOrderNextStepKeys(auditRequired).receipt,
    );
  }

  const unknownStages = buildMainStages('草稿');
  return finalizePurchaseOrderLifecycle(
    {
      percent: ringPercentFromStages(unknownStages),
      stageName: status || '草稿',
      mainStages: unknownStages,
    },
    auditRequired,
    t,
    purchaseOrderNextStepKeys(auditRequired).draft,
  );
}

function isPurchaseOrderDeliveryHighlightExcluded(record: PurchaseOrderLike): boolean {
  if (isCompleted(record.status) || isCancelled(record.status)) return true;
  if (isRejected(record.review_status)) return true;
  if (isDraft(record.status)) return true;
  return false;
}

/**
 * 要求到货日已早于今天，且订单仍在履约链路中（与 purchase-orders/statistics overdue_count 口径一致）。
 */
export function isPurchaseOrderDeliveryOverdue(
  record: PurchaseOrderLike,
  auditRequired = true,
): boolean {
  void auditRequired;
  const raw = record.delivery_date;
  if (raw == null || String(raw).trim() === '') return false;
  const d = dayjs(raw);
  if (!d.isValid() || !d.isBefore(dayjs(), 'day')) return false;

  const reviewStatus = norm(record.review_status as string);
  if (isRejected(reviewStatus)) return false;

  if (isPurchaseOrderDeliveryHighlightExcluded(record)) return false;

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
