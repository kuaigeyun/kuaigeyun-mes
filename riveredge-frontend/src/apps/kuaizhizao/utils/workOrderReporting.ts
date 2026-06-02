/**
 * 报工数量上限：区分「计划可报（合计）」与「物料可报（在制）」，取较小值为本次可报上限。
 */

/** percent 模式：超报值为百分数 0–100（误填如 10000 时按 100 处理） */
function clampOverReportValue(mode: string, val: number): number {
  if (mode === 'percent') {
    if (val > 100) return 100;
    if (val < 0) return 0;
  }
  return val < 0 ? 0 : val;
}

export function getMaxReportableQuantityForOperation(operation: any, workOrderQuantity: number): number {
  const plan = Number(workOrderQuantity) || 0;
  const mode = operation?.over_report_mode ?? operation?.overReportMode ?? 'none';
  const rawVal = Number(operation?.over_report_value ?? operation?.overReportValue ?? 0) || 0;
  const val = clampOverReportValue(mode, rawVal);
  if (mode === 'fixed') {
    return Math.max(0, plan + val);
  }
  if (mode === 'percent') {
    return Math.max(0, plan + (plan * val) / 100);
  }
  return Math.max(0, plan);
}

/** 计划可报（剩余）：相对工单计划与超报规则，本工序尚可累计报工的数量 */
export function getPlanRemainingReportableQuantity(operation: any, workOrderQuantity: number): number {
  const cap = getMaxReportableQuantityForOperation(operation, workOrderQuantity);
  const done = Number(operation?.completed_quantity ?? operation?.completedQuantity ?? 0) || 0;
  return Math.max(0, cap - done);
}

/** 物料可报（剩余）：上道合格转出尚未在本工序消耗的数量（首道则为计划剩余在制） */
export function getMaterialRemainingReportableQuantity(operation: any): number | null {
  const raw = operation?.material_remaining ?? operation?.materialRemaining;
  if (raw == null || raw === '') return null;
  return Math.max(0, Number(raw) || 0);
}

export interface ReportableQuantityBreakdown {
  planCap: number;
  operationCompleted: number;
  planRemaining: number;
  materialRemaining: number | null;
  /** 上道工序合格转出（本工序在制来源） */
  prevTransferQty: number | null;
  effectiveRemaining: number;
  isFirstOperation: boolean;
}

export function getReportableQuantityBreakdown(
  operation: any,
  workOrderQuantity: number,
): ReportableQuantityBreakdown {
  const planCap = getMaxReportableQuantityForOperation(operation, workOrderQuantity);
  const operationCompleted =
    Number(operation?.completed_quantity ?? operation?.completedQuantity ?? 0) || 0;
  const planRemaining = Math.max(0, planCap - operationCompleted);
  const materialRemaining = getMaterialRemainingReportableQuantity(operation);
  const qualified = Number(operation?.qualified_quantity ?? operation?.qualifiedQuantity ?? 0) || 0;
  const prevTransferQty =
    materialRemaining != null ? materialRemaining + qualified : null;
  const seq = Number(operation?.sequence ?? 1);
  const isFirstOperation = seq <= 1;
  const effectiveRemaining =
    materialRemaining != null ? Math.min(planRemaining, materialRemaining) : planRemaining;
  return {
    planCap,
    operationCompleted,
    planRemaining,
    materialRemaining,
    prevTransferQty,
    effectiveRemaining,
    isFirstOperation,
  };
}

/** 本次可报上限（计划可报与物料可报之较小值） */
export function getRemainingReportableQuantity(operation: any, workOrderQuantity: number): number {
  return getReportableQuantityBreakdown(operation, workOrderQuantity).effectiveRemaining;
}

/** 单道工序料损：不合格 + 报废（与 completed−qualified 取较大，避免漏计） */
export function getOperationMaterialLoss(operation: any): number {
  const uq = Number(operation?.unqualified_quantity ?? operation?.unqualifiedQuantity ?? 0) || 0;
  const scrap = Number(operation?.material_scrap_qty ?? operation?.materialScrapQty ?? 0) || 0;
  const completed = Number(operation?.completed_quantity ?? operation?.completedQuantity ?? 0) || 0;
  const qualified = Number(operation?.qualified_quantity ?? operation?.qualifiedQuantity ?? 0) || 0;
  const inferred = Math.max(0, completed - qualified);
  return Math.max(uq + scrap, inferred);
}

/** 工单各工序累计料损 */
export function getWorkOrderMaterialLossTotal(operations: any[] | undefined | null): number {
  if (!operations?.length) return 0;
  return operations.reduce((sum, op) => sum + getOperationMaterialLoss(op), 0);
}
