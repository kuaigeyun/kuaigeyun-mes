/** 点检数值型取值范围与实测判定（与后端 inspection_numeric_range 一致） */

export type SpotCheckLineWithRange = {
  measured_value?: string | null;
  numeric_min?: number | string | null;
  numeric_max?: number | string | null;
  result?: string;
  remark?: string | null;
};

function toNumber(raw: number | string | null | undefined): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

/** 实测是否超出范围；null 表示无法或未配置范围 */
export function isNumericMeasuredOutOfRange(
  measuredValue: string | null | undefined,
  numericMin?: number | string | null,
  numericMax?: number | string | null,
): boolean | null {
  const lo = toNumber(numericMin);
  const hi = toNumber(numericMax);
  if (lo == null && hi == null) return null;
  if (measuredValue == null || String(measuredValue).trim() === '') return null;
  const val = toNumber(measuredValue);
  if (val == null) return null;
  if (lo != null && val < lo) return true;
  if (hi != null && val > hi) return true;
  return false;
}

/** 根据数值范围推断点检结果 */
export function inferSpotCheckResultFromNumericRange(
  measuredValue: string | null | undefined,
  numericMin?: number | string | null,
  numericMax?: number | string | null,
): 'normal' | 'abnormal' | null {
  const oor = isNumericMeasuredOutOfRange(measuredValue, numericMin, numericMax);
  if (oor == null) return null;
  return oor ? 'abnormal' : 'normal';
}

export function applyNumericRangeToSpotCheckLine<T extends SpotCheckLineWithRange>(line: T): T {
  const inferred = inferSpotCheckResultFromNumericRange(
    line.measured_value,
    line.numeric_min,
    line.numeric_max,
  );
  if (inferred == null) return line;
  return {
    ...line,
    result: inferred,
    remark: inferred === 'normal' ? null : line.remark,
  };
}

export function formatNumericRangeLabel(
  numericMin?: number | string | null,
  numericMax?: number | string | null,
): string {
  const lo = toNumber(numericMin);
  const hi = toNumber(numericMax);
  if (lo == null && hi == null) return '';
  if (lo != null && hi != null) return `${lo} ~ ${hi}`;
  if (lo != null) return `≥ ${lo}`;
  return `≤ ${hi}`;
}
