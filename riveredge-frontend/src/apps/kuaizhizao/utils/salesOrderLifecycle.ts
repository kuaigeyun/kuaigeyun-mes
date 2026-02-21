/**
 * 销售订单生命周期计算（试点）
 * 输出与通用 LifecycleResult 一致，供 UniLifecycle 展示；执行中返回全链路 subStages。
 */

import type { LifecycleResult, SubStage } from '../../../../components/uni-lifecycle/types';
import type { SalesOrder } from '../services/sales-order';

const MAIN_STAGE_KEYS = ['draft', 'pending_review', 'audited', 'effective', 'executing', 'delivered', 'completed'] as const;
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
  'material_ready',
  'work_order_create',
  'work_order_exec',
  'product_inbound',
  'sales_delivery',
] as const;

const EXEC_SUB_STAGE_LABELS: Record<(typeof EXEC_SUB_STAGE_KEYS)[number], string> = {
  bom_check: 'BOM检查',
  demand_compute: '需求计算',
  material_ready: '物料齐套',
  work_order_create: '工单建立',
  work_order_exec: '工单执行',
  product_inbound: '成品入库',
  sales_delivery: '销售出库/交货',
};

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

function isRejected(reviewStatus: string | undefined): boolean {
  const r = norm(reviewStatus);
  return r === 'REJECTED' || r === '已驳回' || r === '审核驳回';
}

function isApproved(reviewStatus: string | undefined): boolean {
  const r = norm(reviewStatus);
  return r === 'APPROVED' || r === '审核通过' || r === '通过' || r === '已通过';
}

function isCancelled(status: string | undefined): boolean {
  const s = norm(status);
  return s === 'CANCELLED' || s === '已取消';
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

/** 执行中 · 全链路子阶段（7 步），按现有数据标 done/active/pending；仅一个 active */
function buildExecutionSubStages(record: SalesOrder): SubStage[] {
  const pushed = !!record.pushed_to_computation;
  const hasWO = hasWorkOrder(record);
  const delivery = deliveryProgress(record);

  const stages: SubStage[] = [
    { key: EXEC_SUB_STAGE_KEYS[0], label: EXEC_SUB_STAGE_LABELS.bom_check, status: 'pending' },
    { key: EXEC_SUB_STAGE_KEYS[1], label: EXEC_SUB_STAGE_LABELS.demand_compute, status: pushed ? 'done' : 'pending' },
    { key: EXEC_SUB_STAGE_KEYS[2], label: EXEC_SUB_STAGE_LABELS.material_ready, status: 'pending' },
    { key: EXEC_SUB_STAGE_KEYS[3], label: EXEC_SUB_STAGE_LABELS.work_order_create, status: hasWO ? 'done' : 'pending' },
    { key: EXEC_SUB_STAGE_KEYS[4], label: EXEC_SUB_STAGE_LABELS.work_order_exec, status: 'pending' },
    { key: EXEC_SUB_STAGE_KEYS[5], label: EXEC_SUB_STAGE_LABELS.product_inbound, status: 'pending' },
    {
      key: EXEC_SUB_STAGE_KEYS[6],
      label: EXEC_SUB_STAGE_LABELS.sales_delivery,
      status: delivery >= 100 ? 'done' : delivery > 0 ? 'done' : 'pending', // 有进度则视为该步进行中/完成
    },
  ];

  // 销售出库：有交货进度但未满 100% 时该步为 active
  if (delivery > 0 && delivery < 100) {
    const idx = stages.findIndex((s) => s.key === 'sales_delivery');
    if (idx >= 0) stages[idx].status = 'active';
  }

  // 第一个 pending 标为 active（若尚未有 active）
  if (!stages.some((s) => s.status === 'active')) {
    const first = stages.find((s) => s.status === 'pending');
    if (first) first.status = 'active';
  }

  return stages;
}

/** 当前子阶段名（用于 subLabel） */
function currentSubStageLabel(subStages: SubStage[]): string {
  const active = subStages.find((s) => s.status === 'active');
  if (active) return active.label;
  const last = subStages[subStages.length - 1];
  return last?.label ?? '';
}

/** 主生命周期 7 节点，用于详情「节点+线」展示 */
function buildMainStages(stageName: string, isException: boolean): SubStage[] {
  const order: (typeof MAIN_STAGE_KEYS)[number][] = [
    'draft',
    'pending_review',
    'audited',
    'effective',
    'executing',
    'delivered',
    'completed',
  ];
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
  const currentIdx = stageToIndex[stageName] ?? 0;
  const isCompleted = stageName === '已完成';
  return order.map((key, idx) => {
    let status: SubStage['status'] = 'pending';
    if (isCompleted) status = 'done';
    else if (idx < currentIdx) status = 'done';
    else if (idx === currentIdx) status = 'active';
    return { key, label: MAIN_STAGE_LABELS[key], status };
  });
}

/**
 * 根据销售订单计算生命周期结果，供 UniLifecycle 使用。
 */
export function getSalesOrderLifecycle(record: SalesOrder): LifecycleResult {
  const status = norm(record?.status);
  const reviewStatus = norm(record?.review_status);
  const delivery = deliveryProgress(record);
  const invoice = invoiceProgress(record);
  const isException = (s?: string) => s === 'exception';

  // 异常分支
  if (isRejected(reviewStatus)) {
    return {
      percent: 15,
      stageName: '已驳回',
      status: 'exception',
      mainStages: buildMainStages('已驳回', true),
    };
  }
  if (isCancelled(status)) {
    return {
      percent: 0,
      stageName: '已取消',
      status: 'exception',
      mainStages: buildMainStages('已取消', true),
    };
  }

  // 主流程
  if (isDraft(status)) {
    return { percent: 0, stageName: '草稿', mainStages: buildMainStages('草稿', false) };
  }
  if (isPendingReview(status)) {
    return { percent: 15, stageName: '待审核', mainStages: buildMainStages('待审核', false) };
  }
  if (isAudited(status) && !isEffective(record)) {
    return { percent: 30, stageName: '已审核', mainStages: buildMainStages('已审核', false) };
  }
  if (isEffective(record) && delivery >= 100 && invoice >= 100) {
    return {
      percent: 100,
      stageName: '已完成',
      status: 'success',
      mainStages: buildMainStages('已完成', false),
    };
  }
  if (isEffective(record) && delivery >= 100 && invoice < 100) {
    return {
      percent: 75 + (invoice / 100) * 25,
      stageName: '已交货',
      subPercent: invoice,
      subLabel: '开票',
      mainStages: buildMainStages('已交货', false),
    };
  }
  if (isEffective(record) && delivery < 100) {
    const subStages = buildExecutionSubStages(record);
    const percentBlend = 50 + (delivery / 100) * 25;
    return {
      percent: percentBlend,
      stageName: '执行中',
      subPercent: delivery,
      subLabel: currentSubStageLabel(subStages),
      mainStages: buildMainStages('执行中', false),
      subStages,
    };
  }

  if (isEffective(record)) {
    return { percent: 50, stageName: '已生效', mainStages: buildMainStages('已生效', false) };
  }

  return { percent: 30, stageName: '已审核', mainStages: buildMainStages('已审核', false) };
}
