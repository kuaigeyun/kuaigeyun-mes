/**
 * 报工数量上限：优先使用后端下发的 max_reportable_quantity，否则按工序上超报规则与工单计划推算。
 */

export function getMaxReportableQuantityForOperation(operation: any, workOrderQuantity: number): number {
  const plan = Number(workOrderQuantity) || 0;
  const mr = operation?.max_reportable_quantity ?? operation?.maxReportableQuantity;
  if (mr != null && !Number.isNaN(Number(mr))) {
    return Math.max(0, Number(mr));
  }
  const mode = operation?.over_report_mode ?? operation?.overReportMode ?? 'none';
  const val = Number(operation?.over_report_value ?? operation?.overReportValue ?? 0) || 0;
  if (mode === 'fixed') {
    return Math.max(0, plan + val);
  }
  if (mode === 'percent') {
    return Math.max(0, plan + (plan * val) / 100);
  }
  return Math.max(0, plan);
}

export function getRemainingReportableQuantity(operation: any, workOrderQuantity: number): number {
  const cap = getMaxReportableQuantityForOperation(operation, workOrderQuantity);
  const done = Number(operation?.completed_quantity ?? operation?.completedQuantity ?? 0) || 0;
  return Math.max(0, cap - done);
}
