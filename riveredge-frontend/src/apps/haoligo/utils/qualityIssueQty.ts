/** 品质问题不良率 = 不良数量 / 完成数量 × 100%（与后端 `quality_issue_calc` 一致） */

export function calcQualityIssueDefectRate(
  completedQty: string | number | null | undefined,
  defectQty: string | number | null | undefined,
): number | null {
  const completed = Number(completedQty);
  if (!Number.isFinite(completed) || completed <= 0) return null;
  const defects = Number(defectQty);
  const safeDefects = Number.isFinite(defects) ? defects : 0;
  const rate = (safeDefects / completed) * 100;
  return Math.round(rate * 100) / 100;
}

export function formatQualityIssueDefectRate(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return '—';
  return `${rate.toFixed(2)}%`;
}
