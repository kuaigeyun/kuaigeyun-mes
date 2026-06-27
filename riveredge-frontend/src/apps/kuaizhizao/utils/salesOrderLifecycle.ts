/**
 * 销售订单生命周期计算（试点）
 * 输出与通用 LifecycleResult 一致，供 UniLifecycle 展示。
 * 仅保留订单单据本身的主流程节点（不含左侧全链路图中的执行子步骤）。
 */

import dayjs from 'dayjs';
import { canWithdrawSubmittedOrder, isStrictlyAuditedStatus } from '../constants/documentStatus';
import type { LifecycleResult, SubStage } from '../../../components/uni-lifecycle/types';
import type { SalesOrder } from '../services/sales-order';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';
import { applyLifecycleI18n, type LifecycleTranslateFn } from './lifecycleI18n';
import {
  resolveListLifecycleStageFromSearch,
  toListLifecycleStageApiParams,
} from '../../../utils/listLifecycleStage';
import { mapAuditLifecycleStageToApiParams } from './auditListFilter';

const MAIN_STAGE_KEYS = [
  'draft',
  'effective',
  'executing',
  'delivered',
  'invoicing',
  'completed',
] as const;

const MAIN_STAGE_LABELS = {
  draft: '草稿',
  effective: '已生效',
  executing: '执行中',
  delivered: '发货出库',
  invoicing: '账款发票处理',
  completed: '已完成',
} as const;

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

function isRejected(reviewStatus: string | undefined): boolean {
  const r = norm(reviewStatus);
  return r === 'REJECTED' || r === '已驳回' || r === '审核驳回';
}

function isApproved(reviewStatus: string | undefined): boolean {
  const r = norm(reviewStatus);
  return r === 'APPROVED' || r === '审核通过' || r === '通过' || r === '已通过' || r === '已审核';
}

function isCancelled(status: string | undefined): boolean {
  const s = norm(status);
  return s === 'CANCELLED' || s === '已取消';
}

function isClosed(status: string | undefined): boolean {
  const s = norm(status);
  return s === 'CLOSED' || s === '已关闭' || s === 'closed';
}

function isDraft(status: string | undefined): boolean {
  const s = norm(status);
  return s === 'DRAFT' || s === '草稿';
}

function isPendingReview(status: string | undefined): boolean {
  const s = norm(status);
  return s === 'PENDING_REVIEW' || s === '待审核' || s === '已提交';
}

function isAudited(status: string | undefined): boolean {
  const s = norm(status);
  return s === 'AUDITED' || s === '已审核';
}

function isConfirmed(status: string | undefined): boolean {
  const s = norm(status);
  return s === 'CONFIRMED' || s === '已确认' || s === '已生效';
}

/** 已生效：已审核且（已确认或已下推） */
function isEffective(record: SalesOrder): boolean {
  if (!isApproved(record.review_status)) return false;
  return isConfirmed(record.status) || !!record.pushed_to_computation;
}

function deliveryProgress(record: SalesOrder): number {
  const p = record.delivery_progress;
  if (p == null) return 0;
  return Math.min(100, Math.max(0, Number(p)));
}

function invoiceProgress(record: SalesOrder): number {
  const p = record.invoice_progress;
  if (p == null) return 0;
  return Math.min(100, Math.max(0, Number(p)));
}

/** 是否有工单：任意明细存在 work_order_id */
function hasWorkOrder(record: SalesOrder): boolean {
  const items = record.items ?? [];
  return items.some((i) => i?.work_order_id != null && i.work_order_id > 0);
}

/** 统一阶段名为前端主流程用词（与 stepper 标签一致） */
function normalizeStageName(name: string | undefined): string {
  const n = norm(name);
  if (n === '已交货') return '发货出库';
  if (n === '账款发票') return '账款发票处理';
  if (n === 'invoicing') return '账款发票处理';
  return n || '';
}

/** 主生命周期节点（业务主轴，审核态由独立列展示） */
function buildMainStages(stageName: string): SubStage[] {
  const normalized = normalizeStageName(stageName);
  const order = MAIN_STAGE_KEYS;

  const stageToIndex: Record<string, number> = {
    草稿: 0,
    待审核: 0,
    已审核: 0,
    已生效: 1,
    执行中: 2,
    已交货: 3,
    发货出库: 3,
    invoicing: 4,
    账款发票: 4,
    账款发票处理: 4,
    已完成: 5,
    已驳回: 0,
    已取消: 0,
    已关闭: 5,
  };

  const currentIdx = stageToIndex[normalized] ?? 0;
  const isCompleted = normalized === '已完成';

  return order.map((key, idx) => {
    let status: SubStage['status'] = 'pending';
    if (isCompleted) status = 'done';
    else if (idx < currentIdx) status = 'done';
    else if (idx === currentIdx) status = 'active';
    return { key, label: MAIN_STAGE_LABELS[key], status };
  });
}

function adaptForAuditSwitch(result: LifecycleResult, auditRequired: boolean): LifecycleResult {
  const stageRaw = normalizeStageName(result.stageName);
  if (!stageRaw) return result;

  let next = [...(result.nextStepSuggestions ?? [])];
  if (!auditRequired) {
    next = next
      .map((s) => s.replace(/提交审核/g, '提交').replace(/审核通过/g, '确认'))
      .filter((s) => !s.includes('审核'));
  }

  const mainStages = result.mainStages?.length
    ? result.mainStages.filter((s) => s.key !== 'pending_review' && s.key !== 'audited')
    : buildMainStages(stageRaw);

  return {
    ...result,
    stageName: stageRaw,
    mainStages,
    nextStepSuggestions: next,
  };
}

const SALES_ORDER_LIFECYCLE_STAGE_I18N: Record<string, string> = {
  草稿: 'app.kuaizhizao.salesOrder.lifecycleDraft',
  待审核: 'app.kuaizhizao.salesOrder.lifecyclePendingReview',
  已审核: 'app.kuaizhizao.salesOrder.lifecycleAudited',
  已生效: 'app.kuaizhizao.salesOrder.lifecycleEffective',
  执行中: 'app.kuaizhizao.salesOrder.lifecycleInProgress',
  发货出库: 'app.kuaizhizao.salesOrder.lifecycleDelivered',
  账款发票处理: 'app.kuaizhizao.salesOrder.lifecycleInvoicing',
  已完成: 'app.kuaizhizao.salesOrder.lifecycleCompleted',
  已驳回: 'app.kuaizhizao.salesOrder.lifecycleRejected',
  已取消: 'app.kuaizhizao.salesOrder.lifecycleCancelled',
  已关闭: 'app.kuaizhizao.salesOrder.lifecycleClosed',
};

export const SALES_ORDER_EXCEPTION_LIFECYCLE_STAGES = ['已驳回', '已取消', '已关闭'] as const;

/** 列表筛选 / 钉住 Tab：与生命周期主轴一致（不含历史别名如「已交货」「账款发票」） */
export function getSalesOrderLifecycleStageLabels(auditRequired = true): string[] {
  void auditRequired;
  return [...MAIN_STAGE_KEYS.map((k) => MAIN_STAGE_LABELS[k]), ...SALES_ORDER_EXCEPTION_LIFECYCLE_STAGES];
}

type LifecycleTranslate = (key: string, defaultValue?: string) => string;

/** 供 ProColumns.valueEnum 与 uni-query 生命周期 Tab 使用 */
export function buildSalesOrderLifecycleValueEnum(
  t: LifecycleTranslate,
  auditRequired = true,
): Record<string, { text: string }> {
  return Object.fromEntries(
    getSalesOrderLifecycleStageLabels(auditRequired).map((stage) => [
      stage,
      { text: t(SALES_ORDER_LIFECYCLE_STAGE_I18N[stage] ?? stage, stage) },
    ]),
  );
}

/** 从搜索表单 / 钉住条件解析列表筛选；仅 lifecycle_stage */
export function resolveSalesOrderListLifecycleParams(
  searchFormValues?: Record<string, unknown> | null,
  params?: Record<string, unknown> | null,
): { lifecycle_stage?: string; status?: string; review_status?: string } {
  const stage = resolveListLifecycleStageFromSearch(searchFormValues, params);
  const normalized = stage ? normalizeStageName(stage) : '';
  if (!normalized) return {};
  const auditParams = mapAuditLifecycleStageToApiParams(normalized);
  if (auditParams) return auditParams;
  return toListLifecycleStageApiParams(normalized);
}

/** @deprecated 使用 resolveSalesOrderListLifecycleParams */
export function mapSalesOrderLifecycleStageToApiParams(
  stage: string,
): { lifecycle_stage?: string } {
  const normalized = normalizeStageName(stage);
  if (!normalized) {
    return {};
  }
  return { lifecycle_stage: normalized };
}

/**
 * 根据销售订单计算生命周期结果，供 UniLifecycle 使用。
 * 仅使用后端下发的 lifecycle（无则显示「生命周期缺失」）。
 */
function parseSalesOrderBackendLifecycle(record: SalesOrder, auditRequired = true): LifecycleResult {
  const backend = (record as Record<string, unknown>).lifecycle as BackendLifecycle | undefined;
  if (!backend?.main_stages?.length) {
    return {
      percent: 0,
      stageName: '生命周期缺失',
      status: 'exception',
      mainStages: [],
    };
  }

  const result = parseBackendLifecycle(backend);
  const enriched: LifecycleResult = {
    ...result,
    ...(record.invoice_progress != null &&
    normalizeStageName(result.stageName) === '账款发票处理'
      ? {
          subPercent: Number(record.invoice_progress),
          subLabel: '账款',
        }
      : {}),
  };
  return adaptForAuditSwitch(enriched, auditRequired);
}

const SHIPPABLE_STAGE = '可发货';
const SHIPPABLE_ELIGIBLE_STAGES = new Set(['执行中', '已生效', '发货出库', '已交货']);

/** 库存满足欠交时，将「执行中」升维展示为「可发货」（阶段名 + 绿色圆环） */
function applyShippableLifecycleHint(record: SalesOrder, result: LifecycleResult): LifecycleResult {
  if (!record.has_shippable_products) return result;

  const stage = normalizeStageName(result.stageName);
  const activeExecuting = result.mainStages?.some((s) => s.status === 'active' && s.key === 'executing');
  if (!SHIPPABLE_ELIGIBLE_STAGES.has(stage) && !activeExecuting) return result;

  const qty = Number(record.shippable_quantity ?? 0);
  const mainStages = result.mainStages?.map((s) =>
    s.status === 'active' && s.key === 'executing' ? { ...s, label: SHIPPABLE_STAGE } : s,
  );
  const subStages = result.subStages?.map((s) =>
    s.key === 'shipment_waiting' && s.status !== 'done'
      ? { ...s, label: SHIPPABLE_STAGE, status: 'active' as SubStage['status'] }
      : s,
  );

  const suggestions = [
    '下推发货通知',
    ...(result.nextStepSuggestions ?? []).filter((s) => !s.includes('可发货')),
  ];

  return {
    ...result,
    stageName: SHIPPABLE_STAGE,
    status: 'success',
    mainStages,
    subStages,
    subPercent: qty > 0 ? undefined : result.subPercent,
    subLabel: qty > 0 ? `${Math.round(qty)}件待出` : result.subLabel,
    nextStepSuggestions: suggestions,
  };
}

const SALES_ORDER_STAGE_I18N_BY_KEY: Record<string, string> = {
  draft: 'app.kuaizhizao.salesOrder.lifecycleDraft',
  pending_review: 'app.kuaizhizao.salesOrder.lifecyclePendingReview',
  audited: 'app.kuaizhizao.salesOrder.lifecycleAudited',
  effective: 'app.kuaizhizao.salesOrder.lifecycleEffective',
  executing: 'app.kuaizhizao.salesOrder.lifecycleInProgress',
  delivered: 'app.kuaizhizao.salesOrder.lifecycleDelivered',
  invoicing: 'app.kuaizhizao.salesOrder.lifecycleInvoicing',
  completed: 'app.kuaizhizao.salesOrder.lifecycleCompleted',
};

export function getSalesOrderLifecycle(
  record: SalesOrder,
  auditRequired = true,
  t?: LifecycleTranslateFn,
): LifecycleResult {
  let result = applyShippableLifecycleHint(record, parseSalesOrderBackendLifecycle(record, auditRequired));
  if (t) {
    result = applyLifecycleI18n(result, t, SALES_ORDER_STAGE_I18N_BY_KEY);
  }
  return result;
}

/** 批量撤回：撤销提交（生命周期「待审核」「已生效」） */
export function canWithdrawSalesOrderRecord(record: SalesOrder, auditRequired = true): boolean {
  if (isSalesOrderClosed(record)) return false;
  const phase = String((record as { audit?: { phase?: string } }).audit?.phase ?? '').toLowerCase();
  if (auditRequired && phase === 'pending') return true;
  const stage = (getSalesOrderLifecycle(record, auditRequired).stageName ?? '').trim();
  if (stage === '已生效') return true;
  return canWithdrawSubmittedOrder(record.status);
}

/** 批量反审核：撤销审核（audit.phase=approved 或严格已审核态） */
export function canUnapproveSalesOrderRecord(record: SalesOrder, auditRequired = true): boolean {
  if (isSalesOrderClosed(record)) return false;
  const phase = String((record as { audit?: { phase?: string } }).audit?.phase ?? '').toLowerCase();
  if (auditRequired && phase === 'approved') return true;
  return isStrictlyAuditedStatus(record.status);
}

/** 销售订单是否已关闭（剩余执行已终止） */
export function isSalesOrderClosed(record: Pick<SalesOrder, 'status'>): boolean {
  return isClosed(record.status);
}

/** 不视为「交货逾期」高亮的生命周期阶段（与列表展示语义一致） */
const DELIVERY_OVERDUE_EXCLUDED_STAGES = new Set(['已完成', '已关闭', '已取消', '草稿', '已驳回', '账款发票', '账款发票处理']);

/** 整单已交货闭环或处于不提示逾期的阶段 */
export function isSalesOrderDeliveryHighlightExcluded(record: SalesOrder, auditRequired = true): boolean {
  const dp = record.delivery_progress;
  if (dp != null && Number(dp) >= 100) return true;
  const lifecycle = getSalesOrderLifecycle(record, auditRequired);
  const stage = (lifecycle.stageName ?? '').trim();
  return DELIVERY_OVERDUE_EXCLUDED_STAGES.has(stage);
}

/**
 * 订单头交货日已早于今天，且订单仍在履约链路中（未完结、未取消等）、整单交货未闭环。
 */
export function isSalesOrderDeliveryOverdue(record: SalesOrder, auditRequired = true): boolean {
  const raw = record.delivery_date;
  if (raw == null || String(raw).trim() === '') return false;
  const d = dayjs(raw);
  if (!d.isValid() || !d.isBefore(dayjs(), 'day')) return false;

  if (isSalesOrderDeliveryHighlightExcluded(record, auditRequired)) return false;

  return true;
}

/**
 * 明细平铺行：按行交货日判断是否逾期（该行仍有未交数量且所属订单未终结）。
 */
export function isSalesOrderLineDeliveryOverdue(
  row: {
    delivery_date?: string;
    required_quantity?: number;
    delivered_quantity?: number;
    sales_order_id: number;
    status?: string;
    review_status?: string;
    delivery_progress?: number | null;
    pushed_to_computation?: boolean;
  },
  auditRequired = true,
): boolean {
  const lineDd = row.delivery_date;
  if (lineDd == null || String(lineDd).trim() === '') return false;
  const lineDay = dayjs(lineDd);
  if (!lineDay.isValid() || !lineDay.isBefore(dayjs(), 'day')) return false;

  const req = Number(row.required_quantity ?? 0);
  const del = Number(row.delivered_quantity ?? 0);
  if (req > 0 && del >= req) return false;

  const pseudo: SalesOrder = {
    id: row.sales_order_id,
    status: row.status,
    review_status: row.review_status,
    delivery_progress: row.delivery_progress ?? undefined,
    pushed_to_computation: row.pushed_to_computation,
  };
  if (isSalesOrderDeliveryHighlightExcluded(pseudo, auditRequired)) return false;

  return true;
}
