/**
 * 报工数量上限：优先使用后端下发的 max_reportable_quantity，否则按工序上超报规则与工单计划推算。
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

export function getRemainingReportableQuantity(operation: any, workOrderQuantity: number): number {
  const cap = getMaxReportableQuantityForOperation(operation, workOrderQuantity);
  const done = Number(operation?.completed_quantity ?? operation?.completedQuantity ?? 0) || 0;
  return Math.max(0, cap - done);
}
