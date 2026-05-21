/**
 * 销售订单生命周期计算（试点）
 * 输出与通用 LifecycleResult 一致，供 UniLifecycle 展示。
 * 仅保留订单单据本身的主流程节点（不含左侧全链路图中的执行子步骤）。
 */

import dayjs from 'dayjs';
import type { LifecycleResult, SubStage } from '../../../components/uni-lifecycle/types';
import type { SalesOrder } from '../services/sales-order';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';
import { deriveLifecycleRingPercent } from '../../../utils/lifecycleRingPercent';

const MAIN_STAGE_KEYS_AUDIT = [
  'draft',
  'pending_review',
  'audited',
  'effective',
  'executing',
  'delivered',
  'invoicing',
  'completed',
] as const;
const MAIN_STAGE_KEYS_NO_AUDIT = ['draft', 'effective', 'executing', 'delivered', 'invoicing', 'completed'] as const;

const MAIN_STAGE_LABELS = {
  draft: '草稿',
  pending_review: '待审核',
  audited: '已审核',
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

/** 主生命周期节点（启用审核：含待审核/已审核；关闭审核：草稿后直接走已生效及后续） */
function buildMainStages(stageName: string, auditRequired: boolean): SubStage[] {
  const normalized = normalizeStageName(stageName);
  const order = auditRequired ? MAIN_STAGE_KEYS_AUDIT : MAIN_STAGE_KEYS_NO_AUDIT;

  const stageToIndexAudit: Record<string, number> = {
    草稿: 0,
    待审核: 1,
    已审核: 2,
    已生效: 3,
    执行中: 4,
    已交货: 5,
    发货出库: 5,
    invoicing: 6,
    账款发票: 6,
    账款发票处理: 6,
    已完成: 7,
    已驳回: 1,
    已取消: 0,
    已关闭: 7,
  };

  const stageToIndexNoAudit: Record<string, number> = {
    草稿: 0,
    待审核: 1,
    已审核: 1,
    已生效: 1,
    执行中: 2,
    已交货: 3,
    发货出库: 3,
    invoicing: 4,
    账款发票: 4,
    账款发票处理: 4,
    已完成: 5,
    已驳回: 1,
    已取消: 0,
    已关闭: 7,
  };

  const stageToIndex = auditRequired ? stageToIndexAudit : stageToIndexNoAudit;
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

const CN_STAGE_NAMES = new Set([
  '草稿',
  '待审核',
  '已审核',
  '已生效',
  '执行中',
  '已交货',
  '发货出库',
  '账款发票',
  '账款发票处理',
  '已完成',
  '已驳回',
  '已取消',
  '已关闭',
]);

/** 由主线节点推导圆环进度（与 parseBackendLifecycle 规则一致） */
function ringPercentFromStages(stages: SubStage[]): number {
  const p = deriveLifecycleRingPercent(stages.map(({ status }) => ({ status })));
  return p ?? 0;
}

function adaptForAuditSwitch(result: LifecycleResult, auditRequired: boolean): LifecycleResult {
  const base: LifecycleResult = { ...result, subStages: undefined };
  const stageRaw = normalizeStageName(base.stageName);

  if (stageRaw && CN_STAGE_NAMES.has(stageRaw)) {
    let next = [...(base.nextStepSuggestions ?? [])];

    if (!auditRequired) {
      next = next.map((s) => s.replace(/提交审核/g, '提交').replace(/审核通过/g, '确认')).filter((s) => !s.includes('审核'));
    }

    return {
      ...base,
      stageName: stageRaw,
      mainStages: buildMainStages(stageRaw, auditRequired),
      nextStepSuggestions: next,
    };
  }

  let mainStages = base.mainStages ?? [];
  if (!auditRequired) {
    mainStages = mainStages.filter((s) => s.key !== 'pending_review' && s.key !== 'audited');
  }

  return { ...base, mainStages };
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
  const keys = auditRequired ? MAIN_STAGE_KEYS_AUDIT : MAIN_STAGE_KEYS_NO_AUDIT;
  return [...keys.map((k) => MAIN_STAGE_LABELS[k]), ...SALES_ORDER_EXCEPTION_LIFECYCLE_STAGES];
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

/** lifecycle Tab 值 → 列表 API 查询参数 */
export function mapSalesOrderLifecycleStageToApiParams(
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
    case '已生效':
      return { status: 'CONFIRMED' };
    case '执行中':
      return { status: 'IN_PROGRESS' };
    case '发货出库':
      return { status: 'IN_PROGRESS' };
    case '账款发票处理':
      return { status: 'IN_PROGRESS' };
    case '已完成':
      return { status: 'COMPLETED' };
    case '已驳回':
      return { review_status: 'REJECTED' };
    case '已取消':
      return { status: 'CANCELLED' };
    case '已关闭':
      return { status: 'CLOSED' };
    default:
      if (stage === '已确认') return { status: 'CONFIRMED' };
      if (stage === '已交货') return { status: 'DELIVERED' };
      if (stage === '账款发票') return { status: 'IN_PROGRESS' };
      return { status: stage };
  }
}

/**
 * 根据销售订单计算生命周期结果，供 UniLifecycle 使用。
 * 优先使用后端下发的 lifecycle（节点由后端控制），无则前端兜底计算。
 */
export function getSalesOrderLifecycle(record: SalesOrder, auditRequired = true): LifecycleResult {
  const backend = (record as Record<string, unknown>).lifecycle as BackendLifecycle | undefined;
  if (backend?.main_stages?.length) {
    const result = parseBackendLifecycle(backend);
    const s = norm(record?.status);
    const r = norm(record?.review_status);
    const isRecordAudited =
      (s === 'AUDITED' || s === '已审核') && (r === 'APPROVED' || r === '审核通过' || r === '通过' || r === '已通过');
    if (isRecordAudited && result.stageName === '待审核') {
      return adaptForAuditSwitch({ ...result, stageName: '已审核' }, auditRequired);
    }
    return adaptForAuditSwitch(result, auditRequired);
  }
  const status = norm(record?.status);
  const reviewStatus = norm(record?.review_status);
  const delivery = deliveryProgress(record);
  const invoice = invoiceProgress(record);

  // 异常分支
  if (isRejected(reviewStatus)) {
    const mainStages = buildMainStages('已驳回', auditRequired);
    return adaptForAuditSwitch(
      {
        percent: ringPercentFromStages(mainStages),
        stageName: '已驳回',
        status: 'exception',
        mainStages,
        nextStepSuggestions: auditRequired ? ['修改订单后重新提交审核'] : ['修改订单后重新提交'],
      },
      auditRequired,
    );
  }
  if (isCancelled(status)) {
    const mainStages = buildMainStages('已取消', auditRequired);
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
  if (isClosed(status)) {
    const mainStages = buildMainStages('已完成', auditRequired);
    return adaptForAuditSwitch(
      {
        percent: ringPercentFromStages(mainStages),
        stageName: '已关闭',
        status: 'normal',
        mainStages,
        nextStepSuggestions: [],
      },
      auditRequired,
    );
  }

  // 主流程
  if (isDraft(status)) {
    const mainStages = buildMainStages('草稿', auditRequired);
    return adaptForAuditSwitch(
      {
        percent: ringPercentFromStages(mainStages),
        stageName: '草稿',
        mainStages,
        nextStepSuggestions: auditRequired ? ['提交审核'] : ['提交'],
      },
      auditRequired,
    );
  }
  if (isPendingReview(status) && isApproved(reviewStatus)) {
    const mainStages = buildMainStages('已审核', auditRequired);
    return adaptForAuditSwitch(
      {
        percent: ringPercentFromStages(mainStages),
        stageName: '已审核',
        mainStages,
        nextStepSuggestions: ['下推需求计算或确认生效'],
      },
      auditRequired,
    );
  }
  if (isPendingReview(status) && !isApproved(reviewStatus)) {
    const mainStages = buildMainStages('待审核', auditRequired);
    return adaptForAuditSwitch(
      {
        percent: ringPercentFromStages(mainStages),
        stageName: '待审核',
        mainStages,
        nextStepSuggestions: auditRequired ? ['审核通过', '驳回'] : [],
      },
      auditRequired,
    );
  }
  if (isAudited(status) && !isEffective(record)) {
    const mainStages = buildMainStages('已审核', auditRequired);
    return adaptForAuditSwitch(
      {
        percent: ringPercentFromStages(mainStages),
        stageName: '已审核',
        mainStages,
        nextStepSuggestions: ['下推需求计算', '确认订单生效'],
      },
      auditRequired,
    );
  }
  if (isEffective(record) && delivery >= 100 && invoice >= 100) {
    const mainStages = buildMainStages('已完成', auditRequired);
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
  if (isEffective(record) && delivery >= 100 && invoice < 100) {
    const mainStages = buildMainStages('账款发票处理', auditRequired);
    const baseRing = ringPercentFromStages(mainStages);
    return adaptForAuditSwitch(
      {
        percent: Math.min(100, Math.round(baseRing + ((100 - baseRing) * invoice) / 100)),
        stageName: '账款发票处理',
        subPercent: invoice,
        subLabel: '开票',
        mainStages,
        nextStepSuggestions: ['下推销售发票', '登记收款与对账'],
      },
      auditRequired,
    );
  }
  /** 已生效：订单已确认/已下推，但尚未开始执行（无工单、无交货进度） */
  if (isEffective(record) && delivery <= 0) {
    const hasWO = hasWorkOrder(record);
    const pushed = !!record.pushed_to_computation;
    if (!pushed && !hasWO) {
      const mainStages = buildMainStages('已生效', auditRequired);
      return adaptForAuditSwitch(
        {
          percent: ringPercentFromStages(mainStages),
          stageName: '已生效',
          mainStages,
          nextStepSuggestions: ['前往需求计算执行 MRP', '建立工单'],
        },
        auditRequired,
      );
    }
  }
  /** 执行中：圆环进度由主线节点序号推导；交货进度由 subPercent 展示 */
  if (isEffective(record) && delivery < 100) {
    const mainStages = buildMainStages('执行中', auditRequired);
    return adaptForAuditSwitch(
      {
        percent: ringPercentFromStages(mainStages),
        stageName: '执行中',
        subPercent: delivery,
        subLabel: '交货',
        mainStages,
        nextStepSuggestions:
          delivery > 0 ? ['完成发货出库', '跟进开票'] : ['制定生产计划', '推进工单与出库'],
      },
      auditRequired,
    );
  }

  const fallbackAudited = buildMainStages('已审核', auditRequired);
  return adaptForAuditSwitch(
    {
      percent: ringPercentFromStages(fallbackAudited),
      stageName: '已审核',
      mainStages: fallbackAudited,
      nextStepSuggestions: ['下推需求计算'],
    },
    auditRequired,
  );
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
